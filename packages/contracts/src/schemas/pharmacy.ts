import { z } from 'zod';
import {
  AllergySeveritySchema,
  createPageResponseSchema,
  DateSchema,
  LicenseStatusSchema,
  PaginationQuerySchema,
  PrescriptionStatusSchema,
  RxItemStatusSchema,
  RxNumberSchema,
  SexSchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';
import { PrescriptionDetailSchema } from './prescriptions.js';

export const VerifyPickupTokenModeSchema = z
  .object({
    mode: z.literal('pickup_token'),
    pickup_token: z.string().startsWith('SH1.'),
    pharmacy_id: UuidSchema,
  })
  .strict();

export const VerifyRxCodeSmsModeSchema = z
  .object({
    mode: z.literal('rx_code'),
    rx_number: RxNumberSchema,
    verification_code: z.string().trim().min(4).max(12),
    pharmacy_id: UuidSchema,
    presence: z.discriminatedUnion('method', [
      z
        .object({
          method: z.literal('sms_otp'),
          otp_request_id: UuidSchema.nullable(),
          otp_code: z.string().trim().min(4).max(10).optional(),
        })
        .strict(),
      z
        .object({
          method: z.literal('face_1to1'),
          face_verification_id: UuidSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export const VerifyPrescriptionRequestSchema = z.union([
  VerifyPickupTokenModeSchema,
  VerifyRxCodeSmsModeSchema,
]);

export const VerifySmsPendingResponseSchema = z
  .object({
    otp_request_id: UuidSchema,
    sent_to: z.string(),
  })
  .strict();

export const PharmacyPatientInfoSchema = z
  .object({
    full_name: z.string(),
    age: z.number().int(),
    sex: SexSchema,
    allergies: z.array(
      z
        .object({
          name: z.string(),
          severity: AllergySeveritySchema,
        })
        .strict(),
    ),
  })
  .strict();

export const VerifyPrescriptionResponseSchema = z
  .object({
    verification_id: UuidSchema,
    result: z.enum([
      'valid',
      'already_dispensed',
      'expired',
      'cancelled',
      'prescriber_invalid',
    ]),
    valid_until: TimestampSchema,
    prescription: PrescriptionDetailSchema,
    patient_for_pharmacy: PharmacyPatientInfoSchema,
    prescriber_status: z
      .object({
        license_status: LicenseStatusSchema,
        note: z.string().nullable(),
      })
      .strict(),
    checks: z
      .object({
        signature: z.enum(['ok', 'failed']),
        payload_integrity: z.enum(['ok', 'failed']),
        expiry: z.enum(['ok', 'expired']),
        status: z.enum(['ok', 'already_dispensed', 'cancelled']),
        prescriber: z.enum(['ok', 'invalid']),
      })
      .strict(),
  })
  .strict();

export const PharmacyPrescriptionQuerySchema = z
  .object({
    verification_id: UuidSchema,
  })
  .strict();

export const PharmacyGetPrescriptionResponseSchema = z
  .object({
    prescription: PrescriptionDetailSchema,
    patient_for_pharmacy: PharmacyPatientInfoSchema,
  })
  .strict();

export const AcquireLeaseRequestSchema = z
  .object({
    verification_id: UuidSchema,
    force: z.boolean().default(false),
  })
  .strict();

export const AcquireLeaseResponseSchema = z
  .object({
    lease_id: UuidSchema,
    expires_at: TimestampSchema,
  })
  .strict();

export const DispenseItemInputSchema = z
  .object({
    prescription_item_id: UuidSchema,
    quantity: z.number().positive(),
    substituted_drug_id: UuidSchema.nullable().optional(),
    batch_number: z.string().trim().max(64).optional(),
    expiry_date: DateSchema.optional(),
  })
  .strict();

export const DispenseRequestSchema = z
  .object({
    verification_id: UuidSchema,
    expected_version: z.number().int().optional(),
    items: z.array(DispenseItemInputSchema).min(1).max(20),
    counselling_given: z.boolean().default(false),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const DispenseResponseSchema = z
  .object({
    dispensation_id: UuidSchema,
    prescription_status: PrescriptionStatusSchema,
    items: z.array(
      z
        .object({
          prescription_item_id: UuidSchema,
          quantity_dispensed_now: z.number(),
          quantity_remaining: z.number(),
          status: RxItemStatusSchema,
        })
        .strict(),
    ),
    dispensed_at: TimestampSchema,
    version: z.number().int(),
  })
  .strict();

export const PharmacyFaceVerifyResponseSchema = z
  .object({
    face_verification_id: UuidSchema,
    result: z.enum(['match', 'no_match']),
    valid_for_seconds: z.number().int(),
  })
  .strict();

export const PharmacyHistoryQuerySchema = PaginationQuerySchema.extend({
  from: TimestampSchema.optional(),
  to: TimestampSchema.optional(),
}).strict();

export const PharmacyHistoryItemSchema = z
  .object({
    dispensation_id: UuidSchema,
    prescription_id: UuidSchema,
    rx_number: RxNumberSchema,
    dispensed_at: TimestampSchema,
    pharmacy_id: UuidSchema,
    item_count: z.number().int(),
  })
  .strict();

export const PharmacyHistoryResponseSchema = createPageResponseSchema(PharmacyHistoryItemSchema);
