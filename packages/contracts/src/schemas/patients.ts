import { z } from 'zod';
import {
  AllergenTypeSchema,
  AllergySeveritySchema,
  BloodTypeSchema,
  ConditionStatusSchema,
  ConsentTypeSchema,
  ContactRelationshipSchema,
  createPageResponseSchema,
  DataSourceSchema,
  DateSchema,
  EncounterTypeSchema,
  EncounterVisibilitySchema,
  LocalizedTextSchema,
  MrnSchema,
  PaginationQuerySchema,
  PhoneE164Schema,
  PrescriptionStatusSchema,
  RxNumberSchema,
  SexSchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';

export const OnboardingConsentSchema = z
  .object({
    type: ConsentTypeSchema,
    version: z.string().trim().min(1).max(32),
  })
  .strict();

export const PatientOnboardingRequestSchema = z
  .object({
    id_document_type: z.enum(['national_id', 'passport']),
    id_document_number: z.string().trim().min(5).max(32),
    date_of_birth: DateSchema,
    sex: SexSchema,
    blood_type: BloodTypeSchema.optional(),
    consents: z.array(OnboardingConsentSchema).min(1),
  })
  .strict();

export const PatientOnboardingResponseSchema = z
  .object({
    patient_id: UuidSchema,
    mrn: MrnSchema,
    date_of_birth: DateSchema,
    sex: SexSchema,
    blood_type: z
      .object({
        value: BloodTypeSchema,
        source: DataSourceSchema,
      })
      .strict(),
    is_minor: z.boolean(),
  })
  .strict();

export const ConsentRequestSchema = z
  .object({
    type: ConsentTypeSchema,
    version: z.string().trim().min(1).max(32),
    granted: z.boolean(),
  })
  .strict();

export const ConsentResponseSchema = z
  .object({
    type: ConsentTypeSchema,
    version: z.string(),
    granted: z.boolean(),
    recorded_at: TimestampSchema,
  })
  .strict();

export const AllergyDtoSchema = z
  .object({
    id: UuidSchema,
    allergen_type: AllergenTypeSchema,
    allergen: z
      .object({
        code: z.string(),
        name: LocalizedTextSchema,
      })
      .strict()
      .nullable(),
    free_text: z.string().nullable(),
    severity: AllergySeveritySchema,
    reaction: z.string().nullable(),
    source: DataSourceSchema,
    recorded_at: TimestampSchema,
  })
  .strict();

export const ChronicConditionDtoSchema = z
  .object({
    id: UuidSchema,
    icd10_code: z.string().nullable(),
    name: LocalizedTextSchema,
    status: ConditionStatusSchema,
    source: DataSourceSchema,
  })
  .strict();

export const CurrentMedicationDtoSchema = z
  .object({
    drug: z
      .object({
        id: UuidSchema,
        display: z.string(),
      })
      .strict(),
    dose_text: z.string(),
    since: DateSchema.nullable(),
    until: DateSchema.nullable(),
    source: z.enum(['prescription', 'patient_reported']),
  })
  .strict();

export const CriticalInfoResponseSchema = z
  .object({
    blood_type: z
      .object({
        value: BloodTypeSchema,
        source: DataSourceSchema,
        confirmed_at: TimestampSchema.nullable(),
      })
      .strict(),
    allergies: z.array(AllergyDtoSchema),
    chronic_conditions: z.array(ChronicConditionDtoSchema),
    current_medications: z.array(CurrentMedicationDtoSchema),
  })
  .strict();

export const UpdateBloodTypeRequestSchema = z
  .object({
    value: BloodTypeSchema,
  })
  .strict();

export const UpdateBloodTypeResponseSchema = z
  .object({
    value: BloodTypeSchema,
    source: DataSourceSchema,
  })
  .strict();

export const CreateAllergyRequestSchema = z
  .object({
    allergen_type: AllergenTypeSchema,
    allergen_code: z.string().trim().min(2).max(64).nullable(),
    free_text: z.string().trim().min(1).max(300).nullable(),
    severity: AllergySeveritySchema,
    reaction: z.string().trim().max(300).nullable().optional(),
  })
  .strict()
  .refine(
    (v) => (v.allergen_code !== null && v.allergen_code.length > 0) || (v.free_text !== null && v.free_text.length > 0),
    'Either allergen_code or free_text is required',
  );

export const MedicalHistoryQuerySchema = PaginationQuerySchema.extend({
  type: z.enum(['all', 'visits', 'diagnoses', 'medications']).default('all'),
}).strict();

export const DiagnosisSummaryDtoSchema = z
  .object({
    icd10_code: z.string(),
    name: LocalizedTextSchema,
    is_primary: z.boolean(),
  })
  .strict();

export const MedicalHistoryEncounterItemSchema = z
  .object({
    kind: z.literal('encounter'),
    id: UuidSchema,
    started_at: TimestampSchema,
    encounter_type: EncounterTypeSchema,
    facility: z
      .object({
        id: UuidSchema,
        name: z.string(),
      })
      .strict(),
    doctor: z
      .object({
        id: UuidSchema,
        name: z.string(),
        specialty: z
          .object({
            code: z.string(),
            name: LocalizedTextSchema,
          })
          .strict()
          .nullable(),
      })
      .strict(),
    diagnoses: z.array(DiagnosisSummaryDtoSchema),
    prescription_ids: z.array(UuidSchema),
    visibility: EncounterVisibilitySchema,
    notes_internal: z.string().nullable().optional(),
  })
  .strict();

export const MedicalHistoryRestrictedItemSchema = z
  .object({
    kind: z.literal('restricted_placeholder'),
    id: z.null(),
    started_at: TimestampSchema,
  })
  .strict();

export const MedicalHistoryItemSchema = z.discriminatedUnion('kind', [
  MedicalHistoryEncounterItemSchema,
  MedicalHistoryRestrictedItemSchema,
]);

export const MedicalHistoryResponseSchema = createPageResponseSchema(MedicalHistoryItemSchema);

export const EncounterIdParamSchema = z
  .object({
    encounterId: UuidSchema,
  })
  .strict();

export const PatientEncounterDetailSchema = z
  .object({
    id: UuidSchema,
    started_at: TimestampSchema,
    ended_at: TimestampSchema.nullable(),
    encounter_type: EncounterTypeSchema,
    facility: z
      .object({
        id: UuidSchema,
        name: z.string(),
      })
      .strict(),
    doctor: z
      .object({
        id: UuidSchema,
        name: z.string(),
      })
      .strict(),
    chief_complaint: z.string().nullable(),
    patient_summary: z.string().nullable(),
    diagnoses: z.array(DiagnosisSummaryDtoSchema),
    prescriptions: z.array(
      z
        .object({
          id: UuidSchema,
          rx_number: RxNumberSchema,
          status: PrescriptionStatusSchema,
        })
        .strict(),
    ),
    addenda: z.array(
      z
        .object({
          created_at: TimestampSchema,
          author: z.string(),
          text: z.string(),
        })
        .strict(),
    ),
    visibility: EncounterVisibilitySchema,
  })
  .strict();

export const UpdateEncounterVisibilityRequestSchema = z
  .object({
    visibility: EncounterVisibilitySchema,
  })
  .strict();

export const UpdateEncounterVisibilityResponseSchema = z
  .object({
    id: UuidSchema,
    visibility: EncounterVisibilitySchema,
  })
  .strict();

export const PatientPrescriptionsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'past']).optional(),
}).strict();

export const PatientPrescriptionListItemSchema = z
  .object({
    id: UuidSchema,
    rx_number: RxNumberSchema,
    status: PrescriptionStatusSchema,
    issued_at: TimestampSchema,
    expires_at: TimestampSchema,
    doctor: z
      .object({
        name: z.string(),
        specialty: z
          .object({
            code: z.string(),
            name: LocalizedTextSchema,
          })
          .strict()
          .nullable(),
      })
      .strict(),
    item_count: z.number().int().nonnegative(),
    remaining_item_count: z.number().int().nonnegative(),
  })
  .strict();

export const PatientPrescriptionsResponseSchema = createPageResponseSchema(
  PatientPrescriptionListItemSchema,
);

export const EmergencyContactInputSchema = z
  .object({
    full_name: z.string().trim().min(2).max(120),
    relationship: ContactRelationshipSchema,
    phone: PhoneE164Schema,
    priority: z.number().int().min(1).max(5),
    share_with_emergency: z.boolean().default(true),
  })
  .strict();

export const EmergencyContactPatchSchema = EmergencyContactInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'At least one field must be provided',
);

export const EmergencyContactDtoSchema = z
  .object({
    id: UuidSchema,
    full_name: z.string(),
    relationship: ContactRelationshipSchema,
    phone: z.string(),
    priority: z.number().int().min(1).max(5),
    share_with_emergency: z.boolean(),
    updated_at: TimestampSchema,
  })
  .strict();

export const EmergencyContactsResponseSchema = z
  .object({
    data: z.array(EmergencyContactDtoSchema),
  })
  .strict();

export const EmergencyCardResponseSchema = z
  .object({
    card_jws: z.string().min(20),
    expires_at: TimestampSchema,
    qr_payload: z.string().startsWith('SHEC1.'),
  })
  .strict();
