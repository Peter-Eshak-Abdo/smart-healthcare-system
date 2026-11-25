import { randomUUID } from 'node:crypto';
import {
  BiometricChallengeQuerySchema,
  BiometricClientSignalsSchema,
  BiometricFaceEnrollBodySchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import multer from 'multer';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { mapFaceAnalysisFailure } from '../../integrations/ai-client.js';
import { requirePermission, requireStepUp } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { AppError } from '../../shared/errors.js';

export interface BiometricFaceAnalyzeResult {
  transformed_template: number[];
  model_version: string;
  transform_key_version: number;
  quality_score: number;
  liveness_score: number;
}

export interface BiometricAnalyzerPort {
  analyzeEnrollmentFrames(input: {
    frames: Buffer[];
    sequence: string[];
    clientSignals: { blink_detected: boolean; yaw_deltas: number[]; capture_ms: number };
  }): Promise<BiometricFaceAnalyzeResult>;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 300 * 1024,
    files: 5,
  },
});

const LIVENESS_SEQUENCE = ['blink', 'turn_left', 'turn_right'] as const;

function isJpegBuffer(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export function biometricRoutes(
  deps: AppDeps,
  analyzerPort?: BiometricAnalyzerPort,
): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.get(
    '/biometric/challenge',
    validate({ query: BiometricChallengeQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { purpose } = res.locals.validated!.query as { purpose: 'enroll' | 'verify' };
        const challengeId = randomUUID();
        const sequence = [...LIVENESS_SEQUENCE];

        await deps.redis.set(
          `bio:ch:${challengeId}`,
          JSON.stringify({ userId: auth.userId, purpose, sequence }),
          'EX',
          60,
        );

        res.status(200).json({
          challenge_id: challengeId,
          sequence,
          expires_in: 60,
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

        const pools = requirePools();
        const hasConsent = await withUserTx(pools, auth, async (tx) => {
          const r = await sql<{ granted: boolean }>`
            select private.has_consent(${auth.userId}::uuid, 'biometric_face') as granted
          `.execute(tx);
          return r.rows[0]?.granted ?? false;
        });

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
            if (!analysis.face_detected || analysis.face_count !== 1 || !analysis.quality.passed || !analysis.liveness.passed || !analysis.template) {
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

        const vecLiteral = `[${analysis.transformed_template.join(',')}]`;
        const result = await withUserTx(pools, auth, async (tx) => {
          const dup = await sql<{ exists: boolean }>`
            select private.face_duplicate_exists(
              ${vecLiteral}::extensions.vector,
              ${analysis.model_version},
              ${analysis.transform_key_version},
              ${deps.env.FACE_MATCH_ACCEPT}
            ) as exists
          `.execute(tx);

          if (dup.rows[0]?.exists) {
            throw new AppError('BIO_ALREADY_ENROLLED');
          }

          await sql`
            select private.enroll_face_template(
              ${vecLiteral}::extensions.vector,
              ${analysis.model_version},
              ${analysis.transform_key_version},
              ${analysis.quality_score},
              ${analysis.liveness_score}
            )
          `.execute(tx);

          await writeAuditLog(tx, auth, {
            action: 'FACE_ENROLLED',
            resourceType: 'biometric_template',
            patientId: auth.userId,
            metadata: { model_version: analysis.model_version },
          });

          return {
            enrolled: true as const,
            template_count: 1,
            model_version: analysis.model_version,
            enrolled_at: new Date().toISOString(),
          };
        });

        res.status(201).json(result);
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
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          await sql`select private.delete_my_face_templates()`.execute(tx);
          await writeAuditLog(tx, auth, {
            action: 'FACE_TEMPLATES_DELETED',
            resourceType: 'biometric_template',
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
