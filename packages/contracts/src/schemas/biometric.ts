import { z } from 'zod';
import { TimestampSchema, UuidSchema } from './common.js';

export const BiometricChallengeQuerySchema = z
  .object({
    purpose: z.enum(['enroll', 'verify']),
  })
  .strict();

export const LivenessActionSchema = z.enum(['blink', 'turn_left', 'turn_right']);

export const BiometricChallengeResponseSchema = z
  .object({
    challenge_id: UuidSchema,
    sequence: z.array(LivenessActionSchema).min(2).max(5),
    expires_in: z.number().int().positive(),
  })
  .strict();

export const BiometricClientSignalsSchema = z
  .object({
    blink_detected: z.boolean(),
    yaw_deltas: z.array(z.number()),
    capture_ms: z.number().int().positive(),
  })
  .strict();

export const BiometricFaceEnrollBodySchema = z
  .object({
    challenge_id: UuidSchema,
    client_signals: z.union([z.string(), BiometricClientSignalsSchema]),
  })
  .strict();

export const BiometricEnrollResponseSchema = z
  .object({
    enrolled: z.literal(true),
    template_count: z.number().int().min(1),
    model_version: z.string(),
    enrolled_at: TimestampSchema,
  })
  .strict();
