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
import { encryptField } from '../../security/crypto.js';
import { validateP256Spki } from '../../security/step-up.js';
import { AppError } from '../../shared/errors.js';

export function publicAuthRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/auth/register',
    validate({ body: RegisterAccountRequestSchema }),
    async (req, res, next) => {
      try {
        const body = res.locals.validated!.body as RegisterAccountRequest;
        const db = requireDb(deps);
        const firebaseAuth = deps.firebaseAuth;
        if (!firebaseAuth) {
          throw new AppError('INTERNAL_ERROR', { detail: 'firebase_auth_not_configured' });
        }

        const status: 'active' | 'pending' = body.role === 'patient' ? 'active' : 'pending';
        const nowIso = new Date().toISOString();

        const userRecord = await firebaseAuth.createUser({
          email: body.email,
          phoneNumber: body.phone,
          password: body.password,
          displayName: body.full_name,
        });

        await firebaseAuth.setCustomUserClaims(userRecord.uid, {
          role: body.role,
          status,
        });

        await db.runTransaction(async (tx) => {
          tx.set(db.collection(COLLECTIONS.users).doc(userRecord.uid), {
            id: userRecord.uid,
            role: body.role,
            status,
            session_epoch: 1,
            full_name: body.full_name,
            email: body.email,
            phone: body.phone,
            preferred_locale: body.preferred_locale,
            created_at: nowIso,
            updated_at: nowIso,
          });

          const nationalIdEnc = encryptField(
            deps.env.FIELD_ENCRYPTION_KEY,
            body.national_id,
            `${COLLECTIONS.patients}|national_id_enc|${userRecord.uid}`,
          );

          if (body.role === 'patient') {
            tx.set(db.collection(COLLECTIONS.patients).doc(userRecord.uid), {
              id: userRecord.uid,
              full_name: body.full_name,
              national_id_enc: nationalIdEnc,
              date_of_birth: body.date_of_birth,
              sex: body.sex,
              blood_type: body.blood_type ?? null,
              created_at: nowIso,
              updated_at: nowIso,
            });
          } else if (
            body.role === 'doctor' ||
            body.role === 'pharmacist' ||
            body.role === 'paramedic'
          ) {
            tx.set(db.collection(COLLECTIONS.practitioners).doc(userRecord.uid), {
              id: userRecord.uid,
              practitioner_type: body.role,
              license_number: body.license_number ?? '',
              license_authority: null,
              license_status: 'pending',
              license_expires_at: nowIso,
              license_status_changed_at: nowIso,
              specialty_code: body.specialty_code ?? null,
              national_id_enc: nationalIdEnc,
              created_at: nowIso,
              updated_at: nowIso,
            });
          }
        });

        res.status(201).json({
          user_id: userRecord.uid,
          role: body.role,
          status,
          created_at: nowIso,
        });
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
      await db.collection(COLLECTIONS.users).doc(auth.userId).update({
        session_epoch: auth.sessionEpoch + 1,
        updated_at: new Date().toISOString(),
      });
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
