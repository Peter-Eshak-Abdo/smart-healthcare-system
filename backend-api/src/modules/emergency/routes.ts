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
import multer from 'multer';
import type { AppDeps } from '../../app-deps.js';
import type { AppEnv } from '../../config/env.js';
import { matchFaceTemplates } from '../../firebase/biometric-match.js';
import { enqueueOutboxNotification, requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type EmergencyContactDoc,
  type EmergencySessionDoc,
  type PatientDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { mapFaceAnalysisFailure } from '../../integrations/ai-client.js';
import { requirePermission } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import type { Ed25519KeyPair } from '../../security/crypto/keyring.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { loadCriticalInfo } from '../patients/shared.js';

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

  async function buildClosedProfile(session: EmergencySessionDoc) {
    const db = requireDb(deps);
    const [patSnap, userSnap, crit, contactsSnap] = await Promise.all([
      db.collection(COLLECTIONS.patients).doc(session.patient_id).get(),
      db.collection(COLLECTIONS.users).doc(session.patient_id).get(),
      loadCriticalInfo(db, deps, session.patient_id),
      db
        .collection(COLLECTIONS.emergencyContacts)
        .where('patient_id', '==', session.patient_id)
        .where('share_with_emergency', '==', true)
        .limit(1)
        .get(),
    ]);

    const pat = patSnap.data() as PatientDoc;
    const user = userSnap.data() as UserDoc;

    return EmergencyProfileResponseSchema.strict().parse({
      session: {
        id: session.id,
        expires_at: session.expires_at,
        low_confidence: session.low_confidence,
        method: session.method,
      },
      patient: {
        full_name: user.full_name,
        age: calculateAge(pat.date_of_birth),
        sex: pat.sex,
        mrn_last4: pat.mrn_last4,
      },
      blood_type: {
        value: crit.blood_type.value,
        verified: crit.blood_type.source === 'clinician_confirmed',
      },
      allergies: crit.allergies.map((a) => ({
        name: a.allergen?.name.en ?? a.free_text ?? 'Allergy',
        severity: a.severity,
        verified: a.source === 'clinician_confirmed',
      })),
      chronic_conditions: crit.chronic_conditions.map((c) => ({
        name: c.name.en,
        since_year: null,
      })),
      current_medications: crit.current_medications.map((m) => ({
        name: m.drug.display,
        dose_text: m.dose_text,
      })),
      has_shared_contacts: !contactsSnap.empty,
      generated_at: new Date().toISOString(),
    });
  }

  async function openSessionAndPreview(
    auth: NonNullable<Express.Locals['auth']>,
    input: {
      patientId: string;
      method: 'face' | 'emergency_card_qr' | 'manual_search';
      matchScore: number | null;
      lowConfidence: boolean;
      reasonCode: string;
      incidentRef?: string | undefined;
    },
  ) {
    const db = requireDb(deps);
    const patSnap = await db.collection(COLLECTIONS.patients).doc(input.patientId).get();
    if (!patSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
    const pat = patSnap.data() as PatientDoc;

    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60_000).toISOString();
    const band =
      input.matchScore === null
        ? 'manual'
        : input.matchScore >= deps.env.FACE_MATCH_ACCEPT
          ? 'high'
          : 'possible';

    const sessionDoc: EmergencySessionDoc = {
      id: sessionId,
      paramedic_id: auth.userId,
      paramedic_name: auth.fullName,
      patient_id: input.patientId,
      patient_mrn_last4: pat.mrn_last4,
      method: input.method,
      reason_code: input.reasonCode,
      incident_ref: input.incidentRef ?? null,
      low_confidence: input.lowConfidence,
      match_score_band: band,
      started_at: now.toISOString(),
      expires_at: expiresAt,
      closed_at: null,
      review_status: 'pending',
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    };

    await db.collection(COLLECTIONS.emergencySessions).doc(sessionId).set(sessionDoc);
    await writeAuditLog(db, auth, {
      action: 'EMERGENCY_SESSION_OPENED',
      resourceType: 'emergency_session',
      resourceId: sessionId,
      patientId: input.patientId,
      patientMrnLast4: pat.mrn_last4,
      metadata: { method: input.method, reason_code: input.reasonCode },
    });

    await enqueueOutboxNotification(db, {
      user_id: input.patientId,
      channel: 'push',
      template: 'emergency_break_glass',
      payload: { method: input.method },
    });

    const parsedProf = await buildClosedProfile(sessionDoc);
    return {
      result: 'match' as const,
      session: {
        id: sessionDoc.id,
        expires_at: sessionDoc.expires_at,
        low_confidence: sessionDoc.low_confidence,
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

        const db = requireDb(deps);
        const top = await matchFaceTemplates(db, analysis.template.vector, {
          keyVersion: analysis.transform_key_version,
          limit: 5,
        });

        const first = top[0];
        const second = top[1];
        const margin =
          first !== undefined && second !== undefined ? first.score - second.score : 1.0;
        const decision = decideMatch(first?.score, margin, deps.env);

        await writeAuditLog(db, auth, {
          action: 'FACE_IDENTIFY_ATTEMPT',
          resourceType: 'emergency_identify',
          metadata: { result: decision, liveness_passed: true },
        });

        if (decision === 'no_match' || !first) {
          res.status(200).json({
            result: 'no_match' as const,
            fallbacks: ['emergency_card_qr', 'national_id_search'] as const,
          });
          return;
        }

        if (decision === 'possible_match') {
          const candidates = [];
          for (const cand of top.slice(0, 2)) {
            const pSnap = await db.collection(COLLECTIONS.patients).doc(cand.patient_id).get();
            if (!pSnap.exists) continue;
            const p = pSnap.data() as PatientDoc;
            const candToken = randomUUID();
            await deps.redis.set(
              `emerg:cand:${candToken}`,
              JSON.stringify({
                paramedicId: auth.userId,
                patientId: cand.patient_id,
                similarity: cand.score,
              }),
              'EX',
              120,
            );
            candidates.push({
              candidate_token: candToken,
              sex: p.sex,
              age_band: ageBandOf(p.date_of_birth),
            });
          }

          res.status(200).json({
            result: 'possible_match' as const,
            candidates,
            candidate_tokens_expire_in: 120,
          });
          return;
        }

        const matched = await openSessionAndPreview(auth, {
          patientId: first.patient_id,
          method: 'face',
          matchScore: first.score,
          lowConfidence: false,
          reasonCode,
          incidentRef,
        });
        res.status(200).json(matched);
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
        for (const f of files) f.buffer.fill(0);
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
        if (!raw) throw new AppError('EMERG_NO_MATCH', { detail: 'candidate_token_expired' });
        await deps.redis.del(`emerg:cand:${body.candidate_token}`);

        const cand = JSON.parse(raw) as {
          paramedicId: string;
          patientId: string;
          similarity: number;
        };
        if (cand.paramedicId !== auth.userId) {
          throw new AppError('RBAC_FORBIDDEN');
        }

        const matched = await openSessionAndPreview(auth, {
          patientId: cand.patientId,
          method: 'face',
          matchScore: cand.similarity,
          lowConfidence: true,
          reasonCode: body.reason_code,
          incidentRef: body.incident_ref,
        });
        res.status(200).json(matched);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/emergency/identify/card',
    requirePermission('emergency:identify'),
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
          throw new AppError('VALIDATION_FAILED', { statusOverride: 422, detail: 'invalid_emergency_card' });
        }

        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.patients)
          .where('mrn', '==', verified.mrn)
          .limit(1)
          .get();
        if (snap.empty) {
          res.status(200).json({
            result: 'no_match' as const,
            fallbacks: ['national_id_search'] as const,
          });
          return;
        }
        const patient = snap.docs[0]!.data() as PatientDoc;
        const matched = await openSessionAndPreview(auth, {
          patientId: patient.id,
          method: 'emergency_card_qr',
          matchScore: null,
          lowConfidence: false,
          reasonCode: body.reason_code,
          incidentRef: body.incident_ref,
        });
        res.status(200).json({ ...matched, card_expired: verified.expired });
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
        const bidx = deps.fieldCipher
          .blindIndex(`${body.id_document_type}:${body.id_document_number}`, 'id_document')
          .toString('hex');

        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.patients)
          .where('id_document_blind_index', '==', bidx)
          .limit(1)
          .get();
        if (snap.empty) {
          res.status(200).json({
            result: 'no_match' as const,
            fallbacks: ['emergency_card_qr'] as const,
          });
          return;
        }
        const patient = snap.docs[0]!.data() as PatientDoc;
        const matched = await openSessionAndPreview(auth, {
          patientId: patient.id,
          method: 'manual_search',
          matchScore: null,
          lowConfidence: false,
          reasonCode: body.reason_code,
          incidentRef: body.incident_ref,
        });
        res.status(200).json(matched);
      } catch (err) {
        next(err);
      }
    },
  );

  async function requireActiveSession(sessionId: string, paramedicId: string): Promise<EmergencySessionDoc> {
    const db = requireDb(deps);
    const snap = await db.collection(COLLECTIONS.emergencySessions).doc(sessionId).get();
    if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
    const session = snap.data() as EmergencySessionDoc;
    if (session.paramedic_id !== paramedicId) throw new AppError('RESOURCE_NOT_FOUND');
    if (session.closed_at || new Date(session.expires_at).getTime() <= Date.now()) {
      throw new AppError('EMERG_SESSION_EXPIRED');
    }
    return session;
  }

  router.get(
    '/emergency/sessions/:sessionId/profile',
    requirePermission('emergency_profile:read:session'),
    validate({ params: EmergencySessionParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { sessionId } = res.locals.validated!.params as { sessionId: string };
        const session = await requireActiveSession(sessionId, auth.userId);
        const profile = await buildClosedProfile(session);

        await writeAuditLog(requireDb(deps), auth, {
          action: 'EMERGENCY_PROFILE_READ',
          resourceType: 'emergency_session',
          resourceId: sessionId,
          patientId: session.patient_id,
          patientMrnLast4: session.patient_mrn_last4,
        });

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
        const session = await requireActiveSession(sessionId, auth.userId);
        const db = requireDb(deps);

        const snap = await db
          .collection(COLLECTIONS.emergencyContacts)
          .where('patient_id', '==', session.patient_id)
          .where('share_with_emergency', '==', true)
          .get();

        if (snap.empty) {
          throw new AppError('EMERG_CONTACTS_NOT_SHARED');
        }

        const contacts = snap.docs
          .map((d) => d.data() as EmergencyContactDoc)
          .sort((a, b) => a.priority - b.priority)
          .map((c) => ({
            full_name: deps.fieldCipher.decrypt(
              c.full_name_enc,
              aad('emergency_contacts', 'full_name_enc', c.id),
            ),
            relationship: c.relationship,
            phone: deps.fieldCipher.decrypt(
              c.phone_enc,
              aad('emergency_contacts', 'phone_enc', c.id),
            ),
            priority: c.priority,
          }));

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
        const session = await requireActiveSession(sessionId, auth.userId);
        const newExpires = new Date(Date.now() + 60 * 60_000).toISOString();
        const db = requireDb(deps);
        await db.collection(COLLECTIONS.emergencySessions).doc(session.id).update({
          expires_at: newExpires,
        });
        res.status(200).json({ expires_at: newExpires });
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
        const session = await requireActiveSession(sessionId, auth.userId);
        const db = requireDb(deps);
        await db.collection(COLLECTIONS.emergencySessions).doc(session.id).update({
          closed_at: new Date().toISOString(),
        });
        res.status(204).end();
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
        const body = res.locals.validated!.body as { events: Array<{ event_id: string }> };
        const db = requireDb(deps);
        for (const ev of body.events) {
          await writeAuditLog(db, auth, {
            action: 'OFFLINE_CARD_VIEWED',
            resourceType: 'emergency_card',
            resourceId: ev.event_id,
          });
        }
        res.status(202).json({ accepted: body.events.length, rejected: 0 });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
