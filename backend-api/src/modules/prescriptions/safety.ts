import type { Firestore } from 'firebase-admin/firestore';
import type { AppDeps } from '../../app-deps.js';
import {
  COLLECTIONS,
  type DrugReferenceDoc,
  type MedicalRecordDoc,
} from '../../firebase/firestore-types.js';

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
  db: Firestore,
  deps: Pick<AppDeps, 'aiClient'>,
  input: {
    patientId: string;
    doctorId: string;
    items: Array<{ client_key: string; drug_id: string }>;
    locale: 'ar' | 'en';
  },
): Promise<SafetyCheckResult> {
  const recSnap = await db
    .collection(COLLECTIONS.medicalRecords)
    .where('patient_id', '==', input.patientId)
    .get();
  const records = recSnap.docs.map((d) => d.data() as MedicalRecordDoc);

  const today = new Date().toISOString().slice(0, 10);
  const currentMeds = records
    .filter(
      (r) =>
        r.kind === 'medication' &&
        r.status === 'active' &&
        (!r.until || r.until >= today) &&
        Boolean(r.drug_id),
    )
    .map((r) => ({
      key: r.id,
      drug_id: r.drug_id!,
      from_restricted_record: r.visibility === 'restricted',
    }));

  const currentByKey = new Map(currentMeds.map((m) => [m.key, m]));
  const drugDisplayMap = new Map<string, string>();
  for (const med of currentMeds) {
    if (!drugDisplayMap.has(med.drug_id)) {
      const dSnap = await db.collection(COLLECTIONS.drugReference).doc(med.drug_id).get();
      if (dSnap.exists) {
        const d = dSnap.data() as DrugReferenceDoc;
        drugDisplayMap.set(med.drug_id, `${d.generic_name} ${d.strength}`.trim());
      }
    }
  }

  const allergies = records
    .filter((r) => r.kind === 'allergy' && r.status !== 'refuted')
    .map((r) => ({
      allergen_type: r.allergen_type ?? ('other' as const),
      allergen_code: r.allergen_code ?? null,
      free_text_present: Boolean(r.allergen_free_text_enc),
      severity: r.severity ?? ('moderate' as const),
    }));

  const conditions = records
    .filter((r) => r.kind === 'condition' && r.status === 'active' && Boolean(r.icd10_code))
    .map((r) => ({ icd10_code: r.icd10_code! }));

  try {
    const aiResult = await deps.aiClient.checkClinicalInteractions({
      proposed: input.items.map((it) => ({ key: it.client_key, drug_id: it.drug_id })),
      current: currentMeds,
      allergies,
      conditions,
      locale: input.locale,
    });

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
                  from_restricted_record: Boolean(
                    relMed.from_restricted_record || a.from_restricted_record,
                  ),
                },
              }
            : {}),
          previously_reviewed: null,
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
