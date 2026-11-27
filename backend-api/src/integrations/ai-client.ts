import { LocalizedTextSchema } from '@smarthealth/contracts';
import { z } from 'zod';
import { analyzeFaceBiometric } from '../ai/biometrics/face-engine.js';
import {
  explainPrescription,
  type ExplainPrescriptionInput,
  type PrescriptionExplanationOutput,
} from '../ai/clinical/prescription-explainer.js';
import { runDynamicClinicalSafety } from '../ai/clinical/safety-engine.js';
import {
  summarizePatientHistory,
  type PatientHistoryInput,
  type PatientSummaryOutput,
} from '../ai/clinical/summarizer.js';
import { runSmartSearch, type SmartSearchOutput } from '../ai/search/smart-search.js';
import { runAssistantTriage } from '../ai/triage/assistant-engine.js';
import type { AppEnv } from '../config/env.js';
import { AppError } from '../shared/errors.js';

export const InternalFaceAnalyzeResponseSchema = z
  .object({
    face_detected: z.boolean(),
    face_count: z.number().int().nonnegative(),
    selected_face: z
      .object({
        bbox: z.array(z.number().int()),
        det_score: z.number(),
      })
      .nullable(),
    quality: z
      .object({
        score: z.number(),
        blur: z.number(),
        brightness: z.number(),
        yaw: z.number(),
        pitch: z.number(),
        passed: z.boolean(),
        hints: z.array(z.string()),
      })
      .strict(),
    liveness: z
      .object({
        mode: z.enum(['active', 'passive']),
        score: z.number(),
        passed: z.boolean(),
        checks: z
          .object({
            pad_model: z.number(),
            challenge_completed: z.boolean().nullable().optional(),
            frame_consistency: z.boolean().nullable().optional(),
          })
          .strict(),
      })
      .strict(),
    template: z
      .object({
        vector: z.array(z.number()),
        dim: z.number().int(),
      })
      .nullable(),
    model_version: z.string(),
    transform_key_version: z.number().int(),
    timings_ms: z
      .object({
        decode: z.number().int(),
        detect: z.number().int(),
        liveness: z.number().int(),
        embed: z.number().int(),
        total: z.number().int(),
      })
      .strict(),
  })
  .strict();

export type InternalFaceAnalyzeResponse = z.infer<typeof InternalFaceAnalyzeResponseSchema>;

export const InternalClinicalAlertSchema = z
  .object({
    alert_key: z.string(),
    type: z.enum(['drug_drug', 'drug_allergy', 'duplicate_therapy', 'drug_condition']),
    severity: z.enum(['minor', 'moderate', 'major', 'contraindicated']),
    item_keys: z.array(z.string()),
    related_keys: z.array(z.string()),
    rule_id: z.string(),
    title: LocalizedTextSchema,
    message: LocalizedTextSchema,
    management: LocalizedTextSchema,
    source: z.string(),
    from_restricted_record: z.boolean().optional().default(false),
  })
  .strict();

export const InternalClinicalCheckResponseSchema = z
  .object({
    checks_status: z.enum(['complete', 'partial']),
    engine_version: z.string(),
    dataset_version: z.string(),
    unmapped_drug_ids: z.array(z.string()),
    alerts: z.array(InternalClinicalAlertSchema),
  })
  .strict();

export type InternalClinicalCheckResponse = z.infer<typeof InternalClinicalCheckResponseSchema>;

export const InternalAssistantTriageResponseSchema = z
  .object({
    triage: z
      .object({
        level: z.enum(['emergency', 'urgent', 'soon', 'routine', 'self_care']),
        red_flag: z.boolean(),
        rule_ids: z.array(z.string()),
        emergency_action: z.string().nullable(),
      })
      .strict(),
    reply: z
      .object({
        text: z.string(),
        self_care: z.array(z.string()),
        warning_signs: z.array(z.string()),
      })
      .strict(),
    recommended_specialty_code: z.string(),
    specialty_reason: z.string(),
    follow_up_questions: z.array(z.string()),
    llm_used: z.boolean(),
    validator: z
      .object({
        violations: z.array(z.string()),
        regenerated: z.boolean(),
        fallback_used: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type InternalAssistantTriageResponse = z.infer<
  typeof InternalAssistantTriageResponseSchema
>;

export interface FaceAnalyzeInput {
  mode: 'enroll' | 'identify' | 'verify';
  livenessMode: 'active' | 'passive';
  challenge?: { challenge_id: string; sequence: string[]; issued_at?: string };
  frames: Buffer[];
  priority?: 'emergency' | 'general';
  clientEmbedding?: number[];
  clientLivenessScore?: number;
  clientQualityScore?: number;
}

export interface ClinicalCheckInput {
  proposed: Array<{ key: string; drug_id: string }>;
  current: Array<{ key: string; drug_id: string; from_restricted_record: boolean }>;
  allergies: Array<{
    allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
    allergen_code?: string | null;
    free_text_present?: boolean;
    severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
  }>;
  conditions: Array<{ icd10_code: string }>;
  locale: 'ar' | 'en';
}

export interface AssistantTriageInput {
  session_ref: string;
  locale: 'ar' | 'en';
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  message: string;
  patient_context: {
    age_band: string;
    sex: 'male' | 'female';
    pregnant?: boolean | null;
    allergies?: string[];
    conditions?: string[];
    activeMedications?: string[];
    knownNames?: string[];
  };
}

export interface AiClientPort {
  analyzeFace(input: FaceAnalyzeInput): Promise<InternalFaceAnalyzeResponse>;
  checkClinicalInteractions(input: ClinicalCheckInput): Promise<InternalClinicalCheckResponse>;
  triageAssistant(input: AssistantTriageInput): Promise<InternalAssistantTriageResponse>;
  summarizeHistory?(input: PatientHistoryInput): Promise<PatientSummaryOutput>;
  explainPrescription?(input: ExplainPrescriptionInput): Promise<PrescriptionExplanationOutput>;
  smartSearch?(input: { query: string; locale: 'ar' | 'en' }): Promise<SmartSearchOutput>;
}

/**
 * Integrated in-process AI + RAG client (zero external Python microservice).
 */
export class AiClient implements AiClientPort {
  constructor(private readonly env: AppEnv) {}

  async analyzeFace(input: FaceAnalyzeInput): Promise<InternalFaceAnalyzeResponse> {
    return analyzeFaceBiometric(this.env, input);
  }

  async checkClinicalInteractions(input: ClinicalCheckInput): Promise<InternalClinicalCheckResponse> {
    return runDynamicClinicalSafety(this.env, input);
  }

  async triageAssistant(input: AssistantTriageInput): Promise<InternalAssistantTriageResponse> {
    return runAssistantTriage(this.env, {
      locale: input.locale,
      message: input.message,
      history: input.history,
      patientContext: input.patient_context,
    });
  }

  async summarizeHistory(input: PatientHistoryInput): Promise<PatientSummaryOutput> {
    return summarizePatientHistory(this.env, input);
  }

  async explainPrescription(input: ExplainPrescriptionInput): Promise<PrescriptionExplanationOutput> {
    return explainPrescription(this.env, input);
  }

  async smartSearch(input: { query: string; locale: 'ar' | 'en' }): Promise<SmartSearchOutput> {
    return runSmartSearch(this.env, input);
  }
}

export function mapFaceAnalysisFailure(analysis: InternalFaceAnalyzeResponse): AppError {
  if (!analysis.face_detected || analysis.face_count === 0) {
    return new AppError('BIO_NO_FACE');
  }
  if (analysis.face_count > 1) {
    return new AppError('BIO_MULTIPLE_FACES');
  }
  if (!analysis.quality.passed) {
    return new AppError('BIO_LOW_QUALITY', {
      detail: analysis.quality.hints[0] ?? 'low_quality',
    });
  }
  if (!analysis.liveness.passed) {
    return new AppError('BIO_LIVENESS_FAILED');
  }
  return new AppError('BIO_LOW_QUALITY', { detail: 'missing_template' });
}
