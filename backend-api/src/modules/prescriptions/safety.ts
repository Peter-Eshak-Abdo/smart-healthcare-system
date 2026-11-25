import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import type { Tx } from '../../db/with-user-tx.js';

export interface SafetyAlertOutput {
  alert_key: string;
  type: 'drug_drug' | 'drug_allergy' | 'duplicate_therapy' | 'drug_condition';
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  item_keys: string[];
  title: { en: string; ar: string };
  message: { en: string; ar: string };
  management: { en: string; ar: string };
  source: string;
  requires_override: boolean;
  involves_current_medication?: { display: string; from_restricted_record: boolean };
  previously_reviewed: { by: string; at: string } | null;
  rule_id: string;
  engine_version: string;
  dataset_version: string;
}

export interface SafetyCheckResult {
  checks_status: 'complete' | 'partial' | 'unavailable';
  engine_version: string;
  dataset_version: string;
  alerts: SafetyAlertOutput[];
}

export async function runClinicalSafetyCheck(
  tx: Tx,
  deps: Pick<AppDeps, 'aiClient'>,
  input: {
    patientId: string;
    doctorId: string;
    items: Array<{ client_key: string; drug_id: string }>;
    locale: 'ar' | 'en';
  },
): Promise<SafetyCheckResult> {
  const ctxRes = await sql<{ payload: unknown }>`
    select private.patient_safety_context(${input.patientId}::uuid) as payload
  `.execute(tx);

  const rawCtx = (ctxRes.rows[0]?.payload ?? {}) as {
    current?: Array<{ key: string; drug_id: string; from_restricted_record?: boolean }>;
    allergies?: Array<{
      allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
      allergen_code?: string | null;
      free_text_present?: boolean;
      severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
    }>;
    conditions?: Array<{ icd10_code: string }>;
  };

  const currentMeds = rawCtx.current ?? [];
  const currentByKey = new Map(currentMeds.map((m) => [m.key, m]));
  const drugDisplayMap = new Map<string, string>();
  if (currentMeds.length > 0) {
    const curDrugIds = currentMeds.map((m) => m.drug_id);
    const drugRows = await sql<{ id: string; display: string }>`
      select id, (generic_name || ' ' || strength) as display
        from ref.drugs
       where id = any(${curDrugIds}::uuid[])
    `.execute(tx);
    for (const d of drugRows.rows) {
      drugDisplayMap.set(d.id, d.display);
    }
  }

  try {
    const aiResult = await deps.aiClient.checkClinicalInteractions({
      proposed: input.items.map((it) => ({ key: it.client_key, drug_id: it.drug_id })),
      current: currentMeds.map((m) => ({
        key: m.key,
        drug_id: m.drug_id,
        from_restricted_record: Boolean(m.from_restricted_record),
      })),
      allergies: rawCtx.allergies ?? [],
      conditions: rawCtx.conditions ?? [],
      locale: input.locale,
    });

    const alertKeys = aiResult.alerts.map((a) => a.alert_key);
    const reviewedMap = new Map<string, { by: string; at: string }>();
    if (alertKeys.length > 0) {
      const revRows = await sql<{ alert_key: string; doctor_name: string; overridden_at: string }>`
        select distinct on (ca.alert_key)
          ca.alert_key,
          p.full_name as doctor_name,
          ca.overridden_at::text
        from app.clinical_alerts ca
        join app.profiles p on p.id = ca.doctor_id
        where ca.patient_id = ${input.patientId}::uuid
          and ca.overridden
          and ca.alert_key = any(${alertKeys}::text[])
        order by ca.alert_key, ca.overridden_at desc
      `.execute(tx);

      for (const r of revRows.rows) {
        reviewedMap.set(r.alert_key, {
          by: r.doctor_name,
          at: new Date(r.overridden_at).toISOString(),
        });
      }
    }

    return {
      checks_status: aiResult.checks_status,
      engine_version: aiResult.engine_version,
      dataset_version: aiResult.dataset_version,
      alerts: aiResult.alerts.map((a) => {
        const relKey = a.related_keys[0];
        const relMed = relKey ? currentByKey.get(relKey) : undefined;
        return {
          alert_key: a.alert_key,
          type: a.type,
          severity: a.severity,
          item_keys: a.item_keys,
          title: a.title,
          message: a.message,
          management: a.management,
          source: a.source,
          requires_override: a.severity === 'major' || a.severity === 'contraindicated',
          ...(relMed
            ? {
                involves_current_medication: {
                  display: drugDisplayMap.get(relMed.drug_id) ?? 'Current medication',
                  from_restricted_record: Boolean(relMed.from_restricted_record || a.from_restricted_record),
                },
              }
            : {}),
          previously_reviewed: reviewedMap.get(a.alert_key) ?? null,
          rule_id: a.rule_id,
          engine_version: aiResult.engine_version,
          dataset_version: aiResult.dataset_version,
        };
      }),
    };
  } catch {
    return {
      checks_status: 'unavailable',
      engine_version: 'unavailable',
      dataset_version: 'unavailable',
      alerts: [],
    };
  }
}
