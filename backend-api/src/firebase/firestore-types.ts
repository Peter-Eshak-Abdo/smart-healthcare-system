import type { z } from 'zod';
import type {
  AccountStatus,
  AlertSeverity,
  AllergenType,
  AllergySeverity,
  AppRole,
  BloodType,
  ConditionStatus,
  ConsentType,
  ContactRelationship,
  DataSource,
  EncounterStatus,
  EncounterType,
  EncounterVisibility,
  FacilityType,
  GrantStatus,
  GrantType,
  LicenseStatus,
  OverrideReasonCodeSchema,
  PrescriptionStatus,
  RxFrequencySchema,
  RxItemStatus,
  Sex,
} from '@smarthealth/contracts';

export type OverrideReasonCode = z.infer<typeof OverrideReasonCodeSchema>;
export type RxFrequency = z.infer<typeof RxFrequencySchema>;

export const COLLECTIONS = {
  users: 'users',
  patients: 'patients',
  doctors: 'doctors',
  pharmacists: 'pharmacists',
  paramedics: 'paramedics',
  practitioners: 'practitioners',
  facilities: 'facilities',
  practitionerFacilities: 'practitioner_facilities',
  medicalRecords: 'medical_records',
  encounters: 'encounters',
  prescriptions: 'prescriptions',
  prescriptionItems: 'prescription_items',
  dispensations: 'dispensations',
  biometricTemplates: 'biometric_templates',
  accessGrants: 'access_grants',
  shareCodes: 'share_codes',
  emergencySessions: 'emergency_sessions',
  emergencyContacts: 'emergency_contacts',
  drugReference: 'drug_reference',
  drugInteractions: 'drug_interactions',
  icd10Reference: 'icd10_reference',
  allergensReference: 'allergens_reference',
  specialtiesReference: 'specialties_reference',
  idempotencyKeys: 'idempotency_keys',
  outboxEvents: 'outbox_events',
  securityFlags: 'security_flags',
  pendingApprovals: 'pending_approvals',
  verifySessions: 'verify_sessions',
  dispenseLeases: 'dispense_leases',
  assistantSessions: 'assistant_sessions',
  devices: 'devices',
  consents: 'consents',
  systemLogs: 'system_logs',
  auditMeta: 'audit_meta',
} as const;

export interface UserDoc {
  id: string;
  role: AppRole;
  status: AccountStatus;
  session_epoch: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  preferred_locale: 'ar' | 'en';
  created_at: string;
  updated_at: string;
}

export interface PractitionerDoc {
  id: string;
  practitioner_type: 'doctor' | 'pharmacist' | 'paramedic';
  license_number: string;
  license_authority: string | null;
  license_status: LicenseStatus;
  license_expires_at: string;
  license_status_changed_at: string | null;
  specialty_code: string | null;
  facility_ids: string[];
  active_facility_id: string | null;
  created_at: string;
}

export interface PatientDoc {
  id: string;
  mrn: string;
  mrn_last4: string;
  id_document_type: 'national_id' | 'passport';
  id_document_blind_index: string;
  id_document_number_enc: string;
  date_of_birth: string;
  sex: Sex;
  blood_type: BloodType;
  blood_type_source: DataSource;
  blood_type_confirmed_at: string | null;
  created_at: string;
}

export interface MedicalRecordDoc {
  id: string;
  patient_id: string;
  kind: 'allergy' | 'condition' | 'medication';
  allergen_type?: AllergenType | null;
  allergen_code?: string | null;
  allergen_free_text_enc?: string | null;
  severity?: AllergySeverity | null;
  reaction_enc?: string | null;
  icd10_code?: string | null;
  condition_name_ar?: string | null;
  condition_name_en?: string | null;
  is_chronic?: boolean;
  status?: ConditionStatus | 'refuted' | 'active';
  onset_year?: number | null;
  source: DataSource;
  drug_id?: string | null;
  drug_display?: string | null;
  dose_text_enc?: string | null;
  since?: string | null;
  until?: string | null;
  visibility?: EncounterVisibility;
  recorded_at: string;
  updated_at: string;
}

export interface EncounterDiagnosisDoc {
  id: string;
  icd10_code: string;
  name_ar: string;
  name_en: string;
  is_primary: boolean;
  clinical_notes_enc: string | null;
  condition_id: string | null;
  created_at: string;
}

export interface EncounterAddendumDoc {
  id: string;
  author_id: string;
  author_name: string;
  text_enc: string;
  created_at: string;
}

export interface EncounterDoc {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialty_code: string | null;
  facility_id: string;
  facility_name: string;
  encounter_type: EncounterType;
  status: EncounterStatus | 'entered_in_error';
  visibility: EncounterVisibility;
  chief_complaint_enc: string | null;
  notes_internal_enc: string | null;
  patient_summary_enc: string | null;
  diagnoses: EncounterDiagnosisDoc[];
  addenda: EncounterAddendumDoc[];
  prescription_ids: string[];
  started_at: string;
  ended_at: string | null;
  version: number;
}

export interface PrescriptionAlertSnapshot {
  alert_key: string;
  type: 'drug_drug' | 'drug_allergy' | 'duplicate_therapy' | 'drug_condition';
  severity: AlertSeverity;
  overridden: boolean;
  reason_code: OverrideReasonCode | null;
  justification_enc: string | null;
}

export interface PrescriptionDoc {
  id: string;
  rx_number: string;
  patient_id: string;
  patient_mrn: string;
  patient_name: string;
  patient_age: number;
  patient_sex: Sex;
  doctor_id: string;
  prescriber_name: string;
  prescriber_license: string;
  prescriber_specialty: string | null;
  facility_id: string;
  facility_name: string;
  encounter_id: string;
  status: PrescriptionStatus;
  issued_at: string;
  expires_at: string;
  paper_code_hash: string;
  signature_alg: 'EdDSA';
  signature_kid: string;
  signature_b64: string;
  safety_check_bypassed: boolean;
  alerts_summary: PrescriptionAlertSnapshot[];
  notes_to_pharmacist_enc: string | null;
  version: number;
  cancelled_reason_code: string | null;
  cancelled_at: string | null;
}

export interface PrescriptionItemDoc {
  id: string;
  prescription_id: string;
  patient_id: string;
  drug_id: string;
  drug_brand_name: string;
  drug_generic_name: string;
  drug_strength: string;
  drug_dosage_form: string;
  drug_is_controlled: boolean;
  dose: string;
  route: string;
  frequency: RxFrequency;
  frequency_interval_hours: number | null;
  duration_days: number;
  quantity_prescribed: number;
  quantity_dispensed: number;
  quantity_unit: string;
  instructions_enc: string | null;
  substitution_allowed: boolean;
  status: RxItemStatus;
}

export interface DispensationDoc {
  id: string;
  prescription_id: string;
  rx_number: string;
  patient_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacist_id: string;
  dispensed_at: string;
  counselling_given: boolean;
  notes_enc: string | null;
  items: Array<{
    prescription_item_id: string;
    quantity: number;
    substituted_drug_id: string | null;
    batch_number?: string | null;
    expiry_date?: string | null;
  }>;
}

export interface BiometricTemplateDoc {
  id: string;
  patient_id: string;
  status: 'active' | 'deleted';
  key_version: number;
  transformed_vector: number[];
  liveness_score: number;
  enrolled_at: string;
  deleted_at: string | null;
}

export interface AccessGrantDoc {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  facility_name: string | null;
  grant_type: GrantType;
  scope: 'read_only' | 'read_write';
  status: GrantStatus;
  granted_at: string;
  expires_at: string;
}

export interface ShareCodeDoc {
  id: string;
  patient_id: string;
  mrn: string;
  code_hmac: string;
  grant_duration_days: number;
  scope: 'read_only' | 'read_write';
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by_doctor_id: string | null;
  created_at: string;
}

export interface EmergencySessionDoc {
  id: string;
  paramedic_id: string;
  paramedic_name: string;
  patient_id: string;
  patient_mrn_last4: string | null;
  method: 'face' | 'emergency_card_qr' | 'manual_search';
  reason_code: string;
  incident_ref: string | null;
  low_confidence: boolean;
  match_score_band: string;
  started_at: string;
  expires_at: string;
  closed_at: string | null;
  review_status: 'pending' | 'appropriate' | 'inappropriate';
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface EmergencyContactDoc {
  id: string;
  patient_id: string;
  full_name_enc: string;
  relationship: ContactRelationship;
  phone_enc: string;
  priority: number;
  share_with_emergency: boolean;
  updated_at: string;
}

export interface DrugReferenceDoc {
  id: string;
  brand_name: string;
  generic_name: string;
  active_ingredient: string;
  strength: string;
  dosage_form: string;
  base_unit: string;
  atc_code: string | null;
  is_controlled: boolean;
  is_active: boolean;
}

export interface DrugInteractionDoc {
  id: string;
  ingredient_a: string;
  ingredient_b: string;
  severity: AlertSeverity;
  summary_ar: string;
  summary_en: string;
  management_ar: string;
  management_en: string;
  source: string;
}

export interface SystemLogDoc {
  id: string;
  seq: number;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  patient_id: string | null;
  patient_mrn_last4: string | null;
  outcome: 'success' | 'denied' | 'error';
  reason: string | null;
  request_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  prev_hash: string;
  entry_hash: string;
}

export interface ConsentDoc {
  id: string;
  patient_id: string;
  type: ConsentType;
  version: string;
  granted: boolean;
  recorded_at: string;
}

export interface FacilityDoc {
  id: string;
  name: string;
  type: FacilityType;
  address: string | null;
  phone: string | null;
  license_number: string | null;
  is_active: boolean;
  created_at: string;
}
