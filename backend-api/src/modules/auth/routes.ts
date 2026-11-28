import {
  DeviceIdParamSchema,
  RegisterAccountRequestSchema,
  RegisterDeviceRequestSchema,
  StepUpChallengeRequestSchema,
  StepUpVerifyRequestSchema,
  type RegisterAccountRequest,
} from '@smarthealth/contracts';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import { COLLECTIONS } from '../../firebase/firestore-types.js';
import { requireRecentAuth, requireStepUp } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { validateP256Spki } from '../../security/step-up.js';
import { AppError } from '../../shared/errors.js';
import { registerAccount } from './register.js';

export function publicAuthRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/auth/register',
    validate({ body: RegisterAccountRequestSchema }),
    async (_req, res, next) => {
      try {
        const body = res.locals.validated!.body as RegisterAccountRequest;
        const out = await registerAccount(deps, body);
        res.status(201).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export function authRoutes(deps: AppDeps): Router {
  const router = Router();

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
        const db = requireDb(deps);
        const docRef = db.collection(COLLECTIONS.devices).doc(body.device_id);
        const nowIso = new Date().toISOString();

        const registeredAt = await db.runTransaction(async (tx) => {
          const snap = await tx.get(docRef);
          if (snap.exists && snap.data()?.user_id !== auth.userId) {
            throw new AppError('VALIDATION_FAILED', {
              statusOverride: 409,
              detail: 'device_already_registered_to_other_user',
            });
          }

          tx.set(docRef, {
            id: body.device_id,
            user_id: auth.userId,
            platform: body.platform,
            model: body.model,
            public_key_spki_b64: spki.toString('base64'),
            key_algorithm: body.key_algorithm,
            biometric_bound: body.biometric_bound,
            revoked_at: null,
            registered_at: snap.exists ? String(snap.data()?.registered_at ?? nowIso) : nowIso,
            updated_at: nowIso,
          });
          return snap.exists ? String(snap.data()?.registered_at ?? nowIso) : nowIso;
        });

        await writeAuditLog(db, auth, {
          action: 'DEVICE_REGISTERED',
          resourceType: 'device',
          resourceId: body.device_id,
          metadata: { platform: body.platform },
        });

        res.status(201).json({
          device_id: body.device_id,
          registered_at: registeredAt,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/auth/devices/:deviceId',
    requireStepUp(deps.stepUp, 'logout_all'),
    validate({ params: DeviceIdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { deviceId } = res.locals.validated!.params as { deviceId: string };
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.devices).doc(deviceId);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.user_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({ revoked_at: new Date().toISOString() });
        await writeAuditLog(db, auth, {
          action: 'DEVICE_REVOKED',
          resourceType: 'device',
          resourceId: deviceId,
        });
        res.status(204).end();
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
          purpose?: 'pickup_token' | 'dispense' | 'view_emergency_card_manage' | 'biometric_delete' | 'logout_all';
        };
        const db = requireDb(deps);
        const devSnap = await db.collection(COLLECTIONS.devices).doc(body.device_id).get();
        if (
          !devSnap.exists ||
          devSnap.data()?.user_id !== auth.userId ||
          devSnap.data()?.revoked_at != null
        ) {
          throw new AppError('AUTH_STEP_UP_INVALID', { detail: 'device_not_active' });
        }

        const spkiB64 = String(devSnap.data()?.public_key_spki_b64 ?? '');
        const out = await deps.stepUp.createChallenge({
          userId: auth.userId,
          deviceId: body.device_id,
          purpose: body.purpose ?? 'pickup_token',
          publicKeySpki: Buffer.from(spkiB64, 'base64'),
        });
        res.status(200).json(out);
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
          device_id: string;
          signature_b64: string;
        };
        const db = requireDb(deps);
        const devSnap = await db.collection(COLLECTIONS.devices).doc(body.device_id).get();
        if (
          !devSnap.exists ||
          devSnap.data()?.user_id !== auth.userId ||
          devSnap.data()?.revoked_at != null
        ) {
          throw new AppError('AUTH_STEP_UP_INVALID', { detail: 'device_not_active' });
        }

        const verified = await deps.stepUp.verifyChallenge({
          userId: auth.userId,
          challengeId: body.challenge_id,
          signatureB64: body.signature_b64,
        });

        await writeAuditLog(db, auth, {
          action: 'STEP_UP_VERIFIED',
          resourceType: 'device',
          resourceId: body.device_id,
        });

        res.status(200).json(verified);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/auth/logout', async (_req, res, next) => {
    try {
      const auth = res.locals.auth!;
      const db = requireDb(deps);
      const nextEpoch = auth.sessionEpoch + 1;
      await db.collection(COLLECTIONS.users).doc(auth.userId).update({
        session_epoch: nextEpoch,
        updated_at: new Date().toISOString(),
      });
      // Keep the custom claim in lock-step with Firestore, otherwise every token minted after a
      // logout would carry an older epoch and be rejected forever with AUTH_SESSION_REVOKED.
      await deps.firebaseAdmin.setCustomClaims(auth.userId, { session_epoch: nextEpoch });
      await deps.firebaseAdmin.signOutUserGlobal(auth.userId);
      await deps.authContext.invalidate(auth.userId);
      await writeAuditLog(db, auth, {
        action: 'AUTH_LOGOUT',
        resourceType: 'user',
        resourceId: auth.userId,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
