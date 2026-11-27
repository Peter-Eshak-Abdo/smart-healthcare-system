import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import { LlmRouter } from '../llm-router.js';
import { scrubPii } from '../pii.js';
import { getKnowledgeBase } from '../rag/retriever.js';
import { recordAiTelemetry } from '../telemetry.js';

export const SoapScribeOutputSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  draft_medications: z.array(
    z.object({
      name: z.string(),
      matched_drug_id: z.string().nullable().optional(),
      dose: z.string(),
      frequency: z.string(),
      duration_days: z.number().int().positive().nullable().optional(),
    }),
  ),
});

export type SoapScribeOutput = z.infer<typeof SoapScribeOutputSchema> & {
  provider: 'gemini' | 'groq' | 'deterministic_fallback';
};

/**
 * Pillar 5.1: Zero-Audio-Token AI Medical Scribe
 * Accepts plain-text transcript from free browser/device STT (ar-EG / en)
 * and structures it into SOAP Notes + Draft E-Prescription via Tier 1 LLM.
 */
export async function generateSoapFromTranscript(
  env: Partial<
    Pick<
      AppEnv,
      | 'GEMINI_API_KEY'
      | 'GEMINI_API_KEYS'
      | 'GEMINI_MODEL'
      | 'GEMINI_TIER1_MODEL'
      | 'GROQ_API_KEY'
      | 'GROQ_MODEL'
      | 'GROQ_TIER1_MODEL'
    >
  >,
  input: {
    transcript: string;
    locale: 'ar' | 'en';
    db?: Firestore | null;
    role?: string;
  },
): Promise<SoapScribeOutput> {
  const t0 = Date.now();
  const safeTranscript = scrubPii(input.transcript).slice(0, 2500);
  const isAr = input.locale === 'ar';

  const router = new LlmRouter(env);
  const res = await router.generateStructured({
    tier: 'tier1',
    maxTokens: 350,
    systemPrompt: [
      'Medical scribe AI. Convert doctor dictation transcript into structured SOAP notes & draft medications.',
      isAr ? 'Use clear clinical Arabic/English terms.' : 'Use clear clinical English.',
      'JSON: {subjective,objective,assessment,plan,draft_medications:[{name,dose,frequency,duration_days}]}.',
    ].join('\n'),
    messages: [{ role: 'user', content: safeTranscript }],
    schema: SoapScribeOutputSchema,
    fallback: () => ({
      subjective: safeTranscript,
      objective: isAr ? 'يُستكمل الفحص السريري' : 'Physical exam findings to be recorded',
      assessment: isAr ? 'التقييم السريري المبدئي' : 'Initial clinical assessment',
      plan: isAr ? 'خطة العلاج والمتابعة' : 'Treatment and follow-up plan',
      draft_medications: [],
    }),
  });

  const kb = getKnowledgeBase();
  const matchedMeds = res.data.draft_medications.map((m) => ({
    ...m,
    matched_drug_id: kb.findDrugByQuery(m.name)?.id ?? m.matched_drug_id ?? null,
  }));

  await recordAiTelemetry(input.db ?? null, {
    feature: 'voice_soap_scribe',
    model: res.model,
    provider: res.provider,
    cacheHit: false,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    savedTokensEstimate: 500, // zero audio upload tokens
    latencyMs: Math.max(1, Date.now() - t0),
    role: input.role ?? 'doctor',
  });

  return {
    ...res.data,
    draft_medications: matchedMeds,
    provider: res.provider,
  };
}
