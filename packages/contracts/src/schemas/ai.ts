import { z } from 'zod';
import { LocaleSchema, UuidSchema } from './common.js';

export const PatientAiSummaryParamSchema = z
  .object({
    patientId: UuidSchema,
  })
  .strict();

export const AiLocaleQuerySchema = z
  .object({
    locale: LocaleSchema.default('ar'),
  })
  .strict();

export const PatientAiSummaryResponseSchema = z
  .object({
    patient_id: UuidSchema,
    headline: z.string(),
    critical_alerts: z.array(z.string()),
    active_conditions: z.array(z.string()),
    active_medications: z.array(z.string()),
    allergies_summary: z.string(),
    recent_visits_summary: z.string(),
    clinical_takeaway: z.string(),
    provider: z.enum(['gemini', 'groq', 'deterministic_fallback', 'cache']),
  })
  .strict();

export const PrescriptionExplainParamSchema = z
  .object({
    prescriptionId: UuidSchema,
  })
  .strict();

export const PrescriptionExplainResponseSchema = z
  .object({
    prescription_id: UuidSchema,
    overall_summary: z.string(),
    items: z.array(
      z
        .object({
          drug_name: z.string(),
          purpose: z.string(),
          timing_and_food: z.string(),
          simple_schedule: z.string(),
          warnings: z.array(z.string()),
        })
        .strict(),
    ),
    general_tips: z.array(z.string()),
    provider: z.enum(['gemini', 'groq', 'deterministic_fallback', 'cache']),
  })
  .strict();

export const SmartSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200),
    locale: LocaleSchema.default('ar'),
  })
  .strict();

export const SmartSearchResponseSchema = z
  .object({
    intent: z.enum(['medication', 'symptom_triage', 'specialty', 'general']),
    recommended_specialty_code: z.string().nullable(),
    matches: z.array(
      z
        .object({
          id: z.string(),
          kind: z.enum(['drug', 'triage']),
          title: z.string(),
          subtitle: z.string(),
          specialty_code: z.string().nullable().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const SoapScribeRequestSchema = z
  .object({
    transcript: z.string().trim().min(5).max(3000),
    locale: LocaleSchema.default('ar'),
  })
  .strict();

export const ChronicAnomaliesRequestSchema = z
  .object({
    readings: z
      .array(
        z
          .object({
            type: z.enum(['blood_pressure', 'blood_glucose', 'heart_rate']),
            systolic: z.number().min(40).max(300).optional(),
            diastolic: z.number().min(20).max(200).optional(),
            value: z.number().min(10).max(1000).optional(),
            recorded_at: z.string(),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict();

export const AdminAiMetricsResponseSchema = z
  .object({
    total_requests_today: z.number().int().nonnegative(),
    cache_hit_rate: z.number().min(0).max(1),
    total_tokens_used_today: z.number().int().nonnegative(),
    estimated_tokens_saved_today: z.number().int().nonnegative(),
    zero_token_requests_today: z.number().int().nonnegative(),
    providers: z.record(z.number().int().nonnegative()),
  })
  .strict();
