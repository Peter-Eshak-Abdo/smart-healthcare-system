import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import { LlmRouter } from '../llm-router.js';
import { getKnowledgeBase } from '../rag/retriever.js';

export const SmartSearchResultSchema = z.object({
  intent: z.enum(['medication', 'symptom_triage', 'specialty', 'general']),
  recommended_specialty_code: z.string().nullable(),
  matches: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['drug', 'triage']),
      title: z.string(),
      subtitle: z.string(),
      specialty_code: z.string().nullable().optional(),
    }),
  ),
});

export type SmartSearchOutput = z.infer<typeof SmartSearchResultSchema>;

export async function runSmartSearch(
  env: Pick<AppEnv, 'GEMINI_API_KEY' | 'GEMINI_MODEL' | 'GEMINI_EMBEDDING_MODEL' | 'GROQ_API_KEY' | 'GROQ_MODEL'>,
  input: { query: string; locale: 'ar' | 'en' },
): Promise<SmartSearchOutput> {
  const kb = getKnowledgeBase();
  const hits = await kb.retrieve(input.query, {
    kind: 'all',
    topK: 6,
    geminiApiKey: env.GEMINI_API_KEY,
    embeddingModel: env.GEMINI_EMBEDDING_MODEL,
  });

  const drugOrTriage = hits.filter((h) => h.doc.kind === 'drug' || h.doc.kind === 'triage');
  const topTriage = drugOrTriage.find((h) => h.doc.kind === 'triage');
  const topDrug = drugOrTriage.find((h) => h.doc.kind === 'drug');

  const deterministicMatches = drugOrTriage.slice(0, 5).map((h) => {
    if (h.doc.kind === 'drug') {
      const d = h.doc.raw as {
        id: string;
        generic_name: string;
        generic_name_ar: string;
        brand_names_ar: string[];
        brand_names_en: string[];
      };
      return {
        id: d.id,
        kind: 'drug' as const,
        title: input.locale === 'ar' ? `${d.brand_names_ar[0] ?? d.generic_name_ar}` : `${d.brand_names_en[0] ?? d.generic_name}`,
        subtitle: input.locale === 'ar' ? d.generic_name_ar : d.generic_name,
        specialty_code: null,
      };
    }
    const t = h.doc.raw as {
      id: string;
      specialty_code: string;
      specialty_name_ar: string;
      specialty_name_en: string;
      guidance_ar: string;
      guidance_en: string;
    };
    return {
      id: t.id,
      kind: 'triage' as const,
      title: input.locale === 'ar' ? t.specialty_name_ar : t.specialty_name_en,
      subtitle: input.locale === 'ar' ? t.guidance_ar : t.guidance_en,
      specialty_code: t.specialty_code,
    };
  });

  const router = new LlmRouter(env);
  if (!router.hasLiveProvider() || deterministicMatches.length > 0) {
    const inferredSpecialty =
      topTriage && (topTriage.doc.raw as { specialty_code?: string }).specialty_code
        ? (topTriage.doc.raw as { specialty_code: string }).specialty_code
        : null;
    const intent: SmartSearchOutput['intent'] =
      topDrug && (!topTriage || topDrug.score >= topTriage.score)
        ? 'medication'
        : topTriage
          ? 'symptom_triage'
          : 'general';
    return {
      intent,
      recommended_specialty_code: inferredSpecialty,
      matches: deterministicMatches,
    };
  }

  const res = await router.generateStructured({
    systemPrompt:
      'You are a medical search intent router. Map the user query (Egyptian Arabic or English, including typos) to the best matching specialty code and intent. Output JSON: { intent, recommended_specialty_code, matches: [] }.',
    messages: [{ role: 'user', content: input.query }],
    schema: SmartSearchResultSchema,
    fallback: () => ({
      intent: 'general' as const,
      recommended_specialty_code: 'general_practice',
      matches: [],
    }),
    timeoutMs: 3_500,
  });

  return res.data;
}
