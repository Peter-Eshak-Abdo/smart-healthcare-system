import { z } from 'zod';
import {
  AllergySeveritySchema,
  BloodTypeSchema,
  SexSchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';

export const EmergencyReasonCodeSchema = z.enum([
  'unconscious',
  'unable_to_communicate',
  'altered_mental_status',
  'language_barrier',
  'other',
]);

export const EmergencySessionParamSchema = z
  .object({
    sessionId: UuidSchema,
  })
  .strict();

export const EmergencySessionSummarySchema = z
  .object({
    id: UuidSchema,
    expires_at: TimestampSchema,
    low_confidence: z.boolean(),
  })
  .strict();

export const EmergencyPatientPreviewSchema = z
  .object({
    full_name: z.string(),
    age: z.number().int().nonnegative(),
    sex: SexSchema,
    mrn_last4: z.string().length(4),
  })
  .strict();

export const EmergencyIdentifyMatchResponseSchema = z
  .object({
    result: z.literal('match'),
    session: EmergencySessionSummarySchema,
    patient_preview: EmergencyPatientPreviewSchema,
    card_expired: z.boolean().optional(),
  })
  .strict();

export const EmergencyIdentifyPossibleResponseSchema = z
  .object({
    result: z.literal('possible_match'),
    candidates: z.array(
      z
        .object({
          candidate_token: z.string(),
          sex: SexSchema,
          age_band: z.string(),
        })
        .strict(),
    ),
    candidate_tokens_expire_in: z.number().int(),
  })
  .strict();

export const EmergencyIdentifyNoMatchResponseSchema = z
  .object({
    result: z.literal('no_match'),
    fallbacks: z.array(z.enum(['emergency_card_qr', 'national_id_search'])),
  })
  .strict();

export const EmergencyIdentifyResponseSchema = z.union([
  EmergencyIdentifyMatchResponseSchema,
  EmergencyIdentifyPossibleResponseSchema,
  EmergencyIdentifyNoMatchResponseSchema,
]);

export const EmergencyConfirmCandidateRequestSchema = z
  .object({
    candidate_token: z.string().min(10),
    reason_code: EmergencyReasonCodeSchema,
    incident_ref: z.string().trim().max(64).optional(),
  })
  .strict();

export const EmergencyIdentifyCardRequestSchema = z
  .object({
    card_qr_payload: z.string().startsWith('SHEC1.'),
    reason_code: EmergencyReasonCodeSchema,
    incident_ref: z.string().trim().max(64).optional(),
  })
  .strict();

export const EmergencyIdentifyManualRequestSchema = z
  .object({
    id_document_type: z.enum(['national_id', 'passport']),
    id_document_number: z.string().trim().min(5).max(32),
    reason_code: EmergencyReasonCodeSchema,
    incident_ref: z.string().trim().max(64).optional(),
  })
  .strict();

/**
 * STRICT CLOSED EMERGENCY PROFILE SCHEMA (US-17-AC1).
 * Never add fields beyond docs/03 §9.4.
 */
export const EmergencyProfileResponseSchema = z
  .object({
    session: z
      .object({
        id: UuidSchema,
        expires_at: TimestampSchema,
        low_confidence: z.boolean(),
        method: z.enum(['face', 'emergency_card_qr', 'manual_search']),
      })
      .strict(),
    patient: EmergencyPatientPreviewSchema,
    blood_type: z
      .object({
        value: BloodTypeSchema,
        verified: z.boolean(),
      })
      .strict(),
    allergies: z.array(
      z
        .object({
          name: z.string(),
          severity: AllergySeveritySchema,
          verified: z.boolean(),
        })
        .strict(),
    ),
    chronic_conditions: z.array(
      z
        .object({
          name: z.string(),
          since_year: z.number().int().nullable(),
        })
        .strict(),
    ),
    current_medications: z.array(
      z
        .object({
          name: z.string(),
          dose_text: z.string(),
        })
        .strict(),
    ),
    has_shared_contacts: z.boolean(),
    generated_at: TimestampSchema,
  })
  .strict();

export const EmergencySessionContactsResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          full_name: z.string(),
          relationship: z.string(),
          phone: z.string(),
          priority: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();

export const ExtendEmergencySessionRequestSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const ExtendEmergencySessionResponseSchema = z
  .object({
    expires_at: TimestampSchema,
  })
  .strict();

export const OfflineEmergencyEventsRequestSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            event_id: UuidSchema,
            type: z.literal('offline_card_view'),
            card_mrn: z.string().min(4).max(32),
            card_iat: z.number().int(),
            occurred_at: TimestampSchema,
            device_signature_b64: z.string().min(16),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const OfflineEmergencyEventsResponseSchema = z
  .object({
    accepted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  })
  .strict();
