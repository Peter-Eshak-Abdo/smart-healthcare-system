/* eslint-disable no-console */
import { randomUUID } from 'node:crypto';
import { summarizePatientHistory } from '../src/ai/clinical/summarizer.js';
import { explainPrescription } from '../src/ai/clinical/prescription-explainer.js';
import { loadEnv } from '../src/config/env.js';
import { createFirebaseBundle } from '../src/firebase/firebase-admin.js';
import {
  COLLECTIONS,
  type DrugInteractionDoc,
  type DrugReferenceDoc,
  type FacilityDoc,
  type MedicalRecordDoc,
  type PatientDoc,
  type PractitionerDoc,
  type UserDoc,
} from '../src/firebase/firestore-types.js';
import { writeAuditLog } from '../src/security/audit.js';
import { aad, createFieldCipher } from '../src/security/crypto/field-cipher.js';
import { createKeyring } from '../src/security/crypto/keyring.js';

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'SmartHealth@2026!';

async function ensureAuthUser(
  auth: NonNullable<ReturnType<typeof createFirebaseBundle>['auth']>,
  input: {
    email: string;
    fullName: string;
    role: UserDoc['role'];
    licenseStatus?: string;
    facilityId?: string | null;
  },
): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(input.email);
    uid = existing.uid;
  } catch {
    const created = await auth.createUser({
      email: input.email,
      password: DEMO_PASSWORD,
      displayName: input.fullName,
      emailVerified: true,
    });
    uid = created.uid;
  }
  await auth.setCustomUserClaims(uid, {
    role: input.role,
    status: 'active',
    ...(input.licenseStatus ? { licenseStatus: input.licenseStatus } : {}),
    ...(input.facilityId ? { facilityId: input.facilityId } : {}),
    session_epoch: 0,
  });
  return uid;
}

async function seed() {
  const env = loadEnv();
  const fb = createFirebaseBundle(env);
  if (!fb.db || !fb.auth) {
    throw new Error('Firebase credentials required to run seed:firebase.');
  }
  const db = fb.db;
  const auth = fb.auth;
  const cipher = createFieldCipher(createKeyring(env));
  const nowIso = new Date().toISOString();

  // 1. Facilities
  const clinicId = 'fac-cairo-clinic-01';
  const pharmId = 'fac-cairo-pharm-01';
  const erId = 'fac-kasr-er-01';

  const facilities: FacilityDoc[] = [
    {
      id: clinicId,
      name: 'عيادة المعادي التخصصية',
      type: 'clinic',
      address: '14 Street 9, Maadi, Cairo',
      phone: '+20223581234',
      license_number: 'EG-FAC-CL-001',
      is_active: true,
      created_at: nowIso,
    },
    {
      id: pharmId,
      name: 'صيدلية الأمل المركزي',
      type: 'pharmacy',
      address: '22 Tahrir Square, Cairo',
      phone: '+20225794321',
      license_number: 'EG-FAC-PH-002',
      is_active: true,
      created_at: nowIso,
    },
    {
      id: erId,
      name: 'وحدة طوارئ القصر العيني',
      type: 'ambulance_service',
      address: 'Al Kasr Al Aini St, Cairo',
      phone: '+20223654100',
      license_number: 'EG-FAC-ER-003',
      is_active: true,
      created_at: nowIso,
    },
  ];
  for (const f of facilities) {
    await db.collection(COLLECTIONS.facilities).doc(f.id).set(f, { merge: true });
  }

  // 2. Reference Specialties, ICD-10, Allergens, Drugs & Interactions
  const specialties = [
    { code: 'general_practice', name_en: 'General Practice', name_ar: 'طب عام' },
    { code: 'internal_medicine', name_en: 'Internal Medicine', name_ar: 'باطنة' },
    { code: 'cardiology', name_en: 'Cardiology', name_ar: 'قلب وأوعية دموية' },
    { code: 'emergency_medicine', name_en: 'Emergency Medicine', name_ar: 'طب الطوارئ' },
  ];
  for (const sp of specialties) {
    await db.collection(COLLECTIONS.specialtiesReference).doc(sp.code).set(sp, { merge: true });
  }

  const icd10 = [
    { code: 'E11.9', title_en: 'Type 2 diabetes mellitus without complications', title_ar: 'مرض السكري من النوع الثاني', is_chronic_default: true },
    { code: 'I10', title_en: 'Essential (primary) hypertension', title_ar: 'ارتفاع ضغط الدم الأولي', is_chronic_default: true },
    { code: 'J06.9', title_en: 'Acute upper respiratory infection', title_ar: 'التهاب حاد في الجهاز التنفسي العلوي', is_chronic_default: false },
  ];
  for (const code of icd10) {
    await db.collection(COLLECTIONS.icd10Reference).doc(code.code).set(code, { merge: true });
  }

  const drugs: DrugReferenceDoc[] = [
    {
      id: 'drug-amoxil-500',
      brand_name: 'Amoxil 500mg',
      generic_name: 'Amoxicillin',
      active_ingredient: 'Amoxicillin',
      strength: '500mg',
      dosage_form: 'capsule',
      base_unit: 'capsule',
      atc_code: 'J01CA04',
      is_controlled: false,
      is_active: true,
    },
    {
      id: 'drug-warfarin-5',
      brand_name: 'Marevan 5mg',
      generic_name: 'Warfarin',
      active_ingredient: 'Warfarin',
      strength: '5mg',
      dosage_form: 'tablet',
      base_unit: 'tablet',
      atc_code: 'B01AA03',
      is_controlled: false,
      is_active: true,
    },
    {
      id: 'drug-aspirin-81',
      brand_name: 'Aspocid 75mg',
      generic_name: 'Aspirin',
      active_ingredient: 'Aspirin',
      strength: '75mg',
      dosage_form: 'tablet',
      base_unit: 'tablet',
      atc_code: 'B01AC06',
      is_controlled: false,
      is_active: true,
    },
  ];
  for (const d of drugs) {
    await db.collection(COLLECTIONS.drugReference).doc(d.id).set(d, { merge: true });
  }

  const ddi: DrugInteractionDoc = {
    id: 'ddi-warfarin-aspirin',
    ingredient_a: 'Warfarin',
    ingredient_b: 'Aspirin',
    severity: 'major',
    summary_en: 'Increased bleeding risk when co-administering Warfarin and Aspirin.',
    summary_ar: 'زيادة خطورة النزيف عند جمع الوارفارين مع الأسبرين.',
    management_en: 'Monitor INR closely or use an alternative.',
    management_ar: 'راقب سيولة الدم INR عن قرب أو اختر بديلاً.',
    source: 'ddinter',
  };
  await db.collection(COLLECTIONS.drugInteractions).doc(ddi.id).set(ddi, { merge: true });

  // 3. Seed 5 roles
  const usersToSeed: Array<{
    email: string;
    fullName: string;
    role: UserDoc['role'];
    licenseNumber?: string;
    facilityId?: string;
    specialtyCode?: string;
  }> = [
    { email: 'mona.patient@smarthealth.eg', fullName: 'منى محمد حسن', role: 'patient' },
    {
      email: 'karim.doctor@smarthealth.eg',
      fullName: 'د. كريم أحمد سامي',
      role: 'doctor',
      licenseNumber: 'EG-MED-90421',
      facilityId: clinicId,
      specialtyCode: 'internal_medicine',
    },
    {
      email: 'salma.pharmacist@smarthealth.eg',
      fullName: 'د. سلمى إبراهيم',
      role: 'pharmacist',
      licenseNumber: 'EG-PHM-44210',
      facilityId: pharmId,
    },
    {
      email: 'tarek.paramedic@smarthealth.eg',
      fullName: 'أ. طارق محمود (إسعاف)',
      role: 'paramedic',
      licenseNumber: 'EG-EMS-11045',
      facilityId: erId,
    },
    { email: 'admin@smarthealth.eg', fullName: 'مسؤول النظام', role: 'admin' },
  ];

  let patientUid = '';
  for (const u of usersToSeed) {
    const uid = await ensureAuthUser(auth, {
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      ...(u.role !== 'patient' && u.role !== 'admin' ? { licenseStatus: 'verified' } : {}),
      ...(u.facilityId ? { facilityId: u.facilityId } : {}),
    });
    if (u.role === 'patient') patientUid = uid;

    await db.collection(COLLECTIONS.users).doc(uid).set(
      {
        id: uid,
        role: u.role,
        status: 'active',
        session_epoch: 0,
        full_name: u.fullName,
        email: u.email,
        phone: null,
        preferred_locale: 'ar',
        created_at: nowIso,
        updated_at: nowIso,
      } satisfies UserDoc,
      { merge: true },
    );

    if (u.role === 'doctor' || u.role === 'pharmacist' || u.role === 'paramedic') {
      await db.collection(COLLECTIONS.practitioners).doc(uid).set(
        {
          id: uid,
          practitioner_type: u.role,
          license_number: u.licenseNumber ?? 'EG-0000',
          license_authority: 'Egyptian Medical Syndicate',
          license_status: 'verified',
          license_expires_at: '2029-12-31',
          license_status_changed_at: nowIso,
          specialty_code: u.specialtyCode ?? null,
          facility_ids: u.facilityId ? [u.facilityId] : [],
          active_facility_id: u.facilityId ?? null,
          created_at: nowIso,
        } satisfies PractitionerDoc,
        { merge: true },
      );
    }
  }

  // 4. Seed Sample Patient Encrypted Record + Allergy
  if (patientUid) {
    const nationalId = '29605121234567';
    const bidx = cipher.blindIndex(`national_id:${nationalId}`, 'id_document').toString('hex');
    await db.collection(COLLECTIONS.patients).doc(patientUid).set(
      {
        id: patientUid,
        mrn: 'SH-EG-000102',
        mrn_last4: '0102',
        id_document_type: 'national_id',
        id_document_blind_index: bidx,
        id_document_number_enc: cipher.encrypt(
          nationalId,
          aad('patients', 'id_document_number_enc', patientUid),
        ),
        date_of_birth: '1996-05-12',
        sex: 'female',
        blood_type: 'O+',
        blood_type_source: 'clinician_confirmed',
        blood_type_confirmed_at: nowIso,
        created_at: nowIso,
      } satisfies PatientDoc,
      { merge: true },
    );

    const allergyId = randomUUID();
    await db.collection(COLLECTIONS.medicalRecords).doc(allergyId).set({
      id: allergyId,
      patient_id: patientUid,
      kind: 'allergy',
      allergen_type: 'ingredient',
      allergen_code: 'PENICILLIN',
      allergen_free_text_enc: null,
      severity: 'severe',
      reaction_enc: cipher.encrypt('Urticaria and bronchospasm', aad('medical_records', 'reaction_enc', allergyId)),
      status: 'active',
      source: 'clinician_confirmed',
      recorded_at: nowIso,
      updated_at: nowIso,
    } satisfies MedicalRecordDoc);

    await writeAuditLog(db, null, {
      action: 'SYSTEM_SEED_COMPLETED',
      resourceType: 'patient',
      resourceId: patientUid,
      patientId: patientUid,
      patientMrnLast4: '0102',
    });

    // Pre-warm AI cache for demo patient (0-token <50ms response during graduation defense)
    await summarizePatientHistory(env, {
      patientId: patientUid,
      locale: 'ar',
      ageBand: '18-34',
      sex: 'female',
      bloodType: 'O+',
      allergies: [{ name: 'PENICILLIN', severity: 'severe' }],
      conditions: [],
      medications: [],
      recentEncounters: [],
      db,
      role: 'system_seed',
    });
    await explainPrescription(env, {
      prescriptionId: 'demo-rx-001',
      locale: 'ar',
      items: [
        {
          drug_id: 'drug-paracetamol-500',
          drug_name: 'Panadol 500mg',
          dose: '1 قرص',
          frequency: 'كل 8 ساعات عند اللزوم',
          duration_days: 5,
        },
      ],
      db,
      role: 'system_seed',
    });
  }

  console.log('Firebase Firestore + Auth seed complete across all 5 roles.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
