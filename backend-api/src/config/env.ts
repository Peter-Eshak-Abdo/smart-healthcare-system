import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

function hydrateEnvFiles(target: NodeJS.ProcessEnv): void {
  if (target.VITEST || target.NODE_ENV === 'test') return;
  for (const filename of ['.env', '.env.local']) {
    const filePath = path.join(backendRoot, filename);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || target[key] !== undefined) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      target[key] = val;
    }
  }
}

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
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
    KEK_CURRENT_ID: z.string().regex(/^k\d+$/).default('k1'),
    KEK_K1: base64Key32.optional(),
    KEK_K2: base64Key32.optional(),
    BLIND_INDEX_KEY: base64Key32.optional(),
    RX_SIGNING_KEY_ID: z.string().default('rx-2026-11'),
    RX_SIGNING_PRIVATE_KEY: pemEd25519.optional(),
    EMERGENCY_CARD_SIGNING_KEY_ID: z.string().default('ec-2026-11'),
    EMERGENCY_CARD_SIGNING_PRIVATE_KEY: pemEd25519.optional(),
    GEMINI_API_KEY: z.string().min(10).optional(),
    GEMINI_API_KEYS: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    GEMINI_TIER1_MODEL: z.string().default('gemini-2.5-flash-lite'),
    GEMINI_TIER2_MODEL: z.string().default('gemini-2.5-flash'),
    GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
    GROQ_API_KEY: z.string().min(10).optional(),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    GROQ_TIER1_MODEL: z.string().default('llama-3.1-8b-instant'),
    GROQ_TIER2_MODEL: z.string().default('llama-3.3-70b-versatile'),
    AI_DAILY_LIMIT_PATIENT_CHAT: z.coerce.number().int().positive().default(25),
    AI_DAILY_LIMIT_PATIENT_VISION: z.coerce.number().int().positive().default(8),
    AI_DAILY_LIMIT_DOCTOR: z.coerce.number().int().positive().default(60),
    AI_DAILY_LIMIT_PHARMACIST: z.coerce.number().int().positive().default(40),
    BIOMETRIC_TRANSFORM_SECRET: z.string().min(16).optional(),
    BIOMETRIC_TRANSFORM_KEY_VERSION: z.coerce.number().int().positive().default(1),
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

export function loadEnv(source?: NodeJS.ProcessEnv): AppEnv {
  if (!source) {
    hydrateEnvFiles(process.env);
    return EnvSchema.parse(process.env);
  }
  return EnvSchema.parse(source);
}
