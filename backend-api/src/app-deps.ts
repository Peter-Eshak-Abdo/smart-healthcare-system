import { deleteApp, type App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import type { Logger } from 'pino';
import type { AppEnv } from './config/env.js';
import {
  createFirebaseBundle,
  type FirebaseAdminPort,
} from './firebase/firebase-admin.js';
import { AiClient, type AiClientPort } from './integrations/ai-client.js';
import { createRedisClient, type RedisClientLike } from './integrations/redis.js';
import { createRateLimitService, type RateLimitService } from './middleware/rate-limit.js';
import { createAuthContextService, type AuthContextService } from './security/auth-context.js';
import { createFieldCipher, type FieldCipher } from './security/crypto/field-cipher.js';
import { createKeyring, type Keyring } from './security/crypto/keyring.js';
import { createSigner, type Signer } from './security/crypto/signer.js';
import { createInternalJwtSigner, type InternalJwtSigner } from './security/internal-jwt.js';
import { createAccessTokenVerifier, type AccessTokenVerifier } from './security/jwt.js';
import { createStepUpService, type StepUpService } from './security/step-up.js';
import { createLogger } from './shared/logger.js';

export interface AiReadinessPort {
  ping(): Promise<boolean>;
}

export interface AppDeps {
  env: AppEnv;
  logger: Logger;
  db: Firestore | null;
  fbAuth: Auth | null;
  storage: Storage | null;
  firebaseAdmin: FirebaseAdminPort;
  redis: RedisClientLike;
  keyring: Keyring;
  fieldCipher: FieldCipher;
  signer: Signer;
  verifyJwt: AccessTokenVerifier;
  authContext: AuthContextService;
  stepUp: StepUpService;
  internalJwt: InternalJwtSigner;
  rateLimit: RateLimitService;
  aiReadiness?: AiReadinessPort | undefined;
  aiClient: AiClientPort;
  close: () => Promise<void>;
}

export function createAppDeps(
  env: AppEnv,
  overrides: Partial<AppDeps> = {},
): AppDeps {
  const logger =
    overrides.logger ?? createLogger(env.APP_ENV === 'production' ? 'info' : 'debug');

  const needsFirebase =
    overrides.db === undefined ||
    overrides.fbAuth === undefined ||
    overrides.storage === undefined ||
    overrides.firebaseAdmin === undefined;

  const fb = needsFirebase ? createFirebaseBundle(env) : null;
  const fbApp: App | null = fb?.app ?? null;
  const db = overrides.db !== undefined ? overrides.db : (fb?.db ?? null);
  const fbAuth = overrides.fbAuth !== undefined ? overrides.fbAuth : (fb?.auth ?? null);
  const storage = overrides.storage !== undefined ? overrides.storage : (fb?.storage ?? null);
  const firebaseAdmin =
    overrides.firebaseAdmin ??
    fb?.adminPort ?? {
      async inviteStaffUser() {
        throw new Error('Firebase Admin not configured');
      },
      async setCustomClaims() {},
      async signOutUserGlobal() {},
      async getUserEmailAndMfa() {
        return { email: null, phone: null, mfaEnrolled: false };
      },
      async requestPhoneChange() {},
      async verifyIdToken() {
        throw new Error('Firebase Admin not configured');
      },
    };

  const redisBundle = overrides.redis
    ? { raw: null, client: overrides.redis }
    : createRedisClient(env.REDIS_URL, logger);

  const keyring = overrides.keyring ?? createKeyring(env);
  const fieldCipher = overrides.fieldCipher ?? createFieldCipher(keyring);
  const signer = overrides.signer ?? createSigner(keyring);
  const verifyJwt = overrides.verifyJwt ?? createAccessTokenVerifier(env, firebaseAdmin);

  const authContext =
    overrides.authContext ??
    (db
      ? createAuthContextService(db, redisBundle.client)
      : {
          async load() {
            return null;
          },
          async invalidate() {
            // noop when Firestore is unavailable
          },
        });

  const stepUp = overrides.stepUp ?? createStepUpService(keyring, signer, redisBundle.client);
  const internalJwt = overrides.internalJwt ?? createInternalJwtSigner(keyring);
  const rateLimit = overrides.rateLimit ?? createRateLimitService(redisBundle.raw);
  const aiClient = overrides.aiClient ?? new AiClient(env, internalJwt);

  return {
    env,
    logger,
    db,
    fbAuth,
    storage,
    firebaseAdmin,
    redis: redisBundle.client,
    keyring,
    fieldCipher,
    signer,
    verifyJwt,
    authContext,
    stepUp,
    internalJwt,
    rateLimit,
    aiClient,
    aiReadiness: overrides.aiReadiness,
    async close() {
      if (fbApp) await deleteApp(fbApp).catch(() => undefined);
      await redisBundle.client.quit();
    },
  };
}
