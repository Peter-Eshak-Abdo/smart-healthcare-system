import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import { buildAiCacheKey, getAiCache } from '../cache.js';
import { LlmRouter } from '../llm-router.js';
import { getKnowledgeBase } from '../rag/retriever.js';
import { recordAiTelemetry } from '../telemetry.js';

export const PrescriptionExplanationSchema = z.object({
  overall_summary: z.string(),
  items: z.array(
    z.object({
      drug_name: z.string(),
      purpose: z.string(),
      timing_and_food: z.string(),
      simple_schedule: z.string(),
      warnings: z.array(z.string()),
    }),
  ),
  general_tips: z.array(z.string()),
});

export type PrescriptionExplanationOutput = z.infer<typeof PrescriptionExplanationSchema> & {
  provider: 'gemini' | 'groq' | 'deterministic_fallback' | 'cache';
};

export interface ExplainPrescriptionInput {
  prescriptionId?: string;
  locale: 'ar' | 'en';
  items: Array<{
    drug_id: string;
    drug_name: string;
    dose?: string;
    frequency?: string;
    duration_days?: number;
    instructions?: string | null;
  }>;
  db?: Firestore | null;
  role?: string;
}

export async function explainPrescription(
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
  input: ExplainPrescriptionInput,
): Promise<PrescriptionExplanationOutput> {
  const t0 = Date.now();
  const cache = getAiCache(input.db ?? null);
  const itemsHash = createHash('sha256')
    .update(JSON.stringify(input.items.map((i) => `${i.drug_id}:${i.dose ?? ''}:${i.frequency ?? ''}`)))
    .digest('hex')
    .slice(0, 16);
  const cacheKey = buildAiCacheKey(
    'rx_explain',
    `${input.prescriptionId ?? itemsHash}:${input.locale}`,
    itemsHash,
  );

  // Permanent cache per prescriptionId + locale
  const cached = await cache.get<PrescriptionExplanationOutput>(cacheKey);
  if (cached) {
    await recordAiTelemetry(input.db ?? null, {
      feature: 'rx_explain',
      model: 'cache',
      provider: 'cache',
      cacheHit: true,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 420,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'patient',
    });
    return { ...cached, provider: 'cache' };
  }

  const kb = getKnowledgeBase();
  const isAr = input.locale === 'ar';

  const enrichedItems = input.items.map((item) => {
    const kbDrug = kb.findDrugByQuery(item.drug_id) ?? kb.findDrugByQuery(item.drug_name);
    return { ...item, kbDrug };
  });

  const ragFacts = enrichedItems
    .filter((x) => Boolean(x.kbDrug))
    .map((x) => {
      const d = x.kbDrug!;
      return `${x.drug_name}: ${isAr ? d.timing_instructions_ar : d.timing_instructions_en} | ${isAr ? d.warnings_ar : d.warnings_en}`;
    })
    .join('\n')
    .slice(0, 1100);

  const router = new LlmRouter(env);
  const res = await router.generateStructured({
    tier: 'tier1',
    maxTokens: 300,
    systemPrompt: [
      'Egyptian clinical pharmacist AI explaining a verified Rx to a patient.',
      isAr ? 'Warm crystal-clear Egyptian Colloquial Arabic.' : 'Warm plain English.',
      'Ground timing/warnings strictly in provided RAG facts. Never alter doses.',
      'JSON: {overall_summary,items:[{drug_name,purpose,timing_and_food,simple_schedule,warnings[]}],general_tips[]}.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          items: enrichedItems.map((x) => ({
            n: x.drug_name,
            d: x.dose ?? '',
            f: x.frequency ?? '',
            days: x.duration_days ?? null,
            note: x.instructions ?? '',
          })),
          rag: ragFacts,
        }),
      },
    ],
    schema: PrescriptionExplanationSchema,
    fallback: () => {
      if (isAr) {
        return {
          overall_summary: `دي طريقة استخدام الـ ${enrichedItems.length} أدوية المكتوبة في روشتتك بشكل مبسط وآمن:`,
          items: enrichedItems.map((x) => ({
            drug_name: x.drug_name,
            purpose: x.kbDrug
              ? `مادة فعالة: ${x.kbDrug.generic_name_ar}`
              : 'علاج موصوف من الطبيب المختص',
            timing_and_food:
              x.kbDrug?.timing_instructions_ar ??
              x.instructions ??
              'اتبع تعليمات الطبيب أو الصيدلي بخصوص الأكل.',
            simple_schedule:
              [x.dose, x.frequency, x.duration_days ? `لمدة ${x.duration_days} يوم` : null]
                .filter(Boolean)
                .join(' · ') || 'حسب الجرعة المحددة في الروشتة',
            warnings: x.kbDrug
              ? [x.kbDrug.warnings_ar, ...x.kbDrug.side_effects_ar.slice(0, 2)]
              : ['التزم بالجرعة المحددة ولا توقف الدواء فجأة بدون استشارة الطبيب.'],
          })),
          general_tips: [
            'اشرب مية كفاية مع كل جرعة.',
            'لو نسيت جرعة خدها أول ما تفتكر إلا لو قرب ميعاد الجرعة الجاية.',
          ],
        };
      }

      return {
        overall_summary: `Here is a simple guide to taking the ${enrichedItems.length} medication(s) in your prescription:`,
        items: enrichedItems.map((x) => ({
          drug_name: x.drug_name,
          purpose: x.kbDrug ? `Active ingredient: ${x.kbDrug.generic_name}` : 'Prescribed by your clinician',
          timing_and_food:
            x.kbDrug?.timing_instructions_en ?? x.instructions ?? 'Follow your doctor/pharmacist instructions.',
          simple_schedule:
            [x.dose, x.frequency, x.duration_days ? `for ${x.duration_days} days` : null]
              .filter(Boolean)
              .join(' · ') || 'As directed on prescription',
          warnings: x.kbDrug
            ? [x.kbDrug.warnings_en, ...x.kbDrug.side_effects_en.slice(0, 2)]
            : ['Take exactly as prescribed and consult your doctor before stopping.'],
        })),
        general_tips: [
          'Take tablets with a full glass of water.',
          'Contact your doctor or pharmacist if you notice any unusual rash or swelling.',
        ],
      };
    },
  });

  const out: PrescriptionExplanationOutput = { ...res.data, provider: res.provider };
  await cache.set(cacheKey, out, { ttlSeconds: null, feature: 'rx_explain' });

  await recordAiTelemetry(input.db ?? null, {
    feature: 'rx_explain',
    model: res.model,
    provider: res.provider,
    cacheHit: false,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    savedTokensEstimate: res.provider === 'deterministic_fallback' ? 420 : 120,
    latencyMs: Math.max(1, Date.now() - t0),
    role: input.role ?? 'patient',
  });

  return out;
}
