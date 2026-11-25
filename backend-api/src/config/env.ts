import { z } from 'zod';

const base64Key32 = z
  .string()
  .refine((val) => Buffer.from(val, 'base64').length === 32, 'Expected 32-byte base64 key');

const pemEd25519 = z.string().includes('PRIVATE KEY');

export const EnvSchema = z
  .object({
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_VERSION: z.string().default('1.0.0'),
    GIT_COMMIT: z.string().default('dev'),
    WEB_ORIGIN: z.string().url().optional(),
    FIREBASE_PROJECT_ID: z.string().min(2).optional(),
    FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
    FIREBASE_PRIVATE_KEY: z.string().min(20).optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(10).optional(),
    FIREBASE_STORAGE_BUCKET: z.string().min(3).optional(),
    REDIS_URL: z.string().optional(),
    KEK_CURRENT_ID: z.string().regex(/^k\d+$/).default('k1'),
    KEK_K1: base64Key32.optional(),
    KEK_K2: base64Key32.optional(),
    BLIND_INDEX_KEY: base64Key32.optional(),
    RX_SIGNING_KEY_ID: z.string().default('rx-2026-11'),
    RX_SIGNING_PRIVATE_KEY: pemEd25519.optional(),
    EMERGENCY_CARD_SIGNING_KEY_ID: z.string().default('ec-2026-11'),
    EMERGENCY_CARD_SIGNING_PRIVATE_KEY: pemEd25519.optional(),
    INTERNAL_JWT_SIGNING_KEY: pemEd25519.optional(),
    AI_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
    FACE_MATCH_ACCEPT: z.coerce.number().default(0.5),
    FACE_MATCH_POSSIBLE: z.coerce.number().default(0.4),
    FACE_MATCH_MARGIN: z.coerce.number().default(0.08),
    MIN_CLIENT_VERSION_ANDROID: z.string().default('1.0.0'),
    MIN_CLIENT_VERSION_IOS: z.string().default('1.0.0'),
    MIN_CLIENT_VERSION_WEB: z.string().default('1.0.0'),
    EMERGENCY_PHONE: z.string().default('123'),
    FEATURE_ER_INTAKE: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    FEATURE_PASSKEY: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
  })
  .passthrough();

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return EnvSchema.parse(source);
}
