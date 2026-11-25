import { z } from 'zod';
import {
  AccountStatusSchema,
  AppRoleSchema,
  FacilityTypeSchema,
  LicenseStatusSchema,
  LocaleSchema,
  LocalizedTextSchema,
  MrnSchema,
  PhoneE164Schema,
  UuidSchema,
} from './common.js';

export const MeFacilitySchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    type: FacilityTypeSchema,
  })
  .strict();

export const MeSpecialtySchema = z
  .object({
    code: z.string(),
    name: LocalizedTextSchema,
  })
  .strict();

export const MePractitionerSchema = z
  .object({
    type: z.enum(['doctor', 'pharmacist', 'paramedic']),
    license_number: z.string(),
    license_status: LicenseStatusSchema,
    specialty: MeSpecialtySchema.nullable(),
    facilities: z.array(MeFacilitySchema),
    active_facility_id: UuidSchema.nullable(),
  })
  .strict();

export const MePatientSchema = z
  .object({
    mrn: MrnSchema.nullable(),
    onboarded: z.boolean(),
    is_minor: z.boolean(),
  })
  .strict();

export const MeResponseSchema = z
  .object({
    id: UuidSchema,
    role: AppRoleSchema,
    status: AccountStatusSchema,
    full_name: z.string(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    preferred_locale: LocaleSchema,
    mfa: z
      .object({
        enrolled: z.boolean(),
        aal: z.enum(['aal1', 'aal2']),
      })
      .strict(),
    patient: MePatientSchema.nullable(),
    practitioner: MePractitionerSchema.nullable(),
    permissions: z.array(z.string()),
  })
  .strict();

export const PatchMeRequestSchema = z
  .object({
    full_name: z.string().trim().min(2).max(120).optional(),
    phone: PhoneE164Schema.optional(),
    preferred_locale: LocaleSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const PatchMePendingResponseSchema = z
  .object({
    pending: z.literal('phone_verification'),
  })
  .strict();

export type MeResponse = z.infer<typeof MeResponseSchema>;
export type PatchMeRequest = z.infer<typeof PatchMeRequestSchema>;
