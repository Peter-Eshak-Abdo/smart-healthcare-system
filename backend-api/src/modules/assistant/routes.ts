import { createHash, randomUUID } from 'node:crypto';
import {
  AssistantSessionParamSchema,
  CreateAssistantSessionRequestSchema,
  SendAssistantMessageRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { ageBandOf } from '../emergency/routes.js';
import { isMinorPatient } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { evaluateRedFlagsFallback } from './red-flags.js';

const DISCLAIMER = {
  ar: 'هذه إرشادات عامة وليست تشخيصاً طبياً أو بديلاً عن استشارة الطبيب.',
  en: 'This is general symptom guidance and is not a medical diagnosis or substitute for a doctor.',
};

export function assistantRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.post(
    '/assistant/sessions',
    requirePermission('assistant:use'),
    validate({ body: CreateAssistantSessionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { locale } = res.locals.validated!.body as { locale: 'ar' | 'en' };
        const pools = requirePools();

        const created = await withUserTx(pools, auth, async (tx) => {
          const pat = await tx
            .selectFrom('app.patients')
            .select(['date_of_birth'])
            .where('id', '=', auth.userId)
            .executeTakeFirstOrThrow();

          if (isMinorPatient(pat.date_of_birth)) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'minor_account' });
          }

          const consentRes = await sql<{ granted: boolean }>`
            select private.has_consent(${auth.userId}::uuid, 'ai_assistant') as granted
          `.execute(tx);
          if (!consentRes.rows[0]?.granted) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'consent_required' });
          }

          const session = await tx
            .insertInto('app.assistant_sessions')
            .values({
              patient_id: auth.userId,
              locale,
              status: 'open',
            })
            .returning(['id', 'created_at'])
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'ASSISTANT_SESSION_CREATED',
            resourceType: 'assistant_session',
            resourceId: session.id,
            patientId: auth.userId,
          });

          return session;
        });

        res.status(201).json({
          session_id: created.id,
          disclaimer: DISCLAIMER,
          created_at: new Date(created.created_at).toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/assistant/sessions/:sessionId/messages',
    requirePermission('assistant:use'),
    deps.rateLimit.middleware('assistant_msg'),
    validate({ params: AssistantSessionParamSchema, body: SendAssistantMessageRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const body = res.locals.validated!.body as { text: string; client_message_id: string };
        const pools = requirePools();

        const payload = await withUserTx(pools, auth, async (tx) => {
          const session = await tx
            .selectFrom('app.assistant_sessions')
            .select(['id', 'locale', 'status'])
            .where('id', '=', sessionId)
            .where('patient_id', '=', auth.userId)
            .executeTakeFirst();

          if (!session) throw new AppError('RESOURCE_NOT_FOUND');
          if (session.status !== 'open') {
            throw new AppError('VALIDATION_FAILED', {
              statusOverride: 410,
              detail: 'session_closed',
            });
          }

          const pat = await tx
            .selectFrom('app.patients')
            .select(['date_of_birth', 'sex'])
            .where('id', '=', auth.userId)
            .executeTakeFirstOrThrow();

          const recentMsgs = await tx
            .selectFrom('app.assistant_messages')
            .select(['id', 'role', 'content_enc'])
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .limit(10)
            .execute();

          const history = recentMsgs.reverse().map((m) => ({
            role: m.role,
            text: deps.fieldCipher.decrypt(
              m.content_enc,
              aad('assistant_messages', 'content_enc', m.id),
            ),
          }));

          const userMsgId = body.client_message_id;
          await tx
            .insertInto('app.assistant_messages')
            .values({
              id: userMsgId,
              session_id: sessionId,
              patient_id: auth.userId,
              role: 'user',
              content_enc: deps.fieldCipher.encrypt(
                body.text,
                aad('assistant_messages', 'content_enc', userMsgId),
              ),
              triage_level: null,
              red_flag: false,
              rule_ids: [],
              specialty_code: null,
            })
            .execute();

          let replyLevel: 'emergency' | 'urgent' | 'soon' | 'routine' | 'self_care' = 'soon';
          let redFlag = false;
          let ruleIds: string[] = [];
          let source: 'rules' | 'llm+rules' | 'fallback' = 'llm+rules';
          let replyText = '';
          let selfCare: string[] = [];
          let warningSigns: string[] = [];
          let specCode = 'general_practice';
          let specReason: string | null = null;
          let followUpQuestions: string[] = [];
          let emergencyAction: {
            type: 'call';
            phone: string;
            label: { ar: string; en: string };
          } | null = null;

          try {
            const aiTriage = await deps.aiClient.triageAssistant({
              session_ref: createHash('sha256').update(sessionId).digest('hex'),
              locale: session.locale,
              history,
              message: body.text,
              patient_context: {
                age_band: ageBandOf(pat.date_of_birth),
                sex: pat.sex,
                pregnant: null,
              },
            });

            replyLevel = aiTriage.triage.level;
            redFlag = aiTriage.triage.red_flag;
            ruleIds = aiTriage.triage.rule_ids;
            source = aiTriage.llm_used
              ? aiTriage.validator.fallback_used
                ? 'fallback'
                : 'llm+rules'
              : 'rules';
            replyText = aiTriage.reply.text;
            selfCare = aiTriage.reply.self_care;
            warningSigns = aiTriage.reply.warning_signs;
            specCode = aiTriage.recommended_specialty_code;
            specReason = aiTriage.specialty_reason;
            followUpQuestions = aiTriage.follow_up_questions;
          } catch {
            // Never return 503 on assistant: deterministic backend red-flag fallback (US-13-AC4)
            const fb = evaluateRedFlagsFallback(body.text);
            replyLevel = fb.level;
            redFlag = fb.matched && fb.level === 'emergency';
            ruleIds = fb.ruleIds;
            source = fb.matched ? 'rules' : 'fallback';
            specCode = redFlag ? 'emergency_medicine' : 'general_practice';
            replyText =
              session.locale === 'ar'
                ? redFlag
                  ? 'الأعراض دي فيها علامات خطر طارئة. اتصل بالإسعاف 123 فوراً أو روح أقرب طوارئ.'
                  : 'المساعد الذكي مش متاح مؤقتاً. لو عندك أعراض مستمرة يفضل تراجع طبيب مختص، ولو ظهرت أي علامات خطر اتصل بـ 123 فوراً.'
                : redFlag
                  ? 'Your symptoms indicate a possible medical emergency. Call 123 immediately or go to the nearest emergency room.'
                  : 'The AI assistant is temporarily unavailable. Please consult a clinician if symptoms persist, and call 123 immediately if warning signs appear.';
          }

          if (replyLevel === 'emergency') {
            emergencyAction = {
              type: 'call',
              phone: deps.env.EMERGENCY_PHONE,
              label: {
                ar: `اتصل بالإسعاف ${deps.env.EMERGENCY_PHONE}`,
                en: `Call ambulance ${deps.env.EMERGENCY_PHONE}`,
              },
            };
          }

          const spRow = await tx
            .selectFrom('ref.specialties')
            .select(['code', 'name_en', 'name_ar'])
            .where('code', '=', specCode)
            .executeTakeFirst();

          const assistantMsgId = randomUUID();
          await tx
            .insertInto('app.assistant_messages')
            .values({
              id: assistantMsgId,
              session_id: sessionId,
              patient_id: auth.userId,
              role: 'assistant',
              content_enc: deps.fieldCipher.encrypt(
                replyText,
                aad('assistant_messages', 'content_enc', assistantMsgId),
              ),
              triage_level: replyLevel,
              red_flag: redFlag,
              rule_ids: ruleIds,
              specialty_code: spRow?.code ?? 'general_practice',
            })
            .execute();

          await tx
            .updateTable('app.assistant_sessions')
            .set({ last_message_at: sql`now()` })
            .where('id', '=', sessionId)
            .execute();

          if (redFlag) {
            await writeAuditLog(tx, auth, {
              action: 'ASSISTANT_RED_FLAG',
              resourceType: 'assistant_session',
              resourceId: sessionId,
              patientId: auth.userId,
              metadata: { rule_ids: ruleIds },
            });
          }

          return {
            message_id: assistantMsgId,
            triage: {
              level: replyLevel,
              red_flag: redFlag,
              red_flag_rule_ids: ruleIds,
              source,
            },
            reply: {
              text: replyText,
              self_care: selfCare,
              warning_signs: warningSigns,
            },
            recommended_specialty: {
              code: spRow?.code ?? specCode,
              name: {
                en: spRow?.name_en ?? 'General Practice',
                ar: spRow?.name_ar ?? 'الممارس العام',
              },
              reason: specReason,
            },
            follow_up_questions: followUpQuestions,
            disclaimer: DISCLAIMER[session.locale],
            emergency_action: emergencyAction,
          };
        });

        res.status(200).json(payload);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/assistant/sessions/:sessionId',
    requirePermission('assistant:use'),
    validate({ params: AssistantSessionParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const pools = requirePools();

        const detail = await withUserTx(pools, auth, async (tx) => {
          const session = await tx
            .selectFrom('app.assistant_sessions')
            .select(['id', 'locale', 'status', 'created_at'])
            .where('id', '=', sessionId)
            .where('patient_id', '=', auth.userId)
            .executeTakeFirst();

          if (!session) throw new AppError('RESOURCE_NOT_FOUND');

          const msgs = await tx
            .selectFrom('app.assistant_messages')
            .select(['id', 'role', 'content_enc', 'triage_level', 'red_flag', 'created_at'])
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'asc')
            .execute();

          return {
            session_id: session.id,
            locale: session.locale,
            status: session.status,
            created_at: new Date(session.created_at).toISOString(),
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              text: deps.fieldCipher.decrypt(
                m.content_enc,
                aad('assistant_messages', 'content_enc', m.id),
              ),
              triage_level: m.triage_level,
              red_flag: m.red_flag,
              created_at: new Date(m.created_at).toISOString(),
            })),
          };
        });

        res.status(200).json(detail);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/assistant/sessions/:sessionId',
    requirePermission('assistant:use'),
    validate({ params: AssistantSessionParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const deleted = await tx
            .deleteFrom('app.assistant_sessions')
            .where('id', '=', sessionId)
            .where('patient_id', '=', auth.userId)
            .returning('id')
            .executeTakeFirst();

          if (!deleted) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'ASSISTANT_SESSION_DELETED',
            resourceType: 'assistant_session',
            resourceId: sessionId,
            patientId: auth.userId,
          });
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
