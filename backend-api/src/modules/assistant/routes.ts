import { createHash, randomUUID } from 'node:crypto';
import {
  AssistantSessionParamSchema,
  CreateAssistantSessionRequestSchema,
  SendAssistantMessageRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type ConsentDoc,
  type PatientDoc,
} from '../../firebase/firestore-types.js';
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

interface AssistantSessionDoc {
  id: string;
  patient_id: string;
  locale: 'ar' | 'en';
  status: 'open' | 'closed';
  created_at: string;
  last_message_at: string | null;
}

interface AssistantMessageDoc {
  id: string;
  session_id: string;
  patient_id: string;
  role: 'user' | 'assistant';
  content_enc: string;
  triage_level: 'emergency' | 'urgent' | 'soon' | 'routine' | 'self_care' | null;
  red_flag: boolean;
  rule_ids: string[];
  specialty_code: string | null;
  created_at: string;
}

export function assistantRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/assistant/sessions',
    requirePermission('assistant:use'),
    validate({ body: CreateAssistantSessionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { locale } = res.locals.validated!.body as { locale: 'ar' | 'en' };
        const db = requireDb(deps);

        const patSnap = await db.collection(COLLECTIONS.patients).doc(auth.userId).get();
        if (!patSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const pat = patSnap.data() as PatientDoc;
        if (isMinorPatient(pat.date_of_birth)) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'minor_account' });
        }

        const consentSnap = await db
          .collection(COLLECTIONS.consents)
          .where('patient_id', '==', auth.userId)
          .where('type', '==', 'ai_assistant')
          .get();
        const hasConsent = consentSnap.docs.some((d) => (d.data() as ConsentDoc).granted === true);
        if (!hasConsent) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'consent_required' });
        }

        const sessionId = randomUUID();
        const createdAt = new Date().toISOString();
        const sessionDoc: AssistantSessionDoc = {
          id: sessionId,
          patient_id: auth.userId,
          locale,
          status: 'open',
          created_at: createdAt,
          last_message_at: null,
        };
        await db.collection(COLLECTIONS.assistantSessions).doc(sessionId).set(sessionDoc);

        await writeAuditLog(db, auth, {
          action: 'ASSISTANT_SESSION_CREATED',
          resourceType: 'assistant_session',
          resourceId: sessionId,
          patientId: auth.userId,
        });

        res.status(201).json({
          session_id: sessionId,
          disclaimer: DISCLAIMER,
          created_at: createdAt,
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
        const db = requireDb(deps);

        const sessionRef = db.collection(COLLECTIONS.assistantSessions).doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const session = sessionSnap.data() as AssistantSessionDoc;
        if (session.patient_id !== auth.userId) throw new AppError('RESOURCE_NOT_FOUND');
        if (session.status !== 'open') {
          throw new AppError('VALIDATION_FAILED', {
            statusOverride: 410,
            detail: 'session_closed',
          });
        }

        const patSnap = await db.collection(COLLECTIONS.patients).doc(auth.userId).get();
        if (!patSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const pat = patSnap.data() as PatientDoc;

        const msgCol = sessionRef.collection('messages');
        const recentSnap = await msgCol.orderBy('created_at', 'asc').limit(20).get();
        const history = recentSnap.docs.slice(-10).map((d) => {
          const m = d.data() as AssistantMessageDoc;
          return {
            role: m.role,
            text: deps.fieldCipher.decrypt(
              m.content_enc,
              aad('assistant_messages', 'content_enc', m.id),
            ),
          };
        });

        const nowIso = new Date().toISOString();
        const userMsgDoc: AssistantMessageDoc = {
          id: body.client_message_id,
          session_id: sessionId,
          patient_id: auth.userId,
          role: 'user',
          content_enc: deps.fieldCipher.encrypt(
            body.text,
            aad('assistant_messages', 'content_enc', body.client_message_id),
          ),
          triage_level: null,
          red_flag: false,
          rule_ids: [],
          specialty_code: null,
          created_at: nowIso,
        };
        await msgCol.doc(body.client_message_id).set(userMsgDoc);

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

        const spSnap = await db
          .collection(COLLECTIONS.specialtiesReference)
          .doc(specCode)
          .get();
        const sp = spSnap.exists
          ? (spSnap.data() as { code: string; name_en: string; name_ar: string })
          : null;

        const assistantMsgId = randomUUID();
        const assistantMsgDoc: AssistantMessageDoc = {
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
          specialty_code: sp?.code ?? specCode,
          created_at: new Date().toISOString(),
        };
        await msgCol.doc(assistantMsgId).set(assistantMsgDoc);
        await sessionRef.update({ last_message_at: assistantMsgDoc.created_at });

        if (redFlag) {
          await writeAuditLog(db, auth, {
            action: 'ASSISTANT_RED_FLAG',
            resourceType: 'assistant_session',
            resourceId: sessionId,
            patientId: auth.userId,
            metadata: { rule_ids: ruleIds },
          });
        }

        res.status(200).json({
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
            code: sp?.code ?? specCode,
            name: { en: sp?.name_en ?? specCode, ar: sp?.name_ar ?? specCode },
            reason: specReason,
          },
          follow_up_questions: followUpQuestions,
          disclaimer: DISCLAIMER[session.locale],
          emergency_action: emergencyAction,
        });
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
        const db = requireDb(deps);
        const sessionRef = db.collection(COLLECTIONS.assistantSessions).doc(sessionId);
        const snap = await sessionRef.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const session = snap.data() as AssistantSessionDoc;
        if (session.patient_id !== auth.userId) throw new AppError('RESOURCE_NOT_FOUND');

        const msgsSnap = await sessionRef.collection('messages').orderBy('created_at', 'asc').get();
        res.status(200).json({
          session_id: session.id,
          locale: session.locale,
          status: session.status,
          created_at: session.created_at,
          messages: msgsSnap.docs.map((d) => {
            const m = d.data() as AssistantMessageDoc;
            return {
              id: m.id,
              role: m.role,
              text: deps.fieldCipher.decrypt(
                m.content_enc,
                aad('assistant_messages', 'content_enc', m.id),
              ),
              triage_level: m.triage_level,
              red_flag: m.red_flag,
              created_at: m.created_at,
            };
          }),
        });
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
        const db = requireDb(deps);
        const sessionRef = db.collection(COLLECTIONS.assistantSessions).doc(sessionId);
        const snap = await sessionRef.get();
        if (!snap.exists || (snap.data() as AssistantSessionDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await sessionRef.update({ status: 'closed' });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
