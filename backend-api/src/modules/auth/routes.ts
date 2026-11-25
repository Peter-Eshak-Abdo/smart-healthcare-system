import {
  DeviceIdParamSchema,
  RegisterDeviceRequestSchema,
  StepUpChallengeRequestSchema,
  StepUpVerifyRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps, SupabaseAdminPort } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { createSupabaseAdmin } from '../../integrations/supabase-admin.js';
import { requireRecentAuth, requireStepUp } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { validateP256Spki } from '../../security/step-up.js';
import { AppError } from '../../shared/errors.js';

export function getAuthSupabasePort(deps: AppDeps): SupabaseAdminPort {
  return deps.supabaseAdmin ?? createSupabaseAdmin(deps.env);
}

export function authRoutes(deps: AppDeps): Router {
  const router = Router();
  const sbAdmin = getAuthSupabasePort(deps);

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.post(
    '/auth/devices',
    requireRecentAuth(300),
    validate({ body: RegisterDeviceRequestSchema }),
    async (req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          device_id: string;
          platform: 'android' | 'ios' | 'web';
          model: string;
          public_key_spki_b64: string;
          key_algorithm: 'ES256';
          biometric_bound: boolean;
        };

        const spki = validateP256Spki(body.public_key_spki_b64);
        const pools = requirePools();

        const registeredAt = await withUserTx(pools, auth, async (tx) => {
          const existing = await tx
            .selectFrom('app.devices')
            .select(['user_id', 'revoked_at'])
            .where('id', '=', body.device_id)
            .executeTakeFirst();

          if (existing && existing.user_id !== auth.userId) {
            throw new AppError('VALIDATION_FAILED', {
              statusOverride: 409,
              detail: 'device_already_registered_to_other_user',
            });
          }

          if (existing) {
            const updated = await tx
              .updateTable('app.devices')
              .set({
                platform: body.platform,
                model: body.model,
                public_key_spki: spki,
                key_algorithm: body.key_algorithm,
                biometric_bound: body.biometric_bound,
                revoked_at: null,
              })
              .where('id', '=', body.device_id)
              .where('user_id', '=', auth.userId)
              .returning('registered_at')
              .executeTakeFirstOrThrow();
            await writeAuditLog(tx, auth, {
              action: 'DEVICE_REGISTERED',
              resourceType: 'device',
              resourceId: body.device_id,
              metadata: { platform: body.platform, reregistered: true },
            });
            return updated.registered_at;
          }

          const inserted = await tx
            .insertInto('app.devices')
            .values({
              id: body.device_id,
              user_id: auth.userId,
              platform: body.platform,
              model: body.model,
              public_key_spki: spki,
              key_algorithm: body.key_algorithm,
              biometric_bound: body.biometric_bound,
            })
            .returning('registered_at')
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'DEVICE_REGISTERED',
            resourceType: 'device',
            resourceId: body.device_id,
            metadata: { platform: body.platform },
          });
          return inserted.registered_at;
        });

        res.status(201).json({
          device_id: body.device_id,
          registered_at: new Date(registeredAt).toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/auth/devices/:deviceId',
    validate({ params: DeviceIdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { deviceId } = res.locals.validated!.params as { deviceId: string };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const updated = await tx
            .updateTable('app.devices')
            .set({ revoked_at: sql`now()` })
            .where('id', '=', deviceId)
            .where('user_id', '=', auth.userId)
            .where('revoked_at', 'is', null)
            .returning('id')
            .executeTakeFirst();

          if (!updated) {
            throw new AppError('RESOURCE_NOT_FOUND', { detail: 'device_not_found' });
          }

          await writeAuditLog(tx, auth, {
            action: 'DEVICE_REVOKED',
            resourceType: 'device',
            resourceId: deviceId,
          });
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/auth/step-up/challenge',
    validate({ body: StepUpChallengeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          device_id: string;
          purpose: 'pickup_token' | 'dispense' | 'view_emergency_card_manage' | 'biometric_delete' | 'logout_all';
        };
        const pools = requirePools();

        const device = await withUserTx(pools, auth, async (tx) =>
          tx
            .selectFrom('app.devices')
            .select(['id', 'public_key_spki', 'revoked_at'])
            .where('id', '=', body.device_id)
            .where('user_id', '=', auth.userId)
            .where('revoked_at', 'is', null)
            .executeTakeFirst(),
        );

        if (!device) {
          throw new AppError('AUTH_STEP_UP_INVALID', {
            statusOverride: 403,
            detail: 'device_not_registered',
          });
        }

        const challenge = await deps.stepUp.createChallenge({
          userId: auth.userId,
          deviceId: device.id,
          purpose: body.purpose,
          publicKeySpki: Buffer.from(device.public_key_spki),
        });

        res.status(200).json(challenge);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/auth/step-up/verify',
    validate({ body: StepUpVerifyRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          challenge_id: string;
          signature_b64: string;
        };

        const result = await deps.stepUp.verifyChallenge({
          userId: auth.userId,
          challengeId: body.challenge_id,
          signatureB64: body.signature_b64,
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/auth/logout-all',
    requireStepUp(deps.stepUp, 'logout_all'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          await sql`select private.bump_my_session_epoch()`.execute(tx);
          await writeAuditLog(tx, auth, {
            action: 'SESSION_REVOKED_ALL',
            resourceType: 'profile',
            resourceId: auth.userId,
          });
        });

        await sbAdmin.signOutUserGlobal(auth.userId);
        await deps.authContext.invalidate(auth.userId);

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
