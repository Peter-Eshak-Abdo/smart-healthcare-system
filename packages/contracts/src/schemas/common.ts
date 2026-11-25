import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const UuidSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime({ offset: true });
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const PhoneE164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Expected E.164 phone');
export const MrnSchema = z.string().regex(/^SH-[0-9A-HJKMNP-TV-Z]{8}$/, 'Invalid MRN format');
export const RxNumberSchema = z.string().regex(/^RX-\d{4}-\d{6,}$/, 'Invalid Rx number format');

export const LocalizedTextSchema = z
  .object({
    en: z.string(),
    ar: z.string(),
  })
  .strict();

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const AppRoleSchema = z.enum(['patient', 'doctor', 'pharmacist', 'paramedic', 'admin']);
export type AppRole = z.infer<typeof AppRoleSchema>;

export const AccountStatusSchema = z.enum([
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
]);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const LicenseStatusSchema = z.enum([
  'pending',
  'verified',
  'suspended',
  'revoked',
  'expired',
]);
export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export const FacilityTypeSchema = z.enum(['hospital', 'clinic', 'pharmacy', 'ambulance_service']);
export type FacilityType = z.infer<typeof FacilityTypeSchema>;

export const SexSchema = z.enum(['male', 'female']);
export type Sex = z.infer<typeof SexSchema>;

export const BloodTypeSchema = z.enum([
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'unknown',
]);
export type BloodType = z.infer<typeof BloodTypeSchema>;

export const DataSourceSchema = z.enum(['patient_reported', 'clinician_confirmed', 'imported']);
export type DataSource = z.infer<typeof DataSourceSchema>;

export const AllergenTypeSchema = z.enum([
  'ingredient',
  'drug_class',
  'food',
  'environmental',
  'other',
]);
export type AllergenType = z.infer<typeof AllergenTypeSchema>;

export const AllergySeveritySchema = z.enum(['mild', 'moderate', 'severe', 'anaphylaxis']);
export type AllergySeverity = z.infer<typeof AllergySeveritySchema>;

export const AllergyVerificationSchema = z.enum(['unconfirmed', 'confirmed', 'refuted']);
export type AllergyVerification = z.infer<typeof AllergyVerificationSchema>;

export const ConditionStatusSchema = z.enum(['active', 'resolved', 'inactive']);
export type ConditionStatus = z.infer<typeof ConditionStatusSchema>;

export const EncounterTypeSchema = z.enum([
  'outpatient',
  'inpatient',
  'emergency',
  'teleconsult',
]);
export type EncounterType = z.infer<typeof EncounterTypeSchema>;

export const EncounterStatusSchema = z.enum(['open', 'closed', 'entered_in_error']);
export type EncounterStatus = z.infer<typeof EncounterStatusSchema>;

export const EncounterVisibilitySchema = z.enum(['normal', 'restricted']);
export type EncounterVisibility = z.infer<typeof EncounterVisibilitySchema>;

export const GrantTypeSchema = z.enum(['patient_share', 'encounter', 'admin_override']);
export type GrantType = z.infer<typeof GrantTypeSchema>;

export const GrantStatusSchema = z.enum(['active', 'revoked', 'expired']);
export type GrantStatus = z.infer<typeof GrantStatusSchema>;

export const AccessScopeSchema = z.enum(['read_only', 'read_write']);
export type AccessScope = z.infer<typeof AccessScopeSchema>;

export const PrescriptionStatusSchema = z.enum([
  'pending',
  'partially_dispensed',
  'dispensed',
  'cancelled',
  'expired',
]);
export type PrescriptionStatus = z.infer<typeof PrescriptionStatusSchema>;

export const RxItemStatusSchema = z.enum([
  'pending',
  'partially_dispensed',
  'dispensed',
  'cancelled',
]);
export type RxItemStatus = z.infer<typeof RxItemStatusSchema>;

export const AlertSeveritySchema = z.enum(['minor', 'moderate', 'major', 'contraindicated']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const ConsentTypeSchema = z.enum([
  'biometric_face',
  'emergency_contacts_share',
  'ai_assistant',
  'terms_of_service',
]);
export type ConsentType = z.infer<typeof ConsentTypeSchema>;

export const StepUpPurposeSchema = z.enum([
  'pickup_token',
  'dispense',
  'view_emergency_card_manage',
  'biometric_delete',
  'logout_all',
]);
export type StepUpPurpose = z.infer<typeof StepUpPurposeSchema>;

export const ContactRelationshipSchema = z.enum([
  'parent',
  'father',
  'mother',
  'spouse',
  'sibling',
  'child',
  'relative',
  'friend',
  'guardian',
  'other',
]);
export type ContactRelationship = z.infer<typeof ContactRelationshipSchema>;

export const LocaleSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const PaginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  })
  .strict();

export const PageMetaSchema = z
  .object({
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  })
  .strict();

export type PageMeta = z.infer<typeof PageMetaSchema>;

export function createPageResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      data: z.array(itemSchema),
      page: PageMetaSchema,
    })
    .strict();
}

export const IdParamSchema = z
  .object({
    id: UuidSchema,
  })
  .strict();

export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    commit: z.string(),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
