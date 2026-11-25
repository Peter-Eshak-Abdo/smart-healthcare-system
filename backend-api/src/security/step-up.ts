import { createPublicKey, randomBytes, randomUUID, verify as cryptoVerify } from 'node:crypto';
import type { StepUpPurpose } from '@smarthealth/contracts';
import { jwtVerify } from 'jose';
import { AppError } from '../shared/errors.js';
import type { Keyring } from './crypto/keyring.js';
import type { Signer } from './crypto/signer.js';

export interface StepUpRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number, flag?: 'NX'): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
}

export interface StoredChallenge {
  userId: string;
  deviceId: string;
  purpose: StepUpPurpose;
  nonceB64: string;
  publicKeySpkiB64: string;
}

const SINGLE_USE_PURPOSES = new Set<StepUpPurpose>(['logout_all', 'biometric_delete']);

export interface StepUpService {
  createChallenge(input: {
    userId: string;
    deviceId: string;
    purpose: StepUpPurpose;
    publicKeySpki: Buffer;
  }): Promise<{ challenge_id: string; nonce_b64: string; expires_at: string }>;
  verifyChallenge(input: {
    userId: string;
    challengeId: string;
    signatureB64: string;
  }): Promise<{ step_up_token: string; expires_in: number; purpose: StepUpPurpose }>;
  verifyToken(token: string, expectedUserId: string, expectedPurpose: StepUpPurpose): Promise<void>;
}

export function buildStepUpSignedPayload(
  nonceB64: string,
  purpose: StepUpPurpose,
  deviceId: string,
): Buffer {
  const sep = Buffer.from([0x00]);
  return Buffer.concat([
    Buffer.from('SH-STEPUP-v1', 'utf8'),
    sep,
    Buffer.from(nonceB64, 'base64'),
    sep,
    Buffer.from(purpose, 'utf8'),
    sep,
    Buffer.from(deviceId, 'utf8'),
  ]);
}

export function validateP256Spki(spkiB64: string): Buffer {
  const der = Buffer.from(spkiB64, 'base64');
  try {
    const keyObj = createPublicKey({ key: der, format: 'der', type: 'spki' });
    if (keyObj.asymmetricKeyType !== 'ec') {
      throw new Error('Expected EC key');
    }
    return der;
  } catch (err) {
    throw new AppError('VALIDATION_FAILED', {
      detail: 'invalid_device_public_key',
      cause: err,
    });
  }
}

export function createStepUpService(
  keyring: Keyring,
  signer: Signer,
  redis: StepUpRedis,
): StepUpService {
  return {
    async createChallenge(input) {
      const challengeId = randomUUID();
      const nonceB64 = randomBytes(32).toString('base64');
      const record: StoredChallenge = {
        userId: input.userId,
        deviceId: input.deviceId,
        purpose: input.purpose,
        nonceB64,
        publicKeySpkiB64: input.publicKeySpki.toString('base64'),
      };
      await redis.set(`stepup:ch:${challengeId}`, JSON.stringify(record), 'EX', 60);
      return {
        challenge_id: challengeId,
        nonce_b64: nonceB64,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      };
    },

    async verifyChallenge(input) {
      const key = `stepup:ch:${input.challengeId}`;
      const raw = await redis.get(key);
      if (!raw) {
        throw new AppError('AUTH_STEP_UP_INVALID', {
          statusOverride: 410,
          detail: 'challenge_expired_or_missing',
        });
      }
      await redis.del(key);

      const stored = JSON.parse(raw) as StoredChallenge;
      if (stored.userId !== input.userId) {
        throw new AppError('AUTH_STEP_UP_INVALID', { detail: 'challenge_user_mismatch' });
      }

      const message = buildStepUpSignedPayload(stored.nonceB64, stored.purpose, stored.deviceId);
      const signature = Buffer.from(input.signatureB64, 'base64');
      const publicKey = createPublicKey({
        key: Buffer.from(stored.publicKeySpkiB64, 'base64'),
        format: 'der',
        type: 'spki',
      });

      const valid = cryptoVerify('sha256', message, publicKey, signature);
      if (!valid) {
        throw new AppError('AUTH_STEP_UP_INVALID', { detail: 'invalid_signature' });
      }

      const token = await signer.signStepUpJwt({
        sub: stored.userId,
        did: stored.deviceId,
        pur: stored.purpose,
        jti: randomUUID(),
      });

      return {
        step_up_token: token,
        expires_in: 300,
        purpose: stored.purpose,
      };
    },

    async verifyToken(token, expectedUserId, expectedPurpose) {
      try {
        const { payload } = await jwtVerify(token, keyring.internalJwtKey.publicKey, {
          issuer: 'backend-api',
          audience: 'backend-api-stepup',
          algorithms: ['EdDSA'],
        });
        if (payload.sub !== expectedUserId || payload.pur !== expectedPurpose) {
          throw new AppError('AUTH_STEP_UP_INVALID', { detail: 'step_up_scope_mismatch' });
        }
        if (SINGLE_USE_PURPOSES.has(expectedPurpose)) {
          if (typeof payload.jti !== 'string') {
            throw new AppError('AUTH_STEP_UP_INVALID');
          }
          const consumed = await redis.set(`stepup:jti:${payload.jti}`, '1', 'EX', 300, 'NX');
          if (!consumed) {
            throw new AppError('AUTH_STEP_UP_INVALID', { detail: 'step_up_token_replayed' });
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('AUTH_STEP_UP_INVALID', { cause: err });
      }
    },
  };
}
