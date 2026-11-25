import { z } from 'zod';
import { StepUpPurposeSchema, TimestampSchema, UuidSchema } from './common.js';

export const RegisterDeviceRequestSchema = z
  .object({
    device_id: UuidSchema,
    platform: z.enum(['android', 'ios', 'web']),
    model: z.string().trim().min(1).max(120),
    public_key_spki_b64: z.string().trim().min(32).max(2048),
    key_algorithm: z.literal('ES256'),
    biometric_bound: z.boolean(),
  })
  .strict();

export const RegisterDeviceResponseSchema = z
  .object({
    device_id: UuidSchema,
    registered_at: TimestampSchema,
  })
  .strict();

export const StepUpChallengeRequestSchema = z
  .object({
    device_id: UuidSchema,
    purpose: StepUpPurposeSchema,
  })
  .strict();

export const StepUpChallengeResponseSchema = z
  .object({
    challenge_id: UuidSchema,
    nonce_b64: z.string().min(16),
    expires_at: TimestampSchema,
  })
  .strict();

export const StepUpVerifyRequestSchema = z
  .object({
    challenge_id: UuidSchema,
    signature_b64: z.string().min(16).max(2048),
  })
  .strict();

export const StepUpVerifyResponseSchema = z
  .object({
    step_up_token: z.string().min(20),
    expires_in: z.number().int().positive(),
    purpose: StepUpPurposeSchema,
  })
  .strict();

export const DeviceIdParamSchema = z
  .object({
    deviceId: UuidSchema,
  })
  .strict();

export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequestSchema>;
export type StepUpChallengeRequest = z.infer<typeof StepUpChallengeRequestSchema>;
export type StepUpVerifyRequest = z.infer<typeof StepUpVerifyRequestSchema>;
