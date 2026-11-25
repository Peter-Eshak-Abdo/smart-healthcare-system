import { z } from 'zod';
import {
  AlertSeveritySchema,
  createPageResponseSchema,
  LocalizedTextSchema,
  MrnSchema,
  PaginationQuerySchema,
  PrescriptionStatusSchema,
  RxItemStatusSchema,
  RxNumberSchema,
  SexSchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';

export const RxFrequencySchema = z.enum([
  'once_daily',
  'twice_daily',
  'three_times_daily',
  'four_times_daily',
  'every_x_hours',
  'at_bedtime',
  'as_needed',
  'once',
  'weekly',
]);

export const OverrideReasonCodeSchema = z.enum([
  'benefit_outweighs_risk',
  'allergy_disputed',
  'desensitisation_protocol',
  'monitored_setting',
  'other',
]);

export const CancelReasonCodeSchema = z.enum([
  'prescribing_error',
  'patient_request',
  'therapy_changed',
  'adverse_reaction',
  'other',
]);

export const CheckPrescriptionItemSchema = z
  .object({
    client_key: z.string().trim().min(1).max(32),
    drug_id: UuidSchema,
  })
  .strict();

export const CheckPrescriptionsRequestSchema = z
  .object({
    patient_id: UuidSchema,
    items: z.array(CheckPrescriptionItemSchema).min(1).max(20),
  })
  .strict();

export const SafetyAlertDtoSchema = z
  .object({
    alert_key: z.string(),
    type: z.enum(['drug_drug', 'drug_allergy', 'duplicate_therapy', 'drug_condition']),
    severity: AlertSeveritySchema,
    item_keys: z.array(z.string()),
    title: LocalizedTextSchema,
    message: LocalizedTextSchema,
    management: LocalizedTextSchema,
    source: z.string(),
    requires_override: z.boolean(),
    involves_current_medication: z
      .object({
        display: z.string(),
        from_restricted_record: z.boolean(),
      })
      .strict()
      .optional(),
    previously_reviewed: z
      .object({
        by: z.string(),
        at: TimestampSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const CheckPrescriptionsResponseSchema = z
  .object({
    checks_status: z.enum(['complete', 'partial', 'unavailable']),
    engine_version: z.string(),
    dataset_version: z.string(),
    alerts: z.array(SafetyAlertDtoSchema),
  })
  .strict();

export const IssuePrescriptionItemInputSchema = z
  .object({
    client_key: z.string().trim().min(1).max(32),
    drug_id: UuidSchema,
    dose: z.string().trim().min(1).max(60),
    route: z.string().trim().min(1).max(40),
    frequency: RxFrequencySchema,
    frequency_interval_hours: z.number().int().min(1).max(24).nullable().optional(),
    duration_days: z.number().int().min(1).max(365),
    quantity: z.number().positive(),
    quantity_unit: z.string().trim().min(1).max(32),
    instructions: z.string().trim().max(300).optional(),
    substitution_allowed: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) => (v.frequency === 'every_x_hours') === (v.frequency_interval_hours !== null && v.frequency_interval_hours !== undefined),
    'frequency_interval_hours is required strictly when frequency is every_x_hours',
  );

export const AlertOverrideInputSchema = z
  .object({
    alert_key: z.string().trim().min(2).max(128),
    reason_code: OverrideReasonCodeSchema,
    justification: z.string().trim().min(15).max(1000),
  })
  .strict();

export const IssuePrescriptionRequestSchema = z
  .object({
    patient_id: UuidSchema,
    encounter_id: UuidSchema,
    items: z.array(IssuePrescriptionItemInputSchema).min(1).max(20),
    overrides: z.array(AlertOverrideInputSchema).default([]),
    manual_review_attested: z.boolean().default(false),
    notes_to_pharmacist: z.string().trim().max(1000).optional(),
  })
  .strict();

export const CancelPrescriptionRequestSchema = z
  .object({
    reason_code: CancelReasonCodeSchema,
    item_ids: z.array(UuidSchema).nullable().default(null),
  })
  .strict();

export const DoctorPrescriptionsQuerySchema = PaginationQuerySchema.extend({
  status: PrescriptionStatusSchema.optional(),
  patient_id: UuidSchema.optional(),
}).strict();

export const PrescriptionDetailItemSchema = z
  .object({
    id: UuidSchema,
    drug: z
      .object({
        id: UuidSchema,
        brand_name: z.string(),
        generic_name: z.string(),
        strength: z.string(),
        dosage_form: z.string(),
        is_controlled: z.boolean(),
      })
      .strict(),
    dose: z.string(),
    route: z.string(),
    frequency: RxFrequencySchema,
    duration_days: z.number().int(),
    quantity_prescribed: z.number(),
    quantity_dispensed: z.number(),
    quantity_remaining: z.number(),
    quantity_unit: z.string(),
    instructions: z.string().nullable(),
    substitution_allowed: z.boolean(),
    status: RxItemStatusSchema,
  })
  .strict();

export const PrescriptionDetailSchema = z
  .object({
    id: UuidSchema,
    rx_number: RxNumberSchema,
    status: PrescriptionStatusSchema,
    issued_at: TimestampSchema,
    expires_at: TimestampSchema,
    patient: z
      .object({
        id: UuidSchema,
        mrn: MrnSchema,
        full_name: z.string(),
        age: z.number().int(),
        sex: SexSchema,
      })
      .strict(),
    prescriber: z
      .object({
        id: UuidSchema,
        name: z.string(),
        license_number: z.string(),
        specialty: z.string().nullable(),
        facility: z.string(),
      })
      .strict(),
    items: z.array(PrescriptionDetailItemSchema),
    alerts_summary: z.array(
      z
        .object({
          alert_key: z.string(),
          severity: AlertSeveritySchema,
          overridden: z.boolean(),
          reason_code: OverrideReasonCodeSchema.nullable(),
          justification: z.string().nullable().optional(),
        })
        .strict(),
    ),
    safety_check_bypassed: z.boolean(),
    notes_to_pharmacist: z.string().nullable(),
    dispensations: z.array(
      z
        .object({
          id: UuidSchema,
          dispensed_at: TimestampSchema,
          pharmacy: z
            .object({
              id: UuidSchema,
              name: z.string(),
            })
            .strict(),
          items: z.array(
            z
              .object({
                prescription_item_id: UuidSchema,
                quantity: z.number(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    signature: z
      .object({
        alg: z.literal('EdDSA'),
        kid: z.string(),
        value_b64: z.string(),
      })
      .strict(),
    version: z.number().int(),
    verification_code_hint: z.string().optional(),
  })
  .strict();

export const DoctorPrescriptionListItemSchema = z
  .object({
    id: UuidSchema,
    rx_number: RxNumberSchema,
    status: PrescriptionStatusSchema,
    issued_at: TimestampSchema,
    expires_at: TimestampSchema,
    patient: z
      .object({
        id: UuidSchema,
        mrn: MrnSchema,
        full_name: z.string(),
      })
      .strict(),
    item_count: z.number().int(),
  })
  .strict();

export const DoctorPrescriptionsResponseSchema = createPageResponseSchema(
  DoctorPrescriptionListItemSchema,
);

export const PickupTokenResponseSchema = z
  .object({
    pickup_token: z.string().startsWith('SH1.'),
    expires_at: TimestampSchema,
    qr_payload: z.string().startsWith('SH1.'),
  })
  .strict();
