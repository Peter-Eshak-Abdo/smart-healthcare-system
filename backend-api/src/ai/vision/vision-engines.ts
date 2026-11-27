import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { buildAiCacheKey, getAiCache } from '../cache.js';
import { LlmRouter } from '../llm-router.js';
import { getKnowledgeBase } from '../rag/retriever.js';
import { recordAiTelemetry } from '../telemetry.js';

const MAX_VISION_BYTES = 1_572_864; // 1.5 MB

function assertImageWithinLimit(buf: Buffer): string {
  if (buf.length === 0) {
    throw new AppError('VALIDATION_FAILED', { detail: 'empty_image' });
  }
  if (buf.length > MAX_VISION_BYTES) {
    throw new AppError('VALIDATION_FAILED', { detail: 'image_exceeds_1_5mb_limit' });
  }
  return createHash('sha256').update(buf).digest('hex');
}

// 1. Lab Report Analyzer (Vision)
export const LabReportAnalysisSchema = z.object({
  summary: z.string(),
  abnormal_values: z.array(
    z.object({
      test_name: z.string(),
      value: z.string(),
      status: z.enum(['high', 'low', 'critical', 'normal']),
      meaning: z.string(),
    }),
  ),
  recommended_specialty_code: z.string(),
  next_steps: z.array(z.string()),
});

export type LabReportAnalysisOutput = z.infer<typeof LabReportAnalysisSchema> & {
  provider: 'gemini' | 'groq' | 'deterministic_fallback' | 'cache';
  image_hash: string;
};

export async function analyzeLabReportImage(
  env: Partial<
    Pick<
      AppEnv,
      | 'GEMINI_API_KEY'
      | 'GEMINI_API_KEYS'
      | 'GEMINI_MODEL'
      | 'GEMINI_TIER2_MODEL'
      | 'GROQ_API_KEY'
      | 'GROQ_MODEL'
      | 'GROQ_TIER2_MODEL'
    >
  >,
  input: {
    imageBuffer: Buffer;
    mimeType: string;
    locale: 'ar' | 'en';
    db?: Firestore | null;
    role?: string;
  },
): Promise<LabReportAnalysisOutput> {
  const t0 = Date.now();
  const imageHash = assertImageWithinLimit(input.imageBuffer);
  const cache = getAiCache(input.db ?? null);
  const cacheKey = buildAiCacheKey('vision_lab_report', imageHash, input.locale);

  const cached = await cache.get<LabReportAnalysisOutput>(cacheKey);
  if (cached) {
    await recordAiTelemetry(input.db ?? null, {
      feature: 'vision_lab_report',
      model: 'cache',
      provider: 'cache',
      cacheHit: true,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 650,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'patient',
    });
    return { ...cached, provider: 'cache' };
  }

  const isAr = input.locale === 'ar';
  const router = new LlmRouter(env);
  const res = await router.generateStructured({
    tier: 'tier2',
    maxTokens: 400,
    systemPrompt: [
      'Medical lab report analyzer. Extract abnormal values and explain simply without diagnosing.',
      isAr ? 'Egyptian Colloquial Arabic.' : 'Plain English.',
      'JSON: {summary,abnormal_values:[{test_name,value,status:"high"|"low"|"critical"|"normal",meaning}],recommended_specialty_code,next_steps[]}.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: 'Analyze this lab report image.',
        imageBase64: input.imageBuffer.toString('base64'),
        imageMimeType: input.mimeType,
      },
    ],
    schema: LabReportAnalysisSchema,
    fallback: () => ({
      summary: isAr
        ? 'تم استلام صورة التحليل بنجاح. يفضل عرض النتائج على الطبيب المختص لقراءة الأرقام بدقة مع حالتك الصحية.'
        : 'Lab report image received. Please share these results with your clinician for full interpretation.',
      abnormal_values: [],
      recommended_specialty_code: 'internal_medicine',
      next_steps: isAr
        ? ['احتفظ بنسخة من التحليل لعرضها على الطبيب']
        : ['Keep a copy of this report for your doctor visit'],
    }),
  });

  const out: LabReportAnalysisOutput = {
    ...res.data,
    provider: res.provider,
    image_hash: imageHash,
  };
  await cache.set(cacheKey, out, { ttlSeconds: 30 * 86400, feature: 'vision_lab_report' });

  await recordAiTelemetry(input.db ?? null, {
    feature: 'vision_lab_report',
    model: res.model,
    provider: res.provider,
    cacheHit: false,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    savedTokensEstimate: 0,
    latencyMs: Math.max(1, Date.now() - t0),
    role: input.role ?? 'patient',
  });

  return out;
}

// 2. Paper Prescription OCR Digitizer (Vision)
export const PrescriptionOcrSchema = z.object({
  medications: z.array(
    z.object({
      raw_name: z.string(),
      matched_drug_id: z.string().nullable(),
      matched_generic_name: z.string().nullable(),
      dose: z.string(),
      frequency: z.string(),
      duration_days: z.number().int().positive().nullable().optional(),
    }),
  ),
  notes: z.string(),
});

export type PrescriptionOcrOutput = z.infer<typeof PrescriptionOcrSchema> & {
  provider: 'gemini' | 'groq' | 'deterministic_fallback' | 'cache';
  image_hash: string;
};

export async function digitizePaperPrescription(
  env: Partial<
    Pick<
      AppEnv,
      | 'GEMINI_API_KEY'
      | 'GEMINI_API_KEYS'
      | 'GEMINI_MODEL'
      | 'GEMINI_TIER2_MODEL'
      | 'GROQ_API_KEY'
      | 'GROQ_MODEL'
      | 'GROQ_TIER2_MODEL'
    >
  >,
  input: {
    imageBuffer: Buffer;
    mimeType: string;
    locale: 'ar' | 'en';
    db?: Firestore | null;
    role?: string;
  },
): Promise<PrescriptionOcrOutput> {
  const t0 = Date.now();
  const imageHash = assertImageWithinLimit(input.imageBuffer);
  const cache = getAiCache(input.db ?? null);
  const cacheKey = buildAiCacheKey('vision_rx_ocr', imageHash, input.locale);

  const cached = await cache.get<PrescriptionOcrOutput>(cacheKey);
  if (cached) {
    await recordAiTelemetry(input.db ?? null, {
      feature: 'vision_rx_ocr',
      model: 'cache',
      provider: 'cache',
      cacheHit: true,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 600,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'patient',
    });
    return { ...cached, provider: 'cache' };
  }

  const router = new LlmRouter(env);
  const res = await router.generateStructured({
    tier: 'tier2',
    maxTokens: 350,
    systemPrompt:
      'Extract medications from paper prescription image. JSON: {medications:[{raw_name,matched_drug_id:null,matched_generic_name:null,dose,frequency,duration_days}],notes}.',
    messages: [
      {
        role: 'user',
        content: 'Digitize all prescribed medications from this prescription.',
        imageBase64: input.imageBuffer.toString('base64'),
        imageMimeType: input.mimeType,
      },
    ],
    schema: PrescriptionOcrSchema,
    fallback: () => ({
      medications: [],
      notes:
        input.locale === 'ar'
          ? 'تعذر قراءة الروشتة تلقائياً حالياً. يرجى مراجعة الصيدلي أو إدخال الأصناف يدوياً.'
          : 'Automatic OCR unavailable right now; please enter medications manually.',
    }),
  });

  // Match extracted names against local drugs-dataset.json (0 extra tokens)
  const kb = getKnowledgeBase();
  const matchedMeds = res.data.medications.map((m) => {
    const kbHit = kb.findDrugByQuery(m.raw_name);
    return {
      ...m,
      matched_drug_id: kbHit?.id ?? m.matched_drug_id ?? null,
      matched_generic_name: kbHit?.generic_name ?? m.matched_generic_name ?? null,
    };
  });

  const out: PrescriptionOcrOutput = {
    medications: matchedMeds,
    notes: res.data.notes,
    provider: res.provider,
    image_hash: imageHash,
  };
  await cache.set(cacheKey, out, { ttlSeconds: 30 * 86400, feature: 'vision_rx_ocr' });

  await recordAiTelemetry(input.db ?? null, {
    feature: 'vision_rx_ocr',
    model: res.model,
    provider: res.provider,
    cacheHit: false,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    savedTokensEstimate: 0,
    latencyMs: Math.max(1, Date.now() - t0),
    role: input.role ?? 'patient',
  });

  return out;
}

// 3. Medicine Box Scanner (Vision + Local Drug DB + Local Allergy Check)
export const MedicineBoxVisionSchema = z.object({
  detected_brand: z.string(),
  detected_generic: z.string(),
  usage_summary: z.string(),
  timing: z.string(),
});

export interface MedicineBoxScanOutput {
  detected_brand: string;
  detected_generic: string;
  matched_drug_id: string | null;
  usage_summary: string;
  timing: string;
  allergy_warnings: string[];
  provider: 'gemini' | 'groq' | 'deterministic_fallback' | 'cache';
  image_hash: string;
}

export async function scanMedicineBoxImage(
  env: Partial<
    Pick<
      AppEnv,
      | 'GEMINI_API_KEY'
      | 'GEMINI_API_KEYS'
      | 'GEMINI_MODEL'
      | 'GEMINI_TIER2_MODEL'
      | 'GROQ_API_KEY'
      | 'GROQ_MODEL'
      | 'GROQ_TIER2_MODEL'
    >
  >,
  input: {
    imageBuffer: Buffer;
    mimeType: string;
    locale: 'ar' | 'en';
    patientAllergies?: Array<{ allergen_code?: string | null }>;
    db?: Firestore | null;
    role?: string;
  },
): Promise<MedicineBoxScanOutput> {
  const t0 = Date.now();
  const imageHash = assertImageWithinLimit(input.imageBuffer);
  const cache = getAiCache(input.db ?? null);
  const cacheKey = buildAiCacheKey('vision_med_box', imageHash, input.locale);

  let baseVision = await cache.get<z.infer<typeof MedicineBoxVisionSchema> & { provider: MedicineBoxScanOutput['provider'] }>(cacheKey);
  const isAr = input.locale === 'ar';

  if (!baseVision) {
    const router = new LlmRouter(env);
    const res = await router.generateStructured({
      tier: 'tier2',
      maxTokens: 250,
      systemPrompt: [
        'Identify medicine box brand + active ingredient.',
        isAr ? 'Explain usage & timing in Egyptian Arabic.' : 'Explain usage & timing in English.',
        'JSON: {detected_brand,detected_generic,usage_summary,timing}.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: 'Identify this medicine box.',
          imageBase64: input.imageBuffer.toString('base64'),
          imageMimeType: input.mimeType,
        },
      ],
      schema: MedicineBoxVisionSchema,
      fallback: () => ({
        detected_brand: isAr ? 'غير محدد' : 'Unidentified',
        detected_generic: '',
        usage_summary: isAr
          ? 'تعذر التعرف على العلبة تلقائياً. استخدم البحث بالاسم أو راجع الصيدلي.'
          : 'Could not identify box automatically; please search by name or ask a pharmacist.',
        timing: isAr ? 'حسب إرشادات الطبيب' : 'As directed by physician',
      }),
    });
    baseVision = { ...res.data, provider: res.provider };
    await cache.set(cacheKey, baseVision, { ttlSeconds: 30 * 86400, feature: 'vision_med_box' });
    await recordAiTelemetry(input.db ?? null, {
      feature: 'vision_med_box',
      model: res.model,
      provider: res.provider,
      cacheHit: false,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      savedTokensEstimate: 0,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'patient',
    });
  } else {
    await recordAiTelemetry(input.db ?? null, {
      feature: 'vision_med_box',
      model: 'cache',
      provider: 'cache',
      cacheHit: true,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 450,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'patient',
    });
    baseVision = { ...baseVision, provider: 'cache' };
  }

  // Local 0-token drug DB match + allergy cross-check
  const kb = getKnowledgeBase();
  const kbDrug =
    kb.findDrugByQuery(baseVision.detected_brand) ??
    kb.findDrugByQuery(baseVision.detected_generic);

  const allergyWarnings: string[] = [];
  if (kbDrug && input.patientAllergies?.length) {
    for (const al of input.patientAllergies) {
      if (!al.allergen_code) continue;
      if (
        kbDrug.active_ingredients.includes(al.allergen_code) ||
        kbDrug.drug_classes.includes(al.allergen_code)
      ) {
        allergyWarnings.push(
          isAr
            ? `تحذير حساسية: هذا الدواء يحتوي على (${al.allergen_code}) المسجل في حساسيتك!`
            : `Allergy Alert: Matches your recorded allergy (${al.allergen_code})!`,
        );
      }
    }
  }

  return {
    detected_brand: baseVision.detected_brand,
    detected_generic: kbDrug?.generic_name ?? baseVision.detected_generic,
    matched_drug_id: kbDrug?.id ?? null,
    usage_summary: kbDrug
      ? isAr
        ? `${kbDrug.generic_name_ar} — ${kbDrug.warnings_ar}`
        : `${kbDrug.generic_name} — ${kbDrug.warnings_en}`
      : baseVision.usage_summary,
    timing: kbDrug
      ? isAr
        ? kbDrug.timing_instructions_ar
        : kbDrug.timing_instructions_en
      : baseVision.timing,
    allergy_warnings: allergyWarnings,
    provider: baseVision.provider,
    image_hash: imageHash,
  };
}
