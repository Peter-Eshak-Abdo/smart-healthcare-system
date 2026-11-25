import { LocalizedTextSchema } from '@smarthealth/contracts';
import CircuitBreaker from 'opossum';
import { request as undiciRequest } from 'undici';
import { z } from 'zod';
import type { AppEnv } from '../config/env.js';
import type { AiScope, InternalJwtSigner } from '../security/internal-jwt.js';
import { AppError } from '../shared/errors.js';
import { getRequestId } from '../shared/request-context.js';

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
  };
}

export interface AiClientPort {
  analyzeFace(input: FaceAnalyzeInput): Promise<InternalFaceAnalyzeResponse>;
  checkClinicalInteractions(input: ClinicalCheckInput): Promise<InternalClinicalCheckResponse>;
  triageAssistant(input: AssistantTriageInput): Promise<InternalAssistantTriageResponse>;
}

const BASE_BREAKER_OPTS = {
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 3,
};

export class AiClient implements AiClientPort {
  private readonly faceBreaker: CircuitBreaker<[FaceAnalyzeInput], InternalFaceAnalyzeResponse>;
  private readonly clinicalBreaker: CircuitBreaker<[ClinicalCheckInput], InternalClinicalCheckResponse>;
  private readonly assistantBreaker: CircuitBreaker<[AssistantTriageInput], InternalAssistantTriageResponse>;

  constructor(
    private readonly env: AppEnv,
    private readonly internalJwt: InternalJwtSigner,
  ) {
    this.faceBreaker = new CircuitBreaker((input: FaceAnalyzeInput) => this.callFace(input), {
      ...BASE_BREAKER_OPTS,
      timeout: 15_000,
    });
    this.clinicalBreaker = new CircuitBreaker(
      (input: ClinicalCheckInput) => this.postJson('/clinical/check-interactions', 'clinical', input, InternalClinicalCheckResponseSchema, 3_000),
      { ...BASE_BREAKER_OPTS, timeout: 3_000 },
    );
    this.assistantBreaker = new CircuitBreaker(
      (input: AssistantTriageInput) => this.postJson('/assistant/triage', 'assistant', input, InternalAssistantTriageResponseSchema, 9_000),
      { ...BASE_BREAKER_OPTS, timeout: 9_000 },
    );
  }

  async analyzeFace(input: FaceAnalyzeInput): Promise<InternalFaceAnalyzeResponse> {
    return this.mapBreakerCall(() => this.faceBreaker.fire(input));
  }

  async checkClinicalInteractions(input: ClinicalCheckInput): Promise<InternalClinicalCheckResponse> {
    return this.mapBreakerCall(() => this.clinicalBreaker.fire(input));
  }

  async triageAssistant(input: AssistantTriageInput): Promise<InternalAssistantTriageResponse> {
    return this.mapBreakerCall(() => this.assistantBreaker.fire(input));
  }

  private async mapBreakerCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.message.toLowerCase().includes('timed out')) {
        throw new AppError('AI_TIMEOUT', { cause: err });
      }
      throw new AppError('AI_SERVICE_UNAVAILABLE', { cause: err });
    }
  }

  private async callFace(input: FaceAnalyzeInput): Promise<InternalFaceAnalyzeResponse> {
    const rid = getRequestId();
    const token = await this.internalJwt.sign({ scope: 'face', ...(rid ? { rid } : {}) });

    const form = new FormData();
    form.set('mode', input.mode);
    form.set('liveness_mode', input.livenessMode);
    if (input.challenge) {
      form.set('challenge', JSON.stringify(input.challenge));
    }
    input.frames.forEach((buf, idx) => {
      form.append('frames', new Blob([Uint8Array.from(buf)], { type: 'image/jpeg' }), `frame-${idx}.jpg`);
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14_500);
    try {
      const response = await fetch(`${this.env.AI_SERVICE_URL}/internal/v1/face/analyze`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          ...(rid ? { 'x-request-id': rid } : {}),
          ...(input.priority === 'emergency' ? { 'x-priority': 'emergency' } : {}),
        },
        body: form,
        signal: controller.signal,
      });

      if (response.status >= 500) {
        throw new AppError('AI_SERVICE_UNAVAILABLE');
      }
      if (!response.ok) {
        throw new AppError('VALIDATION_FAILED', { detail: `ai_face_rejected_${response.status}` });
      }
      return InternalFaceAnalyzeResponseSchema.parse(await response.json());
    } finally {
      clearTimeout(timer);
    }
  }

  private async postJson<T extends z.ZodTypeAny>(
    path: string,
    scope: AiScope,
    body: unknown,
    schema: T,
    timeoutMs: number,
  ): Promise<z.infer<T>> {
    const rid = getRequestId();
    const token = await this.internalJwt.sign({ scope, ...(rid ? { rid } : {}) });
    const res = await undiciRequest(`${this.env.AI_SERVICE_URL}/internal/v1${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(rid ? { 'x-request-id': rid } : {}),
      },
      body: JSON.stringify(body),
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });

    if (res.statusCode >= 500) {
      throw new AppError('AI_SERVICE_UNAVAILABLE');
    }
    if (res.statusCode >= 400) {
      throw new AppError('VALIDATION_FAILED', { detail: `ai_rejected_${res.statusCode}` });
    }
    const raw = await res.body.json();
    return schema.parse(raw);
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
