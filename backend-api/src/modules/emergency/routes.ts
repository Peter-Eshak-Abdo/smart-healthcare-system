import { randomUUID, verify as cryptoVerify } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import {
  EmergencyConfirmCandidateRequestSchema,
  EmergencyIdentifyCardRequestSchema,
  EmergencyIdentifyManualRequestSchema,
  EmergencyProfileResponseSchema,
  EmergencyReasonCodeSchema,
  EmergencySessionParamSchema,
  ExtendEmergencySessionRequestSchema,
  OfflineEmergencyEventsRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import multer from 'multer';
import type { AppDeps } from '../../app-deps.js';
import type { AppEnv } from '../../config/env.js';
import { withUserTx, type Tx } from '../../db/with-user-tx.js';
import { mapFaceAnalysisFailure } from '../../integrations/ai-client.js';
import { requirePermission } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import type { Ed25519KeyPair } from '../../security/crypto/keyring.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024, files: 3 },
});

export function decideMatch(
  topSim: number | undefined,
  margin: number,
  env: Pick<AppEnv, 'FACE_MATCH_ACCEPT' | 'FACE_MATCH_POSSIBLE' | 'FACE_MATCH_MARGIN'>,
): 'no_match' | 'possible_match' | 'match' {
  if (topSim === undefined || topSim < env.FACE_MATCH_POSSIBLE) {
    return 'no_match';
  }
  if (topSim >= env.FACE_MATCH_ACCEPT && margin >= env.FACE_MATCH_MARGIN) {
    return 'match';
  }
  return 'possible_match';
}

export function ageBandOf(dob: string): string {
  const age = calculateAge(dob);
  const low = Math.floor(age / 10) * 10;
  return `${low}-${low + 9}`;
}

export function verifyEmergencyCardPayload(
  qrPayload: string,
  keys: Ed25519KeyPair[],
): { mrn: string; expired: boolean } | null {
  if (!qrPayload.startsWith('SHEC1.')) return null;
  const jws = qrPayload.slice(6);
  const parts = jws.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
      typ?: string;
    };
    if (header.alg !== 'EdDSA' || !header.kid) return null;
    const keyPair = keys.find((k) => k.kid === header.kid);
    if (!keyPair) return null;

    const valid = cryptoVerify(
      null,
      Buffer.from(`${headerB64}.${payloadB64}`, 'ascii'),
      keyPair.publicKey,
      Buffer.from(sigB64, 'base64url'),
    );
    if (!valid) return null;

    let payloadBuf = Buffer.from(payloadB64, 'base64url');
    if (header.typ?.includes('deflate')) {
      payloadBuf = inflateRawSync(payloadBuf);
    }
    const claims = JSON.parse(payloadBuf.toString('utf8')) as {
      mrn?: string;
      exp?: number;
    };
    if (!claims.mrn) return null;
    const expired = typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000);
    return { mrn: claims.mrn, expired };
  } catch {
    return null;
  }
}

export function emergencyRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  async function openSessionAndPreview(
    tx: Tx,
    input: {
      patientId: string;
      method: 'face' | 'emergency_card_qr' | 'manual_search';
      matchScore: number | null;
      matchMargin: number | null;
      lowConfidence: boolean;
      confirmed: boolean;
      reasonCode: string;
      incidentRef?: string | undefined;
      lat?: number | null | undefined;
      lng?: number | null | undefined;
      idemKey?: string | undefined;
    },
  ) {
    const sRes = await sql<{
      id: string;
      expires_at: string;
      low_confidence: boolean;
    }>`
      select id, expires_at::text, low_confidence
        from private.open_emergency_session(
          ${input.patientId}::uuid,
          ${input.method}::app.emergency_id_method,
          ${input.matchScore},
          ${input.matchMargin},
          ${input.lowConfidence},
          ${input.confirmed},
          ${input.reasonCode},
          ${input.incidentRef ?? null},
          ${input.lat ?? null},
          ${input.lng ?? null},
          ${input.idemKey ?? null}::uuid
        )
    `.execute(tx);
    const session = sRes.rows[0]!;

    const profJsonRes = await sql<{ prof: unknown }>`
      select private.get_emergency_profile(${session.id}::uuid) as prof
    `.execute(tx);
    const parsedProf = EmergencyProfileResponseSchema.strict().parse(profJsonRes.rows[0]!.prof);

    return {
      result: 'match' as const,
      session: {
        id: session.id,
        expires_at: new Date(session.expires_at).toISOString(),
        low_confidence: session.low_confidence,
      },
      patient_preview: parsedProf.patient,
    };
  }

  router.post(
    '/emergency/identify',
    requirePermission('emergency:identify'),
    deps.rateLimit.middleware('emergency_identify_min'),
    deps.rateLimit.middleware('emergency_identify_hour'),
    upload.array('frames', 3),
    idempotencyMiddleware(deps.redis, { required: true }),
    async (req, res, next) => {
      const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
      try {
        const auth = res.locals.auth!;
        const reasonCode = EmergencyReasonCodeSchema.parse(req.body.reason_code);
        const incidentRef =
          typeof req.body.incident_ref === 'string' ? req.body.incident_ref.slice(0, 64) : undefined;
        let lat: number | null = null;
        let lng: number | null = null;
        if (typeof req.body.location === 'string' && req.body.location.trim()) {
          const parsedLoc = JSON.parse(req.body.location) as { lat?: number; lng?: number };
          lat = parsedLoc.lat ?? null;
          lng = parsedLoc.lng ?? null;
        }
        if (files.length === 0) {
          throw new AppError('VALIDATION_FAILED', { detail: 'frames_required' });
        }

        const analysis = await deps.aiClient.analyzeFace({
          mode: 'identify',
          livenessMode: 'passive',
          frames: files.map((f) => f.buffer),
          priority: 'emergency',
        });

        if (
          !analysis.face_detected ||
          analysis.face_count !== 1 ||
          !analysis.quality.passed ||
          !analysis.liveness.passed ||
          !analysis.template
        ) {
          throw mapFaceAnalysisFailure(analysis);
        }

        const pools = requirePools();
        const vecLiteral = `[${analysis.template.vector.join(',')}]`;

        const outcome = await withUserTx(
          pools,
          auth,
          async (tx) => {
            const topRes = await sql<{ patient_id: string; similarity: number }>`
              select patient_id, similarity
                from private.match_face(
                  ${vecLiteral}::extensions.vector,
                  ${analysis.model_version},
                  ${analysis.transform_key_version},
                  5
                )
            `.execute(tx);

            const top = topRes.rows;
            const first = top[0];
            const second = top[1];
            const margin =
              first !== undefined && second !== undefined
                ? first.similarity - second.similarity
                : 1.0;
            const decision = decideMatch(first?.similarity, margin, deps.env);

            await sql`
              insert into biometric.attempts (actor_id, purpose, result, top_score, second_score, liveness_score, model_version)
              values (
                ${auth.userId}::uuid,
                'identify',
                ${decision},
                ${first?.similarity ?? null},
                ${second?.similarity ?? null},
                ${analysis.liveness.score},
                ${analysis.model_version}
              )
            `.execute(tx);

            await writeAuditLog(tx, auth, {
              action: 'FACE_IDENTIFY_ATTEMPT',
              resourceType: 'emergency_identify',
              metadata: { result: decision, liveness_passed: true },
            });

            if (decision === 'no_match' || !first) {
              return {
                result: 'no_match' as const,
                fallbacks: ['emergency_card_qr', 'national_id_search'] as const,
              };
            }

            if (decision === 'possible_match') {
              const candidates = [];
              for (const cand of top.slice(0, 2)) {
                const cRow = await sql<{ sex: 'male' | 'female'; date_of_birth: string }>`
                  select sex, date_of_birth::text from app.patients where id = ${cand.patient_id}::uuid
                `.execute(tx);
                const info = cRow.rows[0];
                if (!info) continue;
                const candToken = randomUUID();
                await deps.redis.set(
                  `emerg:cand:${candToken}`,
                  JSON.stringify({
                    paramedicId: auth.userId,
                    patientId: cand.patient_id,
                    similarity: cand.similarity,
                    margin,
                  }),
                  'EX',
                  120,
                );
                candidates.push({
                  candidate_token: candToken,
                  sex: info.sex,
                  age_band: ageBandOf(info.date_of_birth),
                });
              }

              return {
                result: 'possible_match' as const,
                candidates,
                candidate_tokens_expire_in: 120,
              };
            }

            return openSessionAndPreview(tx, {
              patientId: first.patient_id,
              method: 'face',
              matchScore: first.similarity,
              matchMargin: margin,
              lowConfidence: false,
              confirmed: false,
              reasonCode,
              incidentRef,
              lat,
              lng,
              idemKey: res.locals.idempotencyKey,
            });
          },
          { pool: 'emergency' },
        );

        res.status(200).json(outcome);
      } catch (err) {
        if (err instanceof AppError && err.code === 'AI_SERVICE_UNAVAILABLE') {
          next(
            new AppError('AI_SERVICE_UNAVAILABLE', {
              extra: { fallbacks: ['emergency_card_qr', 'national_id_search'] },
            }),
          );
          return;
        }
        next(err);
      } finally {
        for (const f of files) {
          f.buffer.fill(0);
        }
      }
    },
  );

  router.post(
    '/emergency/identify/confirm',
    requirePermission('emergency:identify'),
    validate({ body: EmergencyConfirmCandidateRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          candidate_token: string;
          reason_code: string;
          incident_ref?: string;
        };

        const raw = await deps.redis.get(`emerg:cand:${body.candidate_token}`);
        if (!raw) {
          throw new AppError('EMERG_SESSION_EXPIRED', { detail: 'candidate_token_expired' });
        }
        const cand = JSON.parse(raw) as {
          paramedicId: string;
          patientId: string;
          similarity: number;
          margin: number;
        };
        if (cand.paramedicId !== auth.userId) {
          throw new AppError('RBAC_FORBIDDEN');
        }
        await deps.redis.del(`emerg:cand:${body.candidate_token}`);

        const pools = requirePools();
        const result = await withUserTx(
          pools,
          auth,
          async (tx) =>
            openSessionAndPreview(tx, {
              patientId: cand.patientId,
              method: 'face',
              matchScore: cand.similarity,
              matchMargin: cand.margin,
              lowConfidence: true,
              confirmed: true,
              reasonCode: body.reason_code,
              incidentRef: body.incident_ref,
            }),
          { pool: 'emergency' },
        );

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/emergency/identify/card',
    requirePermission('emergency:identify'),
    idempotencyMiddleware(deps.redis, { required: true }),
    validate({ body: EmergencyIdentifyCardRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          card_qr_payload: string;
          reason_code: string;
          incident_ref?: string;
        };
        const verified = verifyEmergencyCardPayload(
          body.card_qr_payload,
          deps.keyring.emergencyCardPublicKeys,
        );
        if (!verified) {
          throw new AppError('RX_SIGNATURE_INVALID', { detail: 'card_signature_invalid' });
        }

        const pools = requirePools();
        const outcome = await withUserTx(
          pools,
          auth,
          async (tx) => {
            const pRow = await sql<{ id: string }>`
              select id from app.patients where mrn = ${verified.mrn}
            `.execute(tx);
            const patientId = pRow.rows[0]?.id;
            if (!patientId) {
              return {
                result: 'no_match' as const,
                fallbacks: ['national_id_search'] as const,
              };
            }

            const opened = await openSessionAndPreview(tx, {
              patientId,
              method: 'emergency_card_qr',
              matchScore: null,
              matchMargin: null,
              lowConfidence: false,
              confirmed: false,
              reasonCode: body.reason_code,
              incidentRef: body.incident_ref,
              idemKey: res.locals.idempotencyKey,
            });
            return {
              ...opened,
              ...(verified.expired ? { card_expired: true } : {}),
            };
          },
          { pool: 'emergency' },
        );

        res.status(200).json(outcome);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/emergency/identify/manual',
    requirePermission('emergency:identify'),
    deps.rateLimit.middleware('emergency_manual_search'),
    validate({ body: EmergencyIdentifyManualRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          id_document_type: 'national_id' | 'passport';
          id_document_number: string;
          reason_code: string;
          incident_ref?: string;
        };
        const bidx = deps.fieldCipher.blindIndex(
          `${body.id_document_type}:${body.id_document_number}`,
          'id_document',
        );
        const pools = requirePools();

        const outcome = await withUserTx(
          pools,
          auth,
          async (tx) => {
            const pRow = await sql<{ id: string }>`
              select id from app.patients where id_document_bidx = ${bidx}
            `.execute(tx);
            const patientId = pRow.rows[0]?.id;
            if (!patientId) {
              return {
                result: 'no_match' as const,
                fallbacks: ['emergency_card_qr'] as const,
              };
            }
            return openSessionAndPreview(tx, {
              patientId,
              method: 'manual_search',
              matchScore: null,
              matchMargin: null,
              lowConfidence: false,
              confirmed: false,
              reasonCode: body.reason_code,
              incidentRef: body.incident_ref,
            });
          },
          { pool: 'emergency' },
        );

        res.status(200).json(outcome);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/emergency/sessions/:sessionId/profile',
    requirePermission('emergency_profile:read:session'),
    validate({ params: EmergencySessionParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const pools = requirePools();

        const profile = await withUserTx(
          pools,
          auth,
          async (tx) => {
            const profRes = await sql<{ prof: unknown }>`
              select private.get_emergency_profile(${sessionId}::uuid) as prof
            `.execute(tx);
            const strictProfile = EmergencyProfileResponseSchema.strict().parse(
              profRes.rows[0]!.prof,
            );
            await writeAuditLog(tx, auth, {
              action: 'EMERGENCY_PROFILE_READ',
              resourceType: 'emergency_session',
              resourceId: sessionId,
            });
            return strictProfile;
          },
          { pool: 'emergency' },
        );

        res.status(200).json(profile);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/emergency/sessions/:sessionId/contacts',
    requirePermission('emergency_contact:read:session'),
    validate({ params: EmergencySessionParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const pools = requirePools();

        const contacts = await withUserTx(
          pools,
          auth,
          async (tx) => {
            const rows = await sql<{
              id: string;
              full_name_enc: string;
              relationship: string;
              phone_enc: string;
              priority: number;
            }>`
              select ec.id, c.full_name_enc, c.relationship, c.phone_enc, c.priority
                from private.get_emergency_contacts(${sessionId}::uuid) c
                join app.emergency_sessions es on es.id = ${sessionId}::uuid
                join app.emergency_contacts ec
                  on ec.patient_id = es.patient_id
                 and ec.full_name_enc = c.full_name_enc
                 and ec.deleted_at is null
            `.execute(tx);

            await writeAuditLog(tx, auth, {
              action: 'EMERGENCY_CONTACTS_READ',
              resourceType: 'emergency_session',
              resourceId: sessionId,
            });

            return rows.rows.map((r) => ({
              full_name: deps.fieldCipher.decrypt(
                r.full_name_enc,
                aad('emergency_contacts', 'full_name_enc', r.id),
              ),
              relationship: r.relationship,
              phone: deps.fieldCipher.decrypt(
                r.phone_enc,
                aad('emergency_contacts', 'phone_enc', r.id),
              ),
              priority: r.priority,
            }));
          },
          { pool: 'emergency' },
        );

        res.status(200).json({ data: contacts });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/emergency/sessions/:sessionId/extend',
    requirePermission('emergency_profile:read:session'),
    validate({ params: EmergencySessionParamSchema, body: ExtendEmergencySessionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const { reason } = res.locals.validated!.body as { reason: string };
        const pools = requirePools();

        const extended = await withUserTx(
          pools,
          auth,
          async (tx) => {
            const row = await sql<{ expires_at: string }>`
              select expires_at::text
                from private.extend_emergency_session(${sessionId}::uuid, ${reason})
            `.execute(tx);
            return new Date(row.rows[0]!.expires_at).toISOString();
          },
          { pool: 'emergency' },
        );

        res.status(200).json({ expires_at: extended });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/emergency/sessions/:sessionId/close',
    requirePermission('emergency_profile:read:session'),
    validate({ params: EmergencySessionParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const pools = requirePools();

        await withUserTx(
          pools,
          auth,
          async (tx) => {
            await tx
              .updateTable('app.emergency_sessions')
              .set({ status: 'closed', closed_at: sql`now()` })
              .where('id', '=', sessionId)
              .where('paramedic_id', '=', auth.userId)
              .execute();

            await writeAuditLog(tx, auth, {
              action: 'EMERGENCY_SESSION_CLOSED',
              resourceType: 'emergency_session',
              resourceId: sessionId,
            });
          },
          { pool: 'emergency' },
        );

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/emergency/offline-events',
    requirePermission('emergency:identify'),
    validate({ body: OfflineEmergencyEventsRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { events } = res.locals.validated!.body as {
          events: Array<{
            event_id: string;
            type: 'offline_card_view';
            card_mrn: string;
            card_iat: number;
            occurred_at: string;
            device_signature_b64: string;
          }>;
        };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          for (const ev of events) {
            await writeAuditLog(tx, auth, {
              action: 'OFFLINE_EMERGENCY_CARD_VIEWED',
              resourceType: 'emergency_card',
              resourceId: ev.event_id,
              metadata: {
                mrn_last4: ev.card_mrn.slice(-4),
                card_iat: ev.card_iat,
                occurred_at: ev.occurred_at,
              },
            });
          }
        });

        res.status(202).json({ accepted: events.length, rejected: 0 });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
