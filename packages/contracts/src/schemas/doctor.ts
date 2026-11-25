import { z } from 'zod';
import {
  AccessScopeSchema,
  AllergenTypeSchema,
  AllergySeveritySchema,
  BloodTypeSchema,
  ConditionStatusSchema,
  createPageResponseSchema,
  DataSourceSchema,
  EncounterStatusSchema,
  EncounterTypeSchema,
  LocalizedTextSchema,
  MrnSchema,
  PaginationQuerySchema,
  PrescriptionStatusSchema,
  RxNumberSchema,
  SexSchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';
import { CriticalInfoResponseSchema } from './patients.js';

export const PatientIdParamSchema = z
  .object({
    patientId: UuidSchema,
  })
  .strict();

export const PatientAllergyParamSchema = z
  .object({
    patientId: UuidSchema,
    id: UuidSchema,
  })
  .strict();

export const PatientConditionParamSchema = z
  .object({
    patientId: UuidSchema,
    id: UuidSchema,
  })
  .strict();

export const RedeemShareCodeRequestSchema = z
  .object({
    patient_mrn: MrnSchema,
    code: z.string().regex(/^\d{6}$/, '6-digit numeric share code expected'),
  })
  .strict();

export const RedeemShareCodeResponseSchema = z
  .object({
    grant_id: UuidSchema,
    patient_id: UuidSchema,
    scope: AccessScopeSchema,
    expires_at: TimestampSchema,
  })
  .strict();

export const DoctorPatientsQuerySchema = PaginationQuerySchema.extend({
  query: z.string().trim().min(2).max(64).optional(),
}).strict();

export const DoctorPatientListItemSchema = z
  .object({
    patient_id: UuidSchema,
    mrn: MrnSchema,
    full_name: z.string(),
    age: z.number().int().nonnegative(),
    sex: SexSchema,
    grant: z
      .object({
        id: UuidSchema,
        expires_at: TimestampSchema,
      })
      .strict(),
  })
  .strict();

export const DoctorPatientsResponseSchema = createPageResponseSchema(DoctorPatientListItemSchema);

export const DoctorPatientSummaryResponseSchema = z
  .object({
    patient: z
      .object({
        id: UuidSchema,
        mrn: MrnSchema,
        full_name: z.string(),
        age: z.number().int().nonnegative(),
        sex: SexSchema,
      })
      .strict(),
    critical: CriticalInfoResponseSchema,
    recent_encounters: z.array(
      z
        .object({
          id: UuidSchema,
          started_at: TimestampSchema,
          doctor: z.string(),
          primary_diagnosis: z.string().nullable(),
        })
        .strict(),
    ),
    active_prescriptions: z.array(
      z
        .object({
          id: UuidSchema,
          rx_number: RxNumberSchema,
          status: PrescriptionStatusSchema,
        })
        .strict(),
    ),
    restricted_record_count: z.number().int().nonnegative(),
    grant: z
      .object({
        id: UuidSchema,
        scope: AccessScopeSchema,
        expires_at: TimestampSchema,
      })
      .strict(),
  })
  .strict();

export const CreateEncounterRequestSchema = z
  .object({
    encounter_type: EncounterTypeSchema,
    facility_id: UuidSchema,
    chief_complaint: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const CreateEncounterResponseSchema = z
  .object({
    id: UuidSchema,
    status: EncounterStatusSchema,
    started_at: TimestampSchema,
    version: z.number().int().min(1),
  })
  .strict();

export const PatchEncounterRequestSchema = z
  .object({
    chief_complaint: z.string().trim().max(1000).optional(),
    notes_internal: z.string().trim().max(8000).optional(),
    patient_summary: z.string().trim().max(4000).optional(),
    end: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const PatchEncounterResponseSchema = z
  .object({
    id: UuidSchema,
    status: EncounterStatusSchema,
    ended_at: TimestampSchema.nullable(),
    version: z.number().int().min(1),
  })
  .strict();

export const CreateAddendumRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
  })
  .strict();

export const CreateAddendumResponseSchema = z
  .object({
    id: UuidSchema,
    created_at: TimestampSchema,
  })
  .strict();

export const EnteredInErrorRequestSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const EnteredInErrorResponseSchema = z
  .object({
    id: UuidSchema,
    status: z.literal('entered_in_error'),
  })
  .strict();

export const CreateDiagnosisRequestSchema = z
  .object({
    icd10_code: z.string().trim().min(3).max(16),
    is_primary: z.boolean().default(false),
    clinical_notes: z.string().trim().max(4000).optional(),
    add_to_problem_list: z.boolean().default(false),
    is_chronic: z.boolean().default(false),
  })
  .strict();

export const CreateDiagnosisResponseSchema = z
  .object({
    id: UuidSchema,
    icd10_code: z.string(),
    is_primary: z.boolean(),
    condition_id: UuidSchema.nullable(),
  })
  .strict();

export const CreateConditionRequestSchema = z
  .object({
    icd10_code: z.string().trim().min(3).max(16),
    is_chronic: z.boolean().default(true),
    status: ConditionStatusSchema.default('active'),
    onset_year: z.number().int().min(1900).max(2100).nullable().optional(),
  })
  .strict();

export const PatchConditionRequestSchema = z
  .object({
    status: ConditionStatusSchema.optional(),
    is_chronic: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const ConditionDtoSchema = z
  .object({
    id: UuidSchema,
    icd10_code: z.string().nullable(),
    name: LocalizedTextSchema,
    is_chronic: z.boolean(),
    status: ConditionStatusSchema,
    source: DataSourceSchema,
    onset_year: z.number().int().nullable(),
  })
  .strict();

export const VerifyAllergyRequestSchema = z
  .object({
    verification: z.enum(['confirmed', 'refuted']),
    allergen_type: AllergenTypeSchema.optional(),
    allergen_code: z.string().trim().min(2).max(64).nullable().optional(),
    severity: AllergySeveritySchema.optional(),
  })
  .strict();

export const DoctorUpdateBloodTypeRequestSchema = z
  .object({
    value: BloodTypeSchema,
    verified_by_lab: z.boolean().default(false),
  })
  .strict();
