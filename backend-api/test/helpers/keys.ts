import { generateKeyPairSync, randomBytes } from 'node:crypto';
import type { AppEnv } from '../../src/config/env.js';
import { loadEnv } from '../../src/config/env.js';

function pemPair(): { privatePem: string } {
  const { privateKey } = generateKeyPairSync('ed25519');
  return {
    privatePem: (privateKey.export({ format: 'pem', type: 'pkcs8' }) as string).trim(),
  };
}

export function createTestEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  const rx = pemPair();
  const ec = pemPair();
  const internal = pemPair();

  const base = loadEnv({
    APP_ENV: 'test',
    APP_VERSION: '1.0.0',
    GIT_COMMIT: 'test-sha',
    KEK_CURRENT_ID: 'k1',
    KEK_K1: randomBytes(32).toString('base64'),
    KEK_K2: randomBytes(32).toString('base64'),
    BLIND_INDEX_KEY: randomBytes(32).toString('base64'),
    RX_SIGNING_KEY_ID: 'rx-2026-11',
    RX_SIGNING_PRIVATE_KEY: rx.privatePem,
    EMERGENCY_CARD_SIGNING_KEY_ID: 'ec-2026-11',
    EMERGENCY_CARD_SIGNING_PRIVATE_KEY: ec.privatePem,
    INTERNAL_JWT_SIGNING_KEY: internal.privatePem,
  });

  return { ...base, ...overrides };
}
