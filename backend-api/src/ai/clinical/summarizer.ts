import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import { buildAiCacheKey, getAiCache } from '../cache.js';
import { LlmRouter } from '../llm-router.js';
import { scrubPii } from '../pii.js';
import { recordAiTelemetry } from '../telemetry.js';

export const PatientSummarySchema = z.object({
  headline: z.string(),
  critical_alerts: z.array(z.string()),
  active_conditions: z.array(z.string()),
  active_medications: z.array(z.string()),
  allergies_summary: z.string(),
  recent_visits_summary: z.string(),
  clinical_takeaway: z.string(),
});

export type PatientSummaryOutput = z.infer<typeof PatientSummarySchema> & {
  provider: 'gemini' | 'groq' | 'deterministic_fallback' | 'cache';
};

export interface PatientHistoryInput {
  patientId?: string;
  lastRecordUpdatedAt?: string;
  locale: 'ar' | 'en';
  ageBand: string;
  sex: 'male' | 'female';
  bloodType?: string | null;
  allergies: Array<{ name: string; severity: string }>;
  conditions: Array<{ name: string; icd10?: string | null; status: string }>;
  medications: Array<{ name: string; dosage?: string | null; status: string }>;
  recentEncounters: Array<{ date: string; summary: string }>;
  db?: Firestore | null;
  role?: string;
}

export async function summarizePatientHistory(
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
  input: PatientHistoryInput,
): Promise<PatientSummaryOutput> {
  const t0 = Date.now();
  const sanitizedEncounters = input.recentEncounters.slice(0, 6).map((e) => ({
    date: e.date,
    summary: scrubPii(e.summary).slice(0, 120),
  }));

  const cache = getAiCache(input.db ?? null);
  const timelinePayload = {
    age_band: input.ageBand,
    sex: input.sex,
    blood_type: input.bloodType ?? 'unknown',
    allergies: input.allergies,
    conditions: input.conditions,
    medications: input.medications,
    recent_encounters: sanitizedEncounters,
  };
  const versionStamp =
    input.lastRecordUpdatedAt ??
    createHash('sha256').update(JSON.stringify(timelinePayload)).digest('hex').slice(0, 16);
  const cacheKey = buildAiCacheKey(
    'patient_summary',
    `${input.patientId ?? 'anon'}:${input.locale}`,
    versionStamp,
  );

  const cached = await cache.get<PatientSummaryOutput>(cacheKey);
  if (cached) {
    await recordAiTelemetry(input.db ?? null, {
      feature: 'patient_summary',
      model: 'cache',
      provider: 'cache',
      cacheHit: true,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 380,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'doctor',
    });
    return { ...cached, provider: 'cache' };
  }

  const isAr = input.locale === 'ar';
  const router = new LlmRouter(env);

  const res = await router.generateStructured({
    tier: 'tier1',
    maxTokens: 220,
    systemPrompt: [
      'Clinical summarizer for doctors/ER. 5-second overview; never invent facts.',
      isAr ? 'Concise clinical Arabic.' : 'Concise clinical English.',
      'JSON: {headline,critical_alerts[],active_conditions[],active_medications[],allergies_summary,recent_visits_summary,clinical_takeaway}.',
    ].join('\n'),
    messages: [{ role: 'user', content: JSON.stringify(timelinePayload) }],
    schema: PatientSummarySchema,
    fallback: () => {
      const severeAllergies = input.allergies
        .filter((a) => a.severity === 'severe' || a.severity === 'anaphylaxis')
        .map((a) => a.name);
      const activeConds = input.conditions
        .filter((c) => c.status === 'active')
        .map((c) => (c.icd10 ? `${c.name} (${c.icd10})` : c.name));
      const activeMeds = input.medications
        .filter((m) => m.status === 'active')
        .map((m) => (m.dosage ? `${m.name} — ${m.dosage}` : m.name));

      if (isAr) {
        return {
          headline: `ملخص الحالة (${input.ageBand} · ${input.sex === 'male' ? 'ذكر' : 'أنثى'}${input.bloodType ? ` · فصيلة ${input.bloodType}` : ''})`,
          critical_alerts: severeAllergies.length
            ? [`حساسية شديدة: ${severeAllergies.join('، ')}`]
            : [],
          active_conditions: activeConds,
          active_medications: activeMeds,
          allergies_summary: input.allergies.length
            ? input.allergies.map((a) => `${a.name} (${a.severity})`).join('، ')
            : 'لا توجد حساسيات مسجلة',
          recent_visits_summary: sanitizedEncounters.length
            ? sanitizedEncounters.map((e) => `${e.date}: ${e.summary}`).join(' | ')
            : 'لا توجد زيارات حديثة مسجلة',
          clinical_takeaway:
            activeConds.length || activeMeds.length
              ? `يرجى مراجعة التفاعلات الدوائية مع ${activeMeds.length} دواء نشط و${activeConds.length} حالة مزمنة.`
              : 'الملف الطبي مستقر بدون أمراض مزمنة أو أدوية نشطة مسجلة.',
        };
      }

      return {
        headline: `Clinical Snapshot (${input.ageBand} · ${input.sex}${input.bloodType ? ` · Blood ${input.bloodType}` : ''})`,
        critical_alerts: severeAllergies.length
          ? [`Severe allergy: ${severeAllergies.join(', ')}`]
          : [],
        active_conditions: activeConds,
        active_medications: activeMeds,
        allergies_summary: input.allergies.length
          ? input.allergies.map((a) => `${a.name} (${a.severity})`).join(', ')
          : 'No known allergies recorded',
        recent_visits_summary: sanitizedEncounters.length
          ? sanitizedEncounters.map((e) => `${e.date}: ${e.summary}`).join(' | ')
          : 'No recent encounters recorded',
        clinical_takeaway:
          activeConds.length || activeMeds.length
            ? `Review ${activeMeds.length} active medication(s) and ${activeConds.length} active condition(s) before prescribing.`
            : 'No active chronic conditions or ongoing medications recorded.',
      };
    },
  });

  const out: PatientSummaryOutput = { ...res.data, provider: res.provider };
  await cache.set(cacheKey, out, { ttlSeconds: 7 * 86400, feature: 'patient_summary' });

  await recordAiTelemetry(input.db ?? null, {
    feature: 'patient_summary',
    model: res.model,
    provider: res.provider,
    cacheHit: false,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    savedTokensEstimate: res.provider === 'deterministic_fallback' ? 380 : 120,
    latencyMs: Math.max(1, Date.now() - t0),
    role: input.role ?? 'doctor',
  });

  return out;
}
