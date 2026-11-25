import { z } from 'zod';

export const ReadyResponseSchema = z
  .object({
    db: z.enum(['ok', 'down']),
    redis: z.enum(['ok', 'down']),
    ai: z.enum(['ok', 'degraded']),
  })
  .strict();

export const JwkEd25519Schema = z
  .object({
    kty: z.literal('OKP'),
    crv: z.literal('Ed25519'),
    kid: z.string(),
    x: z.string(),
    use: z.literal('sig'),
    alg: z.literal('EdDSA'),
  })
  .strict();

export const JwksResponseSchema = z
  .object({
    keys: z.array(JwkEd25519Schema),
  })
  .strict();

export const MobileConfigResponseSchema = z
  .object({
    min_version: z
      .object({
        android: z.string(),
        ios: z.string(),
      })
      .strict(),
    emergency_phone: z.string(),
    feature_flags: z.record(z.boolean()),
  })
  .strict();
