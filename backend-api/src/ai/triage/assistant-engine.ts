import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import type { InternalAssistantTriageResponse } from '../../integrations/ai-client.js';
import { buildAiCacheKey, getAiCache } from '../cache.js';
import { LlmRouter } from '../llm-router.js';
import { scrubPii } from '../pii.js';
import { compressHistory, compressRagChunks } from '../prompt-compressor.js';
import { getKnowledgeBase, normalizeText } from '../rag/retriever.js';
import { recordAiTelemetry } from '../telemetry.js';
import { evaluateRedFlags } from './red-flags.js';

const LlmTriageOutputSchema = z.object({
  triage_level: z.enum(['emergency', 'urgent', 'soon', 'routine', 'self_care']),
  reply_text: z.string().min(5),
  self_care: z.array(z.string()).max(3).default([]),
  warning_signs: z.array(z.string()).max(3).default([]),
  recommended_specialty_code: z.string().min(2),
  specialty_reason: z.string().min(3),
  follow_up_questions: z.array(z.string()).max(2).default([]),
});

const VALID_SPECIALTIES = new Set([
  'general_practice',
  'internal_medicine',
  'emergency_medicine',
  'cardiology',
  'pulmonology',
  'gastroenterology',
  'neurology',
  'dermatology',
  'ent',
  'ophthalmology',
  'orthopedics',
  'pediatrics',
  'obstetrics_gynecology',
  'urology',
  'nephrology',
  'endocrinology',
  'psychiatry',
  'dentistry',
  'rheumatology',
  'oncology',
  'pharmacy',
  'paramedicine',
]);

export interface AssistantRunInput {
  locale: 'ar' | 'en';
  message: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  patientContext: {
    age_band: string;
    sex: 'male' | 'female';
    pregnant?: boolean | null;
    allergies?: string[];
    conditions?: string[];
    activeMedications?: string[];
    knownNames?: string[];
  };
  db?: Firestore | null;
  role?: string;
}

export async function runAssistantTriage(
  env: Partial<
    Pick<
      AppEnv,
      | 'GEMINI_API_KEY'
      | 'GEMINI_API_KEYS'
      | 'GEMINI_MODEL'
      | 'GEMINI_TIER1_MODEL'
      | 'GEMINI_TIER2_MODEL'
      | 'GEMINI_EMBEDDING_MODEL'
      | 'GROQ_API_KEY'
      | 'GROQ_MODEL'
      | 'GROQ_TIER1_MODEL'
      | 'GROQ_TIER2_MODEL'
    >
  >,
  input: AssistantRunInput,
): Promise<InternalAssistantTriageResponse> {
  const t0 = Date.now();
  const scrubbedMsg = scrubPii(input.message, input.patientContext.knownNames);
  const redFlags = evaluateRedFlags(scrubbedMsg);

  // Pillar 1: Zero-Token Local-First Emergency Gatekeeper
  if (redFlags.highestLevel === 'emergency') {
    await recordAiTelemetry(input.db ?? null, {
      feature: 'chatbot_red_flag',
      model: 'local-red-flags',
      provider: 'local_zero_token',
      cacheHit: false,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 450,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'patient',
    });

    return {
      triage: {
        level: 'emergency',
        red_flag: true,
        rule_ids: redFlags.ruleIds,
        emergency_action: 'call_123',
      },
      reply: {
        text: input.locale === 'ar' ? redFlags.replyAr : redFlags.replyEn,
        self_care: [],
        warning_signs:
          input.locale === 'ar'
            ? ['اتصل بالإسعاف 123 فوراً', 'لا تقود السيارة بنفسك']
            : ['Call 123 immediately', 'Do not drive yourself to the hospital'],
      },
      recommended_specialty_code: redFlags.specialtyCode,
      specialty_reason:
        input.locale === 'ar'
          ? 'حالة طوارئ تستدعي تقييماً طبياً فورياً'
          : 'Emergency red-flag symptoms requiring immediate acute evaluation',
      follow_up_questions: [],
      llm_used: false,
      validator: { violations: [], regenerated: false, fallback_used: false },
    };
  }

  // Pillar 2: Semantic FAQ Cache for first-turn or standalone questions (7-day TTL)
  const cache = getAiCache(input.db ?? null);
  const canUseFaqCache = input.history.length === 0;
  const ctxKey = `${input.locale}:${input.patientContext.age_band}:${input.patientContext.sex}:${(input.patientContext.conditions ?? []).join(',')}`;
  const cacheKey = buildAiCacheKey('chatbot_faq', normalizeText(scrubbedMsg), ctxKey);
  if (canUseFaqCache) {
    const cached = await cache.get<InternalAssistantTriageResponse>(cacheKey);
    if (cached) {
      await recordAiTelemetry(input.db ?? null, {
        feature: 'chatbot_triage',
        model: 'cache',
        provider: 'cache',
        cacheHit: true,
        inputTokens: 0,
        outputTokens: 0,
        savedTokensEstimate: 480,
        latencyMs: Math.max(1, Date.now() - t0),
        role: input.role ?? 'patient',
      });
      return cached;
    }
  }

  // Pillar 4: Lean Hybrid RAG (local BM25 + precomputed embeddings -> 0 runtime embedding calls)
  const kb = getKnowledgeBase();
  const ragHits = await kb.retrieve(scrubbedMsg, { kind: 'triage', topK: 3 });
  const ragContext = compressRagChunks(
    ragHits.map((h) => ({ id: h.doc.id, title: h.doc.title, text: h.doc.text })),
    3,
    1200,
  );

  const topTriage = ragHits[0]?.doc.raw as
    | {
        specialty_code: string;
        specialty_name_ar: string;
        specialty_name_en: string;
        guidance_ar: string;
        guidance_en: string;
        red_flags_ar: string[];
        red_flags_en: string[];
      }
    | undefined;

  // Pillar 4: Sliding window (last 4 turns) + <=60-token rolling summary
  const { rollingSummary, recentTurns } = compressHistory(
    input.history,
    input.patientContext.knownNames,
  );

  const compactCtx = [
    `age:${input.patientContext.age_band}`,
    `sex:${input.patientContext.sex}`,
    input.patientContext.pregnant ? 'preg:1' : null,
    input.patientContext.allergies?.length
      ? `alg:${input.patientContext.allergies.slice(0, 4).join(',')}`
      : null,
    input.patientContext.conditions?.length
      ? `cond:${input.patientContext.conditions.slice(0, 4).join(',')}`
      : null,
    input.patientContext.activeMedications?.length
      ? `meds:${input.patientContext.activeMedications.slice(0, 4).join(',')}`
      : null,
  ]
    .filter(Boolean)
    .join('|');

  // Minified system prompt (<140 tokens)
  const systemPrompt = [
    'SmartHealth Egypt symptom triage AI. NOT a doctor; never diagnose or prescribe Rx drugs.',
    input.locale === 'ar' ? 'Reply in warm Egyptian Colloquial Arabic.' : 'Reply in concise English.',
    'Ask 1-2 short clarifying questions. Emergency -> triage_level="emergency" + call 123.',
    'JSON only: {triage_level,reply_text,self_care[],warning_signs[],recommended_specialty_code,specialty_reason,follow_up_questions[]}.',
    `RAG:\n${ragContext}`,
  ].join('\n');

  const userPayload = [
    rollingSummary,
    `<msg>${scrubbedMsg}</msg>`,
    `ctx:${compactCtx}`,
  ]
    .filter(Boolean)
    .join('\n');

  const router = new LlmRouter(env);
  const hasComplexContext =
    (input.patientContext.conditions?.length ?? 0) >= 2 ||
    (input.patientContext.activeMedications?.length ?? 0) >= 2;

  const llmRes = await router.generateStructured({
    tier: hasComplexContext ? 'tier2' : 'tier1',
    maxTokens: 300,
    systemPrompt,
    messages: [
      ...recentTurns.map((h) => ({ role: h.role, content: h.text })),
      { role: 'user', content: userPayload },
    ],
    schema: LlmTriageOutputSchema,
    fallback: () => {
      const spec = topTriage?.specialty_code ?? 'general_practice';
      const fallbackLevel: 'urgent' | 'soon' =
        redFlags.highestLevel === 'urgent' ? 'urgent' : 'soon';
      if (input.locale === 'ar') {
        return {
          triage_level: fallbackLevel,
          reply_text:
            topTriage?.guidance_ar ??
            'الأعراض دي تحتاج تقييم مبدئي من طبيب لمعرفة السبب بدقة. لو الأعراض مستمرة أو بتزيد يفضل تزور الطبيب في أقرب وقت.',
          self_care: ['اشرب سوائل دافية وارتاح كويس', 'تجنب المجهود الشديد النهاردة'],
          warning_signs: topTriage?.red_flags_ar.slice(0, 2) ?? [
            'صعوبة في التنفس أو ألم في الصدر',
            'حرارة عالية مستمرة',
          ],
          recommended_specialty_code: spec,
          specialty_reason: `توجيه مبدئي لتخصص ${topTriage?.specialty_name_ar ?? 'الطب العام'}`,
          follow_up_questions: ['الأعراض بدأت معاك من امتى بالظبط؟'],
        };
      }
      return {
        triage_level: fallbackLevel,
        reply_text:
          topTriage?.guidance_en ??
          'These symptoms warrant evaluation by a clinician if they persist or worsen.',
        self_care: ['Rest and stay well hydrated'],
        warning_signs: topTriage?.red_flags_en.slice(0, 2) ?? ['Difficulty breathing or chest pain'],
        recommended_specialty_code: spec,
        specialty_reason: `Initial evaluation in ${topTriage?.specialty_name_en ?? 'General Practice'}`,
        follow_up_questions: ['When did these symptoms start?'],
      };
    },
  });

  const out = llmRes.data;
  const finalLevel =
    redFlags.highestLevel === 'urgent' &&
    (out.triage_level === 'routine' || out.triage_level === 'self_care')
      ? 'urgent'
      : out.triage_level;

  const finalSpec = VALID_SPECIALTIES.has(out.recommended_specialty_code)
    ? out.recommended_specialty_code
    : (topTriage?.specialty_code ?? 'general_practice');

  const isLlm = llmRes.provider !== 'deterministic_fallback';

  const result: InternalAssistantTriageResponse = {
    triage: {
      level: finalLevel,
      red_flag: finalLevel === 'emergency',
      rule_ids: redFlags.ruleIds,
      emergency_action: finalLevel === 'emergency' ? 'call_123' : null,
    },
    reply: {
      text: out.reply_text,
      self_care: out.self_care ?? [],
      warning_signs: out.warning_signs ?? [],
    },
    recommended_specialty_code: finalSpec,
    specialty_reason: out.specialty_reason,
    follow_up_questions: out.follow_up_questions ?? [],
    llm_used: isLlm,
    validator: {
      violations: [],
      regenerated: false,
      fallback_used: !isLlm,
    },
  };

  if (canUseFaqCache && isLlm) {
    await cache.set(cacheKey, result, { ttlSeconds: 7 * 86400, feature: 'chatbot_faq' });
  }

  await recordAiTelemetry(input.db ?? null, {
    feature: 'chatbot_triage',
    model: llmRes.model,
    provider: llmRes.provider,
    cacheHit: false,
    inputTokens: llmRes.inputTokens,
    outputTokens: llmRes.outputTokens,
    savedTokensEstimate: isLlm ? 180 : 450,
    latencyMs: Math.max(1, Date.now() - t0),
    role: input.role ?? 'patient',
  });

  return result;
}
