import type { LocalizedText } from '@smarthealth/contracts';
import { sql } from 'kysely';
import type { Tx } from '../../db/with-user-tx.js';

export interface CriticalInfoDto {
  blood_type: {
    value: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
    source: 'patient_reported' | 'clinician_confirmed' | 'imported';
    confirmed_at: string | null;
  };
  allergies: Array<{
    id: string;
    allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
    allergen: { code: string; name: LocalizedText } | null;
    free_text: string | null;
    severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
    reaction: string | null;
    source: 'patient_reported' | 'clinician_confirmed' | 'imported';
    recorded_at: string;
  }>;
  chronic_conditions: Array<{
    id: string;
    icd10_code: string | null;
    name: LocalizedText;
    status: 'active' | 'resolved' | 'inactive';
    source: 'patient_reported' | 'clinician_confirmed' | 'imported';
  }>;
  current_medications: Array<{
    drug: { id: string; display: string };
    dose_text: string;
    since: string | null;
    until: string | null;
    source: 'prescription' | 'patient_reported';
  }>;
}

export async function loadCriticalInfo(tx: Tx, patientId: string): Promise<CriticalInfoDto> {
  const pat = await tx
    .selectFrom('app.patients')
    .select(['blood_type', 'blood_type_source', 'blood_type_confirmed_at'])
    .where('id', '=', patientId)
    .executeTakeFirst();

  const allergiesRes = await sql<{
    id: string;
    allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
    code: string | null;
    name_en: string | null;
    name_ar: string | null;
    free_text: string | null;
    severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
    reaction: string | null;
    source: 'patient_reported' | 'clinician_confirmed' | 'imported';
    created_at: string;
  }>`
    select
      a.id,
      a.allergen_type,
      coalesce(a.ingredient_code, a.drug_class_code) as code,
      coalesce(i.name_en, c.name_en) as name_en,
      coalesce(i.name_ar, c.name_ar) as name_ar,
      a.free_text,
      a.severity,
      a.reaction,
      a.source,
      a.created_at
    from app.allergies a
    left join ref.ingredients i on i.code = a.ingredient_code
    left join ref.drug_classes c on c.code = a.drug_class_code
    where a.patient_id = ${patientId}::uuid
      and a.is_active
      and a.verification <> 'refuted'
    order by array_position(array['anaphylaxis','severe','moderate','mild']::app.allergy_severity[], a.severity), a.created_at desc
  `.execute(tx);

  const condRes = await sql<{
    id: string;
    icd10_code: string | null;
    title_en: string | null;
    title_ar: string | null;
    free_text: string | null;
    status: 'active' | 'resolved' | 'inactive';
    source: 'patient_reported' | 'clinician_confirmed' | 'imported';
  }>`
    select
      co.id,
      co.icd10_code,
      ic.title_en,
      ic.title_ar,
      co.free_text,
      co.status,
      co.source
    from app.conditions co
    left join ref.icd10_codes ic on ic.code = co.icd10_code
    where co.patient_id = ${patientId}::uuid
      and co.is_chronic
      and co.status = 'active'
    order by co.created_at desc
  `.execute(tx);

  const medRes = await sql<{
    drug_id: string;
    display: string;
    dose_text: string | null;
    effective_from: string | null;
    effective_until: string | null;
    source: 'prescription' | 'patient_reported';
  }>`
    select
      ms.drug_id,
      (d.brand_name || ' ' || d.strength || ' ' || d.dosage_form) as display,
      ms.dose_text,
      ms.effective_from::text,
      ms.effective_until::text,
      ms.source
    from app.medication_statements ms
    join ref.drugs d on d.id = ms.drug_id
    where ms.patient_id = ${patientId}::uuid
      and ms.status = 'active'
      and (ms.effective_until is null or ms.effective_until >= current_date)
    order by ms.created_at desc
  `.execute(tx);

  return {
    blood_type: {
      value: pat?.blood_type ?? 'unknown',
      source: pat?.blood_type_source ?? 'patient_reported',
      confirmed_at: pat?.blood_type_confirmed_at
        ? new Date(pat.blood_type_confirmed_at).toISOString()
        : null,
    },
    allergies: allergiesRes.rows.map((row) => ({
      id: row.id,
      allergen_type: row.allergen_type,
      allergen:
        row.code && row.name_en
          ? { code: row.code, name: { en: row.name_en, ar: row.name_ar ?? row.name_en } }
          : null,
      free_text: row.free_text,
      severity: row.severity,
      reaction: row.reaction,
      source: row.source,
      recorded_at: new Date(row.created_at).toISOString(),
    })),
    chronic_conditions: condRes.rows.map((row) => {
      const en = row.title_en ?? row.free_text ?? '';
      return {
        id: row.id,
        icd10_code: row.icd10_code,
        name: { en, ar: row.title_ar ?? en },
        status: row.status,
        source: row.source,
      };
    }),
    current_medications: medRes.rows.map((row) => ({
      drug: { id: row.drug_id, display: row.display },
      dose_text: row.dose_text ?? '',
      since: row.effective_from,
      until: row.effective_until,
      source: row.source,
    })),
  };
}

export async function fetchAllergyDtoById(tx: Tx, allergyId: string) {
  const res = await sql<{
    id: string;
    allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
    code: string | null;
    name_en: string | null;
    name_ar: string | null;
    free_text: string | null;
    severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
    reaction: string | null;
    source: 'patient_reported' | 'clinician_confirmed' | 'imported';
    created_at: string;
  }>`
    select
      a.id,
      a.allergen_type,
      coalesce(a.ingredient_code, a.drug_class_code) as code,
      coalesce(i.name_en, c.name_en) as name_en,
      coalesce(i.name_ar, c.name_ar) as name_ar,
      a.free_text,
      a.severity,
      a.reaction,
      a.source,
      a.created_at
    from app.allergies a
    left join ref.ingredients i on i.code = a.ingredient_code
    left join ref.drug_classes c on c.code = a.drug_class_code
    where a.id = ${allergyId}::uuid
  `.execute(tx);

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    allergen_type: row.allergen_type,
    allergen:
      row.code && row.name_en
        ? { code: row.code, name: { en: row.name_en, ar: row.name_ar ?? row.name_en } }
        : null,
    free_text: row.free_text,
    severity: row.severity,
    reaction: row.reaction,
    source: row.source,
    recorded_at: new Date(row.created_at).toISOString(),
  };
}
