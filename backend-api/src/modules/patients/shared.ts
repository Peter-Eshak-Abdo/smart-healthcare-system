import type { LocalizedText } from '@smarthealth/contracts';
import type { Firestore } from 'firebase-admin/firestore';
import type { AppDeps } from '../../app-deps.js';
import {
  COLLECTIONS,
  type MedicalRecordDoc,
  type PatientDoc,
} from '../../firebase/firestore-types.js';
import { aad } from '../../security/crypto/field-cipher.js';

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

const SEVERITY_RANK: Record<string, number> = {
  anaphylaxis: 0,
  severe: 1,
  moderate: 2,
  mild: 3,
};

export async function loadCriticalInfo(
  db: Firestore,
  deps: Pick<AppDeps, 'fieldCipher'>,
  patientId: string,
): Promise<CriticalInfoDto> {
  const patSnap = await db.collection(COLLECTIONS.patients).doc(patientId).get();
  const pat = patSnap.exists ? (patSnap.data() as PatientDoc) : null;

  const recSnap = await db
    .collection(COLLECTIONS.medicalRecords)
    .where('patient_id', '==', patientId)
    .get();

  const records = recSnap.docs.map((d) => d.data() as MedicalRecordDoc);

  const allergies = records
    .filter((r) => r.kind === 'allergy' && r.status !== 'refuted' && r.status !== 'resolved')
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity ?? 'mild'] ?? 9) - (SEVERITY_RANK[b.severity ?? 'mild'] ?? 9),
    )
    .map((r) => {
      const freeText = r.allergen_free_text_enc
        ? deps.fieldCipher.decrypt(
            r.allergen_free_text_enc,
            aad('medical_records', 'allergen_free_text_enc', r.id),
          )
        : null;
      const reaction = r.reaction_enc
        ? deps.fieldCipher.decrypt(r.reaction_enc, aad('medical_records', 'reaction_enc', r.id))
        : null;
      const code = r.allergen_code ?? null;
      return {
        id: r.id,
        allergen_type: r.allergen_type ?? 'other',
        allergen: code ? { code, name: { en: code, ar: code } } : null,
        free_text: freeText,
        severity: r.severity ?? 'moderate',
        reaction,
        source: r.source,
        recorded_at: r.recorded_at,
      };
    });

  const chronic_conditions = records
    .filter((r) => r.kind === 'condition' && r.is_chronic && r.status === 'active')
    .map((r) => ({
      id: r.id,
      icd10_code: r.icd10_code ?? null,
      name: {
        en: r.condition_name_en ?? r.icd10_code ?? '',
        ar: r.condition_name_ar ?? r.condition_name_en ?? r.icd10_code ?? '',
      },
      status: (r.status === 'resolved' || r.status === 'inactive' ? r.status : 'active') as
        | 'active'
        | 'resolved'
        | 'inactive',
      source: r.source,
    }));

  const today = new Date().toISOString().slice(0, 10);
  const current_medications = records
    .filter(
      (r) =>
        r.kind === 'medication' &&
        r.status === 'active' &&
        (!r.until || r.until >= today) &&
        Boolean(r.drug_id),
    )
    .map((r) => ({
      drug: { id: r.drug_id!, display: r.drug_display ?? 'Medication' },
      dose_text: r.dose_text_enc
        ? deps.fieldCipher.decrypt(r.dose_text_enc, aad('medical_records', 'dose_text_enc', r.id))
        : '',
      since: r.since ?? null,
      until: r.until ?? null,
      source: (r.source === 'clinician_confirmed' ? 'prescription' : 'patient_reported') as
        | 'prescription'
        | 'patient_reported',
    }));

  return {
    blood_type: {
      value: pat?.blood_type ?? 'unknown',
      source: pat?.blood_type_source ?? 'patient_reported',
      confirmed_at: pat?.blood_type_confirmed_at ?? null,
    },
    allergies,
    chronic_conditions,
    current_medications,
  };
}
