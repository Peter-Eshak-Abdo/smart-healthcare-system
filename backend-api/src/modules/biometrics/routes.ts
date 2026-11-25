import { randomUUID } from 'node:crypto';
import {
  BiometricChallengeQuerySchema,
  BiometricClientSignalsSchema,
  BiometricFaceEnrollBodySchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import multer from 'multer';
import type { AppDeps } from '../../app-deps.js';
import { matchFaceTemplates } from '../../firebase/biometric-match.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import { COLLECTIONS, type ConsentDoc } from '../../firebase/firestore-types.js';
import { mapFaceAnalysisFailure } from '../../integrations/ai-client.js';
import { requirePermission, requireStepUp } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { AppError } from '../../shared/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 5 },
});

function isJpegBuffer(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export interface BiometricAnalyzerPort {
  analyzeEnrollmentFrames(input: {
    frames: Buffer[];
    sequence: string[];
    clientSignals: { blink_detected: boolean; yaw_deltas: number[]; capture_ms: number };
  }): Promise<{
    transformed_template: number[];
    model_version: string;
    transform_key_version: number;
    quality_score: number;
    liveness_score: number;
  }>;
}

export function biometricRoutes(
  deps: AppDeps,
  analyzerPort?: BiometricAnalyzerPort,
): Router {
  const router = Router();

  router.get(
    '/biometric/challenge',
    validate({ query: BiometricChallengeQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { purpose } = res.locals.validated!.query as { purpose: 'enroll' | 'verify' };
        const challengeId = randomUUID();
        const sequence = ['blink', 'turn_right', 'turn_left'];
        const expiresIn = 90;

        await deps.redis.set(
          `bio:ch:${challengeId}`,
          JSON.stringify({ userId: auth.userId, purpose, sequence }),
          'EX',
          expiresIn,
        );

        res.status(200).json({
          challenge_id: challengeId,
          sequence,
          expires_in: expiresIn,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/patients/me/biometrics/face',
    requirePermission('biometric:enroll:self'),
    upload.array('frames', 5),
    idempotencyMiddleware(deps.redis, { required: true }),
    async (req, res, next) => {
      const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
      try {
        const auth = res.locals.auth!;
        const body = BiometricFaceEnrollBodySchema.parse(req.body);
        const signalsRaw =
          typeof body.client_signals === 'string'
            ? JSON.parse(body.client_signals)
            : body.client_signals;
        const clientSignals = BiometricClientSignalsSchema.parse(signalsRaw);

        if (files.length < 3 || files.length > 5) {
          throw new AppError('VALIDATION_FAILED', { detail: 'expected_3_to_5_frames' });
        }
        for (const f of files) {
          if (!isJpegBuffer(f.buffer)) {
            throw new AppError('VALIDATION_FAILED', { detail: 'jpeg_frames_required' });
          }
        }

        const db = requireDb(deps);
        const consentSnap = await db
          .collection(COLLECTIONS.consents)
          .where('patient_id', '==', auth.userId)
          .where('type', '==', 'biometric_face')
          .get();
        const hasConsent = consentSnap.docs.some((d) => (d.data() as ConsentDoc).granted === true);
        if (!hasConsent) {
          throw new AppError('BIO_CONSENT_REQUIRED');
        }

        const chRaw = await deps.redis.get(`bio:ch:${body.challenge_id}`);
        if (!chRaw) {
          throw new AppError('BIO_LIVENESS_FAILED', { detail: 'biometric_challenge_expired' });
        }
        await deps.redis.del(`bio:ch:${body.challenge_id}`);

        const ch = JSON.parse(chRaw) as { userId: string; sequence: string[] };
        if (ch.userId !== auth.userId) {
          throw new AppError('BIO_LIVENESS_FAILED', { detail: 'challenge_user_mismatch' });
        }

        const analyzer: BiometricAnalyzerPort = analyzerPort ?? {
          async analyzeEnrollmentFrames({ frames, sequence }) {
            const analysis = await deps.aiClient.analyzeFace({
              mode: 'enroll',
              livenessMode: 'active',
              challenge: {
                challenge_id: body.challenge_id,
                sequence,
              },
              frames,
              priority: 'general',
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
            return {
              transformed_template: analysis.template.vector,
              model_version: analysis.model_version,
              transform_key_version: analysis.transform_key_version,
              quality_score: analysis.quality.score,
              liveness_score: analysis.liveness.score,
            };
          },
        };

        const analysis = await analyzer.analyzeEnrollmentFrames({
          frames: files.map((f) => f.buffer),
          sequence: ch.sequence,
          clientSignals,
        });

        const matches = await matchFaceTemplates(db, analysis.transformed_template, {
          keyVersion: analysis.transform_key_version,
          limit: 3,
        });
        const duplicateOther = matches.find(
          (m) => m.patient_id !== auth.userId && m.score >= deps.env.FACE_MATCH_ACCEPT,
        );
        if (duplicateOther) {
          throw new AppError('BIO_ALREADY_ENROLLED');
        }

        const templateId = randomUUID();
        const enrolledAt = new Date().toISOString();
        await db.collection(COLLECTIONS.biometricTemplates).doc(templateId).set({
          id: templateId,
          patient_id: auth.userId,
          status: 'active',
          key_version: analysis.transform_key_version,
          model_version: analysis.model_version,
          transformed_vector: analysis.transformed_template,
          quality_score: analysis.quality_score,
          liveness_score: analysis.liveness_score,
          enrolled_at: enrolledAt,
          deleted_at: null,
        });

        await writeAuditLog(db, auth, {
          action: 'FACE_ENROLLED',
          resourceType: 'biometric_template',
          resourceId: templateId,
          patientId: auth.userId,
          metadata: { model_version: analysis.model_version },
        });

        res.status(201).json({
          enrolled: true as const,
          template_count: 1,
          model_version: analysis.model_version,
          enrolled_at: enrolledAt,
        });
      } catch (err) {
        if (err instanceof AppError && err.code.startsWith('BIO_')) {
          await deps.rateLimit
            .consume('biometric_enroll_fail', res.locals.auth?.userId ?? req.ip ?? 'anon', 1)
            .catch(() => undefined);
        }
        next(err);
      } finally {
        for (const f of files) {
          f.buffer.fill(0);
        }
      }
    },
  );

  router.delete(
    '/patients/me/biometrics/face',
    requirePermission('biometric:delete:self'),
    requireStepUp(deps.stepUp, 'biometric_delete'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.biometricTemplates)
          .where('patient_id', '==', auth.userId)
          .where('status', '==', 'active')
          .get();

        const nowIso = new Date().toISOString();
        const batch = db.batch();
        for (const doc of snap.docs) {
          batch.update(doc.ref, { status: 'deleted', deleted_at: nowIso });
        }
        await batch.commit();

        await writeAuditLog(db, auth, {
          action: 'FACE_TEMPLATES_DELETED',
          resourceType: 'biometric_template',
          patientId: auth.userId,
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
