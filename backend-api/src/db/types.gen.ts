import type { Generated } from 'kysely';

export type TimestampCol = string;

export interface AppProfilesTable {
  id: string;
  role: 'patient' | 'doctor' | 'pharmacist' | 'paramedic' | 'admin';
  status: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
  full_name: string;
  phone_enc: string | null;
  phone_bidx: Buffer | null;
  preferred_locale: 'ar' | 'en';
  session_epoch: number;
  security_flag: boolean;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppFacilitiesTable {
  id: Generated<string>;
  name: string;
  name_ar: string | null;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'ambulance_service';
  license_number: string | null;
  governorate: string | null;
  address: string | null;
  phone: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppPractitionersTable {
  id: string;
  practitioner_type: 'doctor' | 'pharmacist' | 'paramedic';
  license_number: string;
  license_authority: Generated<string>;
  license_status: 'pending' | 'verified' | 'suspended' | 'revoked' | 'expired';
  license_status_changed_at: Generated<TimestampCol>;
  license_expires_at: string | null;
  specialty_code: string | null;
  verified_by: string | null;
  verified_at: TimestampCol | null;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppPractitionerFacilitiesTable {
  practitioner_id: string;
  facility_id: string;
  role_at_facility: string | null;
  started_at: Generated<TimestampCol>;
  ended_at: TimestampCol | null;
}

export interface AppPatientsTable {
  id: string;
  mrn: Generated<string>;
  id_document_type: 'national_id' | 'passport' | 'birth_certificate';
  id_document_enc: string;
  id_document_bidx: Buffer;
  date_of_birth: string;
  sex: 'male' | 'female';
  blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
  blood_type_source: 'patient_reported' | 'clinician_confirmed' | 'imported' | null;
  blood_type_confirmed_by: string | null;
  blood_type_confirmed_at: TimestampCol | null;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppConsentsTable {
  id: Generated<string>;
  patient_id: string;
  consent_type: 'biometric_face' | 'emergency_contacts_share' | 'ai_assistant' | 'terms_of_service';
  version: string;
  granted: boolean;
  recorded_at: Generated<TimestampCol>;
}

export interface AppDevicesTable {
  id: string;
  user_id: string;
  platform: 'android' | 'ios' | 'web';
  model: string | null;
  public_key_spki: Buffer;
  key_algorithm: 'ES256';
  biometric_bound: boolean;
  registered_at: Generated<TimestampCol>;
  last_used_at: TimestampCol | null;
  revoked_at: TimestampCol | null;
}

export interface AppShareCodesTable {
  id: Generated<string>;
  patient_id: string;
  code_hmac: Buffer;
  scope: 'read_only' | 'read_write';
  grant_duration_days: number;
  expires_at: Generated<TimestampCol>;
  redeemed_at: TimestampCol | null;
  redeemed_by: string | null;
  failed_attempts: Generated<number>;
  created_at: Generated<TimestampCol>;
}

export interface AppAccessGrantsTable {
  id: Generated<string>;
  patient_id: string;
  practitioner_id: string;
  grant_type: 'patient_share' | 'encounter' | 'admin_override';
  scope: 'read_only' | 'read_write';
  status: 'active' | 'revoked' | 'expired';
  granted_at: Generated<TimestampCol>;
  expires_at: TimestampCol;
  revoked_at: TimestampCol | null;
  revoked_by: string | null;
  source_share_code_id: string | null;
}

export interface AppEncountersTable {
  id: string;
  patient_id: string;
  doctor_id: string;
  facility_id: string;
  encounter_type: 'outpatient' | 'inpatient' | 'emergency' | 'teleconsult';
  status: 'open' | 'closed' | 'entered_in_error';
  chief_complaint_enc: string | null;
  notes_internal_enc: string | null;
  patient_summary_enc: string | null;
  visibility: 'normal' | 'restricted';
  started_at: Generated<TimestampCol>;
  ended_at: TimestampCol | null;
  entered_in_error_reason: string | null;
  version: Generated<number>;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppEncounterAddendaTable {
  id: string;
  encounter_id: string;
  patient_id: string;
  author_id: string;
  text_enc: string;
  created_at: Generated<TimestampCol>;
}

export interface AppConditionsTable {
  id: Generated<string>;
  patient_id: string;
  icd10_code: string | null;
  free_text: string | null;
  is_chronic: boolean;
  status: 'active' | 'resolved' | 'inactive';
  source: 'patient_reported' | 'clinician_confirmed' | 'imported';
  onset_year: number | null;
  recorded_by: string | null;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppDiagnosesTable {
  id: string;
  encounter_id: string;
  patient_id: string;
  icd10_code: string;
  is_primary: boolean;
  clinical_notes_enc: string | null;
  condition_id: string | null;
  recorded_by: string;
  created_at: Generated<TimestampCol>;
}

export interface AppAllergiesTable {
  id: Generated<string>;
  patient_id: string;
  allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
  ingredient_code: string | null;
  drug_class_code: string | null;
  free_text: string | null;
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
  reaction: string | null;
  source: 'patient_reported' | 'clinician_confirmed' | 'imported';
  verification: 'unverified' | 'confirmed' | 'refuted';
  recorded_by: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppMedicationStatementsTable {
  id: Generated<string>;
  patient_id: string;
  drug_id: string;
  source: 'prescription' | 'patient_reported';
  prescription_item_id: string | null;
  dose_text: string | null;
  status: 'active' | 'stopped' | 'completed';
  effective_from: Generated<string>;
  effective_until: string | null;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppEmergencyContactsTable {
  id: string;
  patient_id: string;
  full_name_enc: string;
  relationship:
    | 'parent'
    | 'father'
    | 'mother'
    | 'spouse'
    | 'sibling'
    | 'child'
    | 'relative'
    | 'friend'
    | 'guardian'
    | 'other';
  phone_enc: string;
  priority: number;
  share_with_emergency: boolean;
  deleted_at: TimestampCol | null;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppPrescriptionsTable {
  id: string;
  rx_number: Generated<string>;
  patient_id: string;
  doctor_id: string;
  facility_id: string;
  encounter_id: string;
  status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
  issued_at: Generated<TimestampCol>;
  expires_at: TimestampCol;
  notes_to_pharmacist_enc: string | null;
  safety_check_bypassed: boolean;
  verification_code_hash: string;
  signature: Buffer | null;
  signature_kid: string | null;
  payload_sha256: Buffer | null;
  prescriber_invalid: boolean;
  cancel_reason_code: string | null;
  cancelled_at: TimestampCol | null;
  version: Generated<number>;
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppPrescriptionItemsTable {
  id: string;
  prescription_id: string;
  drug_id: string;
  dose: string;
  route: string;
  frequency: string;
  frequency_interval_hours: number | null;
  duration_days: number;
  quantity_prescribed: string;
  quantity_unit: string;
  quantity_dispensed: Generated<string>;
  dispense_count: Generated<number>;
  instructions: string | null;
  substitution_allowed: boolean;
  status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
  created_at: Generated<TimestampCol>;
  updated_at: Generated<TimestampCol>;
}

export interface AppNotificationsTable {
  id: Generated<string>;
  user_id: string;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  template: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  attempts: Generated<number>;
  created_at: Generated<TimestampCol>;
  sent_at: TimestampCol | null;
}

export interface AppEmergencySessionsTable {
  id: Generated<string>;
  paramedic_id: string;
  facility_id: string | null;
  patient_id: string;
  method: 'face' | 'emergency_card_qr' | 'manual_search';
  match_score: number | null;
  match_margin: number | null;
  low_confidence: boolean;
  confirmed_by_operator: boolean;
  reason_code: string;
  incident_ref: string | null;
  location_lat: string | null;
  location_lng: string | null;
  idempotency_key: string | null;
  status: 'active' | 'closed' | 'expired';
  started_at: Generated<TimestampCol>;
  expires_at: Generated<TimestampCol>;
  extended: boolean;
  extend_reason: string | null;
  closed_at: TimestampCol | null;
  patient_notified_at: TimestampCol | null;
  review_status: 'pending' | 'appropriate' | 'inappropriate';
  reviewed_by: string | null;
  reviewed_at: TimestampCol | null;
  review_note: string | null;
}

export interface AppAdminApprovalsTable {
  id: Generated<string>;
  action: 'assign_admin_role' | 'revoke_admin_role' | 'reset_admin_mfa';
  target_id: string;
  payload: Record<string, unknown>;
  requested_by: string;
  approved_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: Generated<TimestampCol>;
  decided_at: TimestampCol | null;
}

export interface AppDrugRequestsTable {
  id: Generated<string>;
  requested_by: string;
  drug_name: string;
  notes: string | null;
  status: 'open' | 'added' | 'rejected';
  resolved_by: string | null;
  resolved_drug_id: string | null;
  created_at: Generated<TimestampCol>;
  resolved_at: TimestampCol | null;
}

export interface RefSpecialtiesTable {
  code: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
}

export interface RefIcd10CodesTable {
  code: string;
  title_en: string;
  title_ar: string | null;
  is_chronic_default: boolean;
}

export interface RefIngredientsTable {
  code: string;
  name_en: string;
  name_ar: string | null;
  atc_code: string | null;
  ddinter_id: string | null;
}

export interface RefDrugClassesTable {
  code: string;
  name_en: string;
  name_ar: string | null;
  duplicate_check: boolean;
}

export interface RefDrugsTable {
  id: string;
  code: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  route: string;
  base_unit: string;
  is_controlled: boolean;
  is_active: boolean;
  eda_reg_no: string | null;
}

export interface RefDrugIngredientsTable {
  drug_id: string;
  ingredient_code: string;
  strength_value: string | null;
  strength_unit: string | null;
}

export interface AppAssistantMessagesTable {
  id: string;
  session_id: string;
  patient_id: string;
  role: 'user' | 'assistant';
  content_enc: string;
  triage_level: 'emergency' | 'urgent' | 'soon' | 'routine' | 'self_care' | null;
  red_flag: boolean;
  rule_ids: string[];
  specialty_code: string | null;
  created_at: Generated<TimestampCol>;
}

export interface AppClinicalAlertsTable {
  id: string;
  prescription_id: string;
  patient_id: string;
  doctor_id: string;
  alert_key: string;
  alert_type: 'drug_drug' | 'drug_allergy' | 'duplicate_therapy' | 'drug_condition';
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  rule_id: string;
  source: string;
  engine_version: string;
  dataset_version: string;
  overridden: boolean;
  override_reason_code: string | null;
  override_justification_enc: string | null;
  overridden_at: TimestampCol | null;
  created_at: Generated<TimestampCol>;
}

export interface AppRxVerificationsTable {
  id: Generated<string>;
  prescription_id: string;
  pharmacist_id: string;
  pharmacy_id: string;
  method: 'pickup_token' | 'face_1to1' | 'sms_otp' | 'rx_code_only';
  result: 'valid' | 'already_dispensed' | 'expired' | 'cancelled' | 'prescriber_invalid';
  pickup_jti: string | null;
  created_at: Generated<TimestampCol>;
  expires_at: Generated<TimestampCol>;
}

export interface AppDispenseLeasesTable {
  prescription_id: string;
  pharmacy_id: string;
  pharmacist_id: string;
  created_at: Generated<TimestampCol>;
  expires_at: Generated<TimestampCol>;
}

export interface AppDispensationsTable {
  id: string;
  prescription_id: string;
  pharmacy_id: string;
  pharmacist_id: string;
  verification_id: string;
  verification_method: 'pickup_token' | 'face_1to1' | 'sms_otp' | 'rx_code_only';
  idempotency_key: string;
  pickup_jti: string | null;
  counselling_given: boolean;
  notes_enc: string | null;
  dispensed_at: Generated<TimestampCol>;
}

export interface AppDispensationItemsTable {
  id: Generated<string>;
  dispensation_id: string;
  prescription_item_id: string;
  quantity: string;
  substituted_drug_id: string | null;
  batch_number: string | null;
  expiry_date: string | null;
}

export interface AppAssistantSessionsTable {
  id: Generated<string>;
  patient_id: string;
  locale: 'ar' | 'en';
  status: 'open' | 'closed';
  closed_reason: string | null;
  created_at: Generated<TimestampCol>;
  last_message_at: Generated<TimestampCol>;
}

export interface Database {
  'app.profiles': AppProfilesTable;
  'app.facilities': AppFacilitiesTable;
  'app.practitioners': AppPractitionersTable;
  'app.practitioner_facilities': AppPractitionerFacilitiesTable;
  'app.patients': AppPatientsTable;
  'app.consents': AppConsentsTable;
  'app.devices': AppDevicesTable;
  'app.share_codes': AppShareCodesTable;
  'app.access_grants': AppAccessGrantsTable;
  'app.encounters': AppEncountersTable;
  'app.encounter_addenda': AppEncounterAddendaTable;
  'app.conditions': AppConditionsTable;
  'app.diagnoses': AppDiagnosesTable;
  'app.allergies': AppAllergiesTable;
  'app.medication_statements': AppMedicationStatementsTable;
  'app.emergency_contacts': AppEmergencyContactsTable;
  'app.prescriptions': AppPrescriptionsTable;
  'app.prescription_items': AppPrescriptionItemsTable;
  'app.clinical_alerts': AppClinicalAlertsTable;
  'app.rx_verifications': AppRxVerificationsTable;
  'app.dispense_leases': AppDispenseLeasesTable;
  'app.dispensations': AppDispensationsTable;
  'app.dispensation_items': AppDispensationItemsTable;
  'app.notifications': AppNotificationsTable;
  'app.emergency_sessions': AppEmergencySessionsTable;
  'app.assistant_sessions': AppAssistantSessionsTable;
  'app.assistant_messages': AppAssistantMessagesTable;
  'app.admin_approvals': AppAdminApprovalsTable;
  'app.drug_requests': AppDrugRequestsTable;
  'ref.specialties': RefSpecialtiesTable;
  'ref.icd10_codes': RefIcd10CodesTable;
  'ref.ingredients': RefIngredientsTable;
  'ref.drug_classes': RefDrugClassesTable;
  'ref.drugs': RefDrugsTable;
  'ref.drug_ingredients': RefDrugIngredientsTable;
}
