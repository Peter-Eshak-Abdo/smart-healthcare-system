import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AppEnv } from '../../config/env.js';
import type {
  ClinicalCheckInput,
  InternalClinicalCheckResponse,
} from '../../integrations/ai-client.js';
import { buildAiCacheKey, getAiCache } from '../cache.js';
import { LlmRouter } from '../llm-router.js';
import { getKnowledgeBase, type DrugDatasetEntry } from '../rag/retriever.js';
import { recordAiTelemetry } from '../telemetry.js';

type AlertSeverity = 'minor' | 'moderate' | 'major' | 'contraindicated';
type ClinicalAlert = InternalClinicalCheckResponse['alerts'][number];

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  contraindicated: 4,
  major: 3,
  moderate: 2,
  minor: 1,
};

const LlmSafetyEnrichmentSchema = z.object({
  enrichments: z
    .array(
      z.object({
        alert_key: z.string(),
        management_ar: z.string(),
        management_en: z.string(),
      }),
    )
    .default([]),
});

function mergeAlert(bucket: Map<string, ClinicalAlert>, candidate: ClinicalAlert): void {
  const existing = bucket.get(candidate.alert_key);
  if (!existing) {
    bucket.set(candidate.alert_key, candidate);
    return;
  }
  const itemKeys = Array.from(new Set([...existing.item_keys, ...candidate.item_keys]));
  const relatedKeys = Array.from(new Set([...existing.related_keys, ...candidate.related_keys]));
  const chosen =
    SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[existing.severity] ? candidate : existing;
  bucket.set(candidate.alert_key, {
    ...chosen,
    item_keys: itemKeys,
    related_keys: relatedKeys,
    from_restricted_record: Boolean(
      existing.from_restricted_record || candidate.from_restricted_record,
    ),
  });
}

function resolveDrugFromKb(drugIdOrName: string): DrugDatasetEntry | undefined {
  return getKnowledgeBase().findDrugByQuery(drugIdOrName);
}

/**
 * Pillar 1.2: Zero-Token Local-First Clinical Safety Engine.
 * Runs deterministic DDI, Drug-Allergy, Cross-Reactivity, Duplicate Therapy, and Condition checks
 * with 0 LLM tokens. Only invokes Tier 1 LLM when `includeAiExplanation` is explicitly requested
 * AND not already cached globally.
 */
export async function runDynamicClinicalSafety(
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
  input: ClinicalCheckInput & {
    includeAiExplanation?: boolean;
    db?: Firestore | null;
    role?: string;
  },
): Promise<InternalClinicalCheckResponse> {
  const t0 = Date.now();
  const kb = getKnowledgeBase();
  const alerts = new Map<string, ClinicalAlert>();
  const unmapped: string[] = [];

  const proposedResolved = input.proposed.map((p) => {
    const drug = resolveDrugFromKb(p.drug_id);
    if (!drug) unmapped.push(p.drug_id);
    return { key: p.key, drug_id: p.drug_id, drug };
  });

  const currentResolved = input.current.map((c) => ({
    key: c.key,
    drug_id: c.drug_id,
    from_restricted_record: c.from_restricted_record,
    drug: resolveDrugFromKb(c.drug_id),
  }));

  const findDdi = (ingA: string, ingB: string) =>
    kb.ddiRules.filter(
      (r) =>
        (r.ingredient_a === ingA && r.ingredient_b === ingB) ||
        (r.ingredient_a === ingB && r.ingredient_b === ingA),
    );

  // 1. Drug-Drug & Duplicate Therapy
  for (let i = 0; i < proposedResolved.length; i += 1) {
    const p1 = proposedResolved[i]!;
    const ings1 = p1.drug?.active_ingredients ?? [];

    for (let j = i + 1; j < proposedResolved.length; j += 1) {
      const p2 = proposedResolved[j]!;
      const ings2 = p2.drug?.active_ingredients ?? [];
      for (const a of ings1) {
        for (const b of ings2) {
          if (a === b) continue;
          for (const rule of findDdi(a, b)) {
            const pair = [a, b].sort();
            mergeAlert(alerts, {
              alert_key: `DD:${pair[0]}:${pair[1]}`,
              type: 'drug_drug',
              severity: rule.severity,
              item_keys: [p1.key, p2.key],
              related_keys: [],
              rule_id: rule.rule_id,
              title: {
                en: `Drug Interaction (${p1.drug?.generic_name ?? a} + ${p2.drug?.generic_name ?? b})`,
                ar: `تداخل دوائي (${p1.drug?.generic_name_ar ?? a} + ${p2.drug?.generic_name_ar ?? b})`,
              },
              message: { en: rule.mechanism_en, ar: rule.mechanism_ar },
              management: {
                en: `${rule.management_en}${rule.alternatives_en.length ? ` Alternatives: ${rule.alternatives_en.join(', ')}.` : ''}`,
                ar: `${rule.management_ar}${rule.alternatives_ar.length ? ` البدائل المقترحة: ${rule.alternatives_ar.join('، ')}.` : ''}`,
              },
              source: 'rag:ddi-dataset',
              from_restricted_record: false,
            });
          }
        }
      }

      const cls1 = p1.drug?.drug_classes ?? [];
      const cls2 = p2.drug?.drug_classes ?? [];
      for (const c of cls1) {
        if (cls2.includes(c)) {
          mergeAlert(alerts, {
            alert_key: `DUP:${c}`,
            type: 'duplicate_therapy',
            severity: 'major',
            item_keys: [p1.key, p2.key],
            related_keys: [],
            rule_id: `DUP-${c}`,
            title: {
              en: `Duplicate Therapy (${c})`,
              ar: `تكرار دوائي من نفس المجموعة (${c})`,
            },
            message: {
              en: `Two prescribed items belong to the same therapeutic class (${c}).`,
              ar: `يوجد صنفان في الروشتة ينتميان لنفس المجموعة الدوائية (${c}).`,
            },
            management: {
              en: 'Keep only one agent from this class unless clinically justified.',
              ar: 'يفضل الاكتفاء بدواء واحد فقط من نفس المجموعة.',
            },
            source: 'rag:duplicate-class',
            from_restricted_record: false,
          });
        }
      }
    }

    for (const cur of currentResolved) {
      const ings2 = cur.drug?.active_ingredients ?? [];
      for (const a of ings1) {
        for (const b of ings2) {
          if (a === b) continue;
          for (const rule of findDdi(a, b)) {
            const pair = [a, b].sort();
            mergeAlert(alerts, {
              alert_key: `DD:${pair[0]}:${pair[1]}`,
              type: 'drug_drug',
              severity: rule.severity,
              item_keys: [p1.key],
              related_keys: [cur.key],
              rule_id: rule.rule_id,
              title: {
                en: `Interaction with Active Medication (${p1.drug?.generic_name ?? a} + ${cur.drug?.generic_name ?? b})`,
                ar: `تداخل مع دواء حالي (${p1.drug?.generic_name_ar ?? a} + ${cur.drug?.generic_name_ar ?? b})`,
              },
              message: { en: rule.mechanism_en, ar: rule.mechanism_ar },
              management: { en: rule.management_en, ar: rule.management_ar },
              source: 'rag:ddi-dataset',
              from_restricted_record: cur.from_restricted_record,
            });
          }
        }
      }
    }

    // 2. Drug-Allergy & Cross-Reactivity
    const classes = p1.drug?.drug_classes ?? [];
    for (const al of input.allergies) {
      if (al.allergen_type === 'ingredient' && al.allergen_code && ings1.includes(al.allergen_code)) {
        const sev: AlertSeverity =
          al.severity === 'severe' || al.severity === 'anaphylaxis' ? 'contraindicated' : 'major';
        mergeAlert(alerts, {
          alert_key: `DA:${al.allergen_code}`,
          type: 'drug_allergy',
          severity: sev,
          item_keys: [p1.key],
          related_keys: [],
          rule_id: 'ALG-DIRECT-001',
          title: {
            en: `Direct Allergy to ${al.allergen_code}`,
            ar: `حساسية مباشرة تجاه ${al.allergen_code}`,
          },
          message: {
            en: `Patient has a recorded ${al.severity} allergy to ${al.allergen_code}.`,
            ar: `المريض لديه حساسية مسجلة (${al.severity}) تجاه المادة الفعالة ${al.allergen_code}.`,
          },
          management: {
            en: 'Do not prescribe; choose an alternative from a non-cross-reactive class.',
            ar: 'ممنوع الصرف؛ اختر بديلاً من مجموعة دوائية آمنة.',
          },
          source: 'rag:allergy-rules',
          from_restricted_record: false,
        });
      } else if (al.allergen_type === 'drug_class' && al.allergen_code) {
        if (classes.includes(al.allergen_code)) {
          const sev: AlertSeverity =
            al.severity === 'severe' || al.severity === 'anaphylaxis' ? 'contraindicated' : 'major';
          mergeAlert(alerts, {
            alert_key: `DAC:${al.allergen_code}`,
            type: 'drug_allergy',
            severity: sev,
            item_keys: [p1.key],
            related_keys: [],
            rule_id: 'ALG-CLASS-DIRECT',
            title: {
              en: `Drug Class Allergy (${al.allergen_code})`,
              ar: `حساسية فئة دوائية (${al.allergen_code})`,
            },
            message: {
              en: `Prescribed drug belongs to ${al.allergen_code}, which the patient is allergic to.`,
              ar: `الدواء ينتمي لفئة ${al.allergen_code} المسجلة كحساسية لدى المريض.`,
            },
            management: {
              en: 'Avoid prescribing and select a safe alternative class.',
              ar: 'تجنب وصف هذا الدواء واختر بديلاً من فئة أخرى.',
            },
            source: 'rag:allergy-rules',
            from_restricted_record: false,
          });
        }
        for (const targetCls of classes) {
          const cross = kb.crossRules.find(
            (r) => r.allergen_class === al.allergen_code && r.target_class === targetCls,
          );
          if (cross) {
            const sev =
              al.severity === 'severe' || al.severity === 'anaphylaxis'
                ? cross.severity_if_severe
                : cross.severity_if_mild;
            mergeAlert(alerts, {
              alert_key: `DAC:${targetCls}:${al.allergen_code}`,
              type: 'drug_allergy',
              severity: sev,
              item_keys: [p1.key],
              related_keys: [],
              rule_id: cross.rule_id,
              title: {
                en: `Class Cross-Reactivity (${al.allergen_code} -> ${targetCls})`,
                ar: `حساسية متقاطعة محتملة (${al.allergen_code} -> ${targetCls})`,
              },
              message: { en: cross.note_en, ar: cross.note_ar },
              management: {
                en: 'Verify allergy history or switch to an unrelated antibiotic/drug class.',
                ar: 'راجع تاريخ الحساسية بدقة أو استبدل الدواء بفئة غير متقاطعة.',
              },
              source: 'rag:cross-reactivity',
              from_restricted_record: false,
            });
          }
        }
      }
    }

    // 3. Chronic-Disease Contraindications
    for (const cond of input.conditions) {
      for (const contra of p1.drug?.contraindications ?? []) {
        if (cond.icd10_code.toUpperCase().startsWith(contra.icd10_prefix.toUpperCase())) {
          mergeAlert(alerts, {
            alert_key: `DC:${p1.drug?.code ?? p1.drug_id}:${contra.icd10_prefix}`,
            type: 'drug_condition',
            severity: contra.severity,
            item_keys: [p1.key],
            related_keys: [],
            rule_id: `DC-${contra.icd10_prefix}`,
            title: {
              en: `Condition Precaution (${cond.icd10_code})`,
              ar: `تحذير مع الحالة الصحية (${cond.icd10_code})`,
            },
            message: { en: contra.note_en, ar: contra.note_ar },
            management: {
              en: 'Review benefit/risk or select a safer alternative for this condition.',
              ar: 'راجع الملاءمة الطبية أو اختر بديلاً أكثر أماناً مع هذه الحالة.',
            },
            source: 'rag:condition-rules',
            from_restricted_record: false,
          });
        }
      }
    }
  }

  const alertList = Array.from(alerts.values());

  // Only invoke Tier 1 LLM when explicitly requested by doctor OR when unknown drugs exist & live provider is set
  const shouldUseLlm = Boolean(input.includeAiExplanation && alertList.length > 0);
  if (shouldUseLlm) {
    const cache = getAiCache(input.db ?? null);
    const drugKey = [...input.proposed.map((p) => p.drug_id), ...input.current.map((c) => c.drug_id)]
      .sort()
      .join(',');
    const algKey = input.allergies
      .map((a) => `${a.allergen_type}:${a.allergen_code ?? ''}`)
      .sort()
      .join(',');
    const cacheKey = buildAiCacheKey('clinical_safety_explain', drugKey, algKey);
    const cachedEnrich = await cache.get<Array<{ alert_key: string; management_ar: string; management_en: string }>>(cacheKey);

    if (cachedEnrich) {
      const map = new Map(cachedEnrich.map((e) => [e.alert_key, e]));
      for (const alert of alertList) {
        const enr = map.get(alert.alert_key);
        if (enr) alert.management = { en: enr.management_en, ar: enr.management_ar };
      }
      await recordAiTelemetry(input.db ?? null, {
        feature: 'clinical_safety_explain',
        model: 'cache',
        provider: 'cache',
        cacheHit: true,
        inputTokens: 0,
        outputTokens: 0,
        savedTokensEstimate: 300,
        latencyMs: Math.max(1, Date.now() - t0),
        role: input.role ?? 'doctor',
      });
    } else {
      const router = new LlmRouter(env);
      const enrichmentRes = await router.generateStructured({
        tier: 'tier1',
        maxTokens: 250,
        systemPrompt:
          'Clinical pharmacist AI. Give concise AR+EN management & safer alternatives. JSON: {enrichments:[{alert_key,management_ar,management_en}]}.',
        messages: [
          {
            role: 'user',
            content: JSON.stringify(
              alertList.slice(0, 5).map((a) => ({
                k: a.alert_key,
                s: a.severity,
                t: a.title.en,
              })),
            ),
          },
        ],
        schema: LlmSafetyEnrichmentSchema,
        fallback: () => ({ enrichments: [] }),
        timeoutMs: 4_500,
      });

      const list = enrichmentRes.data.enrichments ?? [];
      if (list.length > 0) {
        await cache.set(cacheKey, list, { ttlSeconds: null, feature: 'clinical_safety_explain' });
        const map = new Map(list.map((e) => [e.alert_key, e]));
        for (const alert of alertList) {
          const enr = map.get(alert.alert_key);
          if (enr?.management_ar && enr?.management_en) {
            alert.management = { en: enr.management_en, ar: enr.management_ar };
          }
        }
      }

      await recordAiTelemetry(input.db ?? null, {
        feature: 'clinical_safety_explain',
        model: enrichmentRes.model,
        provider: enrichmentRes.provider,
        cacheHit: false,
        inputTokens: enrichmentRes.inputTokens,
        outputTokens: enrichmentRes.outputTokens,
        savedTokensEstimate: 0,
        latencyMs: Math.max(1, Date.now() - t0),
        role: input.role ?? 'doctor',
      });
    }
  } else {
    // 0-token local execution logged
    await recordAiTelemetry(input.db ?? null, {
      feature: 'clinical_safety_local',
      model: 'local-ddi-rag',
      provider: 'local_zero_token',
      cacheHit: false,
      inputTokens: 0,
      outputTokens: 0,
      savedTokensEstimate: 320,
      latencyMs: Math.max(1, Date.now() - t0),
      role: input.role ?? 'doctor',
    });
  }

  alertList.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return {
    checks_status: unmapped.length === 0 ? 'complete' : 'partial',
    engine_version: 'rag-clinical-v2-zero-token',
    dataset_version: 'smarthealth-rag-v1',
    unmapped_drug_ids: unmapped,
    alerts: alertList,
  };
}
