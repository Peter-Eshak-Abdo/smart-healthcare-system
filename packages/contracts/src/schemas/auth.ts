import { z } from 'zod';
import {
  AppRoleSchema,
  BloodTypeSchema,
  SexSchema,
  StepUpPurposeSchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';

export const RegisterAccountRequestSchema = z
  .object({
    role: AppRoleSchema,
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(8).max(20),
    password: z.string().min(8).max(128),
    confirm_password: z.string().min(8).max(128),
    full_name: z.string().trim().min(2).max(120),
    national_id: z.string().trim().min(6).max(32),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sex: SexSchema,
    preferred_locale: z.enum(['ar', 'en']).default('ar'),
    blood_type: BloodTypeSchema.optional(),
    license_number: z.string().trim().min(3).max(64).optional(),
    specialty_code: z.string().trim().min(2).max(32).optional(),
  })
  .strict()
  .refine((data) => data.password === data.confirm_password, {
    message: 'passwords_do_not_match',
    path: ['confirm_password'],
  })
  .refine(
    (data) => {
      if (data.role === 'doctor' || data.role === 'pharmacist' || data.role === 'paramedic') {
        return Boolean(data.license_number && data.license_number.length >= 3);
      }
      return true;
    },
    {
      message: 'license_number_required_for_practitioner',
      path: ['license_number'],
    },
  );

export const RegisterAccountResponseSchema = z
  .object({
    user_id: z.string().min(1),
    role: AppRoleSchema,
    status: z.enum(['active', 'pending']),
    created_at: TimestampSchema,
  })
  .strict();

export type RegisterAccountRequest = z.infer<typeof RegisterAccountRequestSchema>;
export type RegisterAccountResponse = z.infer<typeof RegisterAccountResponseSchema>;

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
