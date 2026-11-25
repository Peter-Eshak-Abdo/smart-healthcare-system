import type { Logger } from 'pino';
import type { AppEnv } from './config/env.js';
import { createDbPools, type DbPools } from './db/pool.js';
import { AiClient, type AiClientPort } from './integrations/ai-client.js';
import { createRedisClient, type RedisClientLike } from './integrations/redis.js';
import { createAuthContextService, type AuthContextService } from './security/auth-context.js';
import { createFieldCipher, type FieldCipher } from './security/crypto/field-cipher.js';
import { createKeyring, type Keyring } from './security/crypto/keyring.js';
import { createSigner, type Signer } from './security/crypto/signer.js';
import { createInternalJwtSigner, type InternalJwtSigner } from './security/internal-jwt.js';
import { createAccessTokenVerifier, type AccessTokenVerifier } from './security/jwt.js';
import { createStepUpService, type StepUpService } from './security/step-up.js';
import { createRateLimitService, type RateLimitService } from './middleware/rate-limit.js';
import { createLogger } from './shared/logger.js';

export interface SupabaseAccountSummary {
  email: string | null;
  phone: string | null;
  mfaEnrolled: boolean;
}

export interface SupabaseAdminPort {
  inviteStaffUser(input: { email: string; fullName: string; role: string }): Promise<{ id: string }>;
  signOutUserGlobal(userId: string): Promise<void>;
  getUserEmailAndMfa(userId: string): Promise<SupabaseAccountSummary>;
  requestPhoneChange(userId: string, phone: string): Promise<void>;
}

export interface AiReadinessPort {
  ping(): Promise<boolean>;
}

export interface AppDeps {
  env: AppEnv;
  logger: Logger;
  pools: DbPools | null;
  redis: RedisClientLike;
  keyring: Keyring;
  fieldCipher: FieldCipher;
  signer: Signer;
  verifyJwt: AccessTokenVerifier;
  authContext: AuthContextService;
  stepUp: StepUpService;
  internalJwt: InternalJwtSigner;
  rateLimit: RateLimitService;
  supabaseAdmin?: SupabaseAdminPort | undefined;
  aiReadiness?: AiReadinessPort | undefined;
  aiClient: AiClientPort;
  close: () => Promise<void>;
}

export function createAppDeps(
  env: AppEnv,
  overrides: Partial<AppDeps> = {},
): AppDeps {
  const logger = overrides.logger ?? createLogger(env.APP_ENV === 'production' ? 'info' : 'debug');
  const pools =
    overrides.pools !== undefined
      ? overrides.pools
      : env.DATABASE_URL
        ? createDbPools(env.DATABASE_URL)
        : null;

  const redisBundle = overrides.redis
    ? { raw: null, client: overrides.redis }
    : createRedisClient(env.REDIS_URL, logger);

  const keyring = overrides.keyring ?? createKeyring(env);
  const fieldCipher = overrides.fieldCipher ?? createFieldCipher(keyring);
  const signer = overrides.signer ?? createSigner(keyring);
  const verifyJwt = overrides.verifyJwt ?? createAccessTokenVerifier(env);

  const authContext =
    overrides.authContext ??
    (pools
      ? createAuthContextService(pools, redisBundle.client)
      : {
          async load() {
            return null;
          },
          async invalidate() {
            // noop when no DB pool configured
          },
        });

  const stepUp = overrides.stepUp ?? createStepUpService(keyring, signer, redisBundle.client);
  const internalJwt = overrides.internalJwt ?? createInternalJwtSigner(keyring);
  const rateLimit = overrides.rateLimit ?? createRateLimitService(redisBundle.raw);
  const aiClient = overrides.aiClient ?? new AiClient(env, internalJwt);

  return {
    env,
    logger,
    pools,
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
    supabaseAdmin: overrides.supabaseAdmin,
    aiReadiness: overrides.aiReadiness,
    async close() {
      if (pools) await pools.close();
      await redisBundle.client.quit();
    },
  };
}
