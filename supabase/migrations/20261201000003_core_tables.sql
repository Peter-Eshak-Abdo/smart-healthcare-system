-- 0003_core_tables.sql
-- Column suffix conventions:
--   *_enc  : text envelope "v1.<kid>.<iv_b64url>.<ct_b64url>.<tag_b64url>" (AES-256-GCM, app-level, SD-04)
--   *_bidx : bytea HMAC-SHA256 blind index for equality search on encrypted values

-- ===== Identity =====
create table app.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             app.app_role       not null default 'patient',
  status           app.account_status not null default 'pending_verification',
  full_name        text not null default '' check (char_length(full_name) <= 120),
  phone_enc        text,
  phone_bidx       bytea,
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar','en')),
  session_epoch    int  not null default 0,
  security_flag    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table app.facilities (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  name_ar        text,
  type           app.facility_type not null,
  license_number text unique,
  governorate    text,
  address        text,
  phone          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table app.practitioners (
  id                        uuid primary key references app.profiles(id) on delete cascade,
  practitioner_type         app.app_role not null check (practitioner_type in ('doctor','pharmacist','paramedic')),
  license_number            text not null unique,
  license_authority         text not null default 'EG-MOH',
  license_status            app.license_status not null default 'pending',
  license_status_changed_at timestamptz not null default now(),
  license_expires_at        date,
  specialty_code            text references ref.specialties(code),
  verified_by               uuid references app.profiles(id),
  verified_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (practitioner_type <> 'doctor' or specialty_code is not null)
);

create table app.practitioner_facilities (
  practitioner_id  uuid not null references app.practitioners(id) on delete cascade,
  facility_id      uuid not null references app.facilities(id),
  role_at_facility text,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  primary key (practitioner_id, facility_id, started_at),
  check (ended_at is null or ended_at > started_at)
);
create index practitioner_facilities_active on app.practitioner_facilities (practitioner_id) where ended_at is null;

create table app.patients (
  id                     uuid primary key references app.profiles(id) on delete cascade,
  mrn                    text not null unique check (mrn ~ '^SH-[0-9A-HJKMNP-TV-Z]{8}$'),
  id_document_type       text not null default 'national_id'
                         check (id_document_type in ('national_id','passport','birth_certificate')),
  id_document_enc        text not null,
  id_document_bidx       bytea not null unique,
  date_of_birth          date not null check (date_of_birth > date '1900-01-01'),
  sex                    app.sex not null,
  blood_type             app.blood_type not null default 'unknown',
  blood_type_source      app.data_source,
  blood_type_confirmed_by uuid references app.profiles(id),
  blood_type_confirmed_at timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table app.consents (
  id           bigint generated always as identity primary key,
  patient_id   uuid not null references app.patients(id) on delete cascade,
  consent_type app.consent_type not null,
  version      text not null,
  granted      boolean not null,
  recorded_at  timestamptz not null default now()
);
create index consents_latest on app.consents (patient_id, consent_type, recorded_at desc);

create table app.devices (
  id                uuid primary key,                -- client-generated device_id
  user_id           uuid not null references app.profiles(id) on delete cascade,
  platform          text not null check (platform in ('android','ios','web')),
  model             text,
  public_key_spki   bytea not null,
  key_algorithm     text not null default 'ES256' check (key_algorithm in ('ES256')),
  biometric_bound   boolean not null default true,
  registered_at     timestamptz not null default now(),
  last_used_at      timestamptz,
  revoked_at        timestamptz
);
create index devices_user on app.devices (user_id) where revoked_at is null;

-- ===== Access control =====
create table app.share_codes (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references app.patients(id) on delete cascade,
  code_hmac           bytea not null,
  scope               text not null default 'read_write' check (scope in ('read_only','read_write')),
  grant_duration_days int  not null default 30 check (grant_duration_days between 1 and 365),
  expires_at          timestamptz not null default now() + interval '10 minutes',
  redeemed_at         timestamptz,
  redeemed_by         uuid references app.profiles(id),
  failed_attempts     int not null default 0,
  created_at          timestamptz not null default now()
);
create index share_codes_lookup on app.share_codes (patient_id) where redeemed_at is null;

create table app.access_grants (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references app.patients(id) on delete cascade,
  practitioner_id      uuid not null references app.practitioners(id) on delete cascade,
  grant_type           app.grant_type   not null,
  scope                text not null default 'read_write' check (scope in ('read_only','read_write')),
  status               app.grant_status not null default 'active',
  granted_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  revoked_at           timestamptz,
  revoked_by           uuid references app.profiles(id),
  source_share_code_id uuid references app.share_codes(id),
  check (expires_at > granted_at),
  check ((status = 'revoked') = (revoked_at is not null))
);
create index access_grants_active on app.access_grants (practitioner_id, patient_id) where status = 'active';
create index access_grants_patient on app.access_grants (patient_id, granted_at desc);

-- ===== Clinical record =====
create table app.encounters (
  id                     uuid primary key default gen_random_uuid(),
  patient_id             uuid not null references app.patients(id) on delete cascade,
  doctor_id              uuid not null references app.practitioners(id),
  facility_id            uuid not null references app.facilities(id),
  encounter_type         app.encounter_type not null default 'outpatient',
  status                 text not null default 'open' check (status in ('open','closed','entered_in_error')),
  chief_complaint_enc    text,
  notes_internal_enc     text,
  patient_summary_enc    text,
  visibility             text not null default 'normal' check (visibility in ('normal','restricted')),
  started_at             timestamptz not null default now(),
  ended_at               timestamptz,
  entered_in_error_reason text,
  version                int not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index encounters_patient_time on app.encounters (patient_id, started_at desc);
create index encounters_doctor_time  on app.encounters (doctor_id, started_at desc);

create table app.encounter_addenda (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references app.encounters(id) on delete cascade,
  patient_id   uuid not null references app.patients(id) on delete cascade,
  author_id    uuid not null references app.practitioners(id),
  text_enc     text not null,
  created_at   timestamptz not null default now()
);

create table app.conditions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references app.patients(id) on delete cascade,
  icd10_code  text references ref.icd10_codes(code),
  free_text   text check (char_length(free_text) <= 200),
  is_chronic  boolean not null default false,
  status      app.condition_status not null default 'active',
  source      app.data_source not null,
  onset_year  int check (onset_year between 1900 and 2100),
  recorded_by uuid references app.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (icd10_code is not null or free_text is not null)
);
create index conditions_patient on app.conditions (patient_id) where status = 'active';

create table app.diagnoses (
  id                 uuid primary key default gen_random_uuid(),
  encounter_id       uuid not null references app.encounters(id) on delete cascade,
  patient_id         uuid not null references app.patients(id) on delete cascade,
  icd10_code         text not null references ref.icd10_codes(code),
  is_primary         boolean not null default false,
  clinical_notes_enc text,
  condition_id       uuid references app.conditions(id),
  recorded_by        uuid not null references app.practitioners(id),
  created_at         timestamptz not null default now()
);
create unique index diagnoses_one_primary on app.diagnoses (encounter_id) where is_primary;
create index diagnoses_patient on app.diagnoses (patient_id, created_at desc);

create table app.allergies (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references app.patients(id) on delete cascade,
  allergen_type   app.allergen_type not null,
  ingredient_code text references ref.ingredients(code),
  drug_class_code text references ref.drug_classes(code),
  free_text       text check (char_length(free_text) <= 200),
  severity        app.allergy_severity not null,
  reaction        text check (char_length(reaction) <= 200),
  source          app.data_source not null,
  verification    text not null default 'unverified' check (verification in ('unverified','confirmed','refuted')),
  recorded_by     uuid references app.profiles(id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (
    (allergen_type = 'ingredient' and ingredient_code is not null and drug_class_code is null) or
    (allergen_type = 'drug_class' and drug_class_code is not null and ingredient_code is null) or
    (allergen_type in ('food','environmental','other') and free_text is not null
       and ingredient_code is null and drug_class_code is null)
  )
);
create index allergies_patient on app.allergies (patient_id) where is_active;

create table app.medication_statements (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references app.patients(id) on delete cascade,
  drug_id              uuid not null references ref.drugs(id),
  source               text not null check (source in ('prescription','patient_reported')),
  prescription_item_id uuid,                          -- FK added after prescription_items exists
  dose_text            text,
  status               text not null default 'active' check (status in ('active','stopped','completed')),
  effective_from       date not null default current_date,
  effective_until      date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index medication_statements_active on app.medication_statements (patient_id) where status = 'active';

create table app.emergency_contacts (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references app.patients(id) on delete cascade,
  full_name_enc        text not null,
  relationship         text not null check (relationship in
                       ('parent','father','mother','spouse','sibling','child','relative','friend','guardian','other')),
  phone_enc            text not null,
  priority             smallint not null default 1 check (priority between 1 and 5),
  share_with_emergency boolean not null default true,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index emergency_contacts_patient on app.emergency_contacts (patient_id) where deleted_at is null;

-- ===== Prescriptions & dispensing =====
create sequence app.rx_number_seq;

create table app.prescriptions (
  id                     uuid primary key default gen_random_uuid(),
  rx_number              text not null unique check (rx_number ~ '^RX-\d{4}-\d{6,}$'),
  patient_id             uuid not null references app.patients(id),
  doctor_id              uuid not null references app.practitioners(id),
  facility_id            uuid not null references app.facilities(id),
  encounter_id           uuid not null references app.encounters(id),
  status                 app.prescription_status not null default 'pending',
  issued_at              timestamptz not null default now(),
  expires_at             timestamptz not null,
  notes_to_pharmacist_enc text,
  safety_check_bypassed  boolean not null default false,
  verification_code_hash text not null,                -- Argon2id of the 6-char paper code
  signature              bytea,                        -- Ed25519 over JCS payload (set once, same tx)
  signature_kid          text,
  payload_sha256         bytea,
  prescriber_invalid     boolean not null default false,
  cancel_reason_code     text check (cancel_reason_code in
                         ('prescribing_error','patient_request','therapy_changed','adverse_reaction','other')),
  cancelled_at           timestamptz,
  version                int not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (expires_at > issued_at)
);
create index prescriptions_patient on app.prescriptions (patient_id, issued_at desc);
create index prescriptions_doctor  on app.prescriptions (doctor_id, issued_at desc);
create index prescriptions_open    on app.prescriptions (expires_at) where status in ('pending','partially_dispensed');

create table app.prescription_items (
  id                       uuid primary key default gen_random_uuid(),
  prescription_id          uuid not null references app.prescriptions(id) on delete cascade,
  drug_id                  uuid not null references ref.drugs(id),
  dose                     text not null check (char_length(dose) <= 60),
  route                    text not null,
  frequency                text not null check (frequency in ('once_daily','twice_daily','three_times_daily',
                           'four_times_daily','every_x_hours','at_bedtime','as_needed','once','weekly')),
  frequency_interval_hours smallint check (frequency_interval_hours between 1 and 24),
  duration_days            smallint not null check (duration_days between 1 and 365),
  quantity_prescribed      numeric(10,2) not null check (quantity_prescribed > 0),
  quantity_unit            text not null,
  quantity_dispensed       numeric(10,2) not null default 0,
  dispense_count           smallint not null default 0,
  instructions             text check (char_length(instructions) <= 300),
  substitution_allowed     boolean not null default true,
  status                   app.rx_item_status not null default 'pending',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- LAST LINE OF DEFENCE against over-dispensing (E-RX-02)
  constraint quantity_dispensed_within_bounds
    check (quantity_dispensed >= 0 and quantity_dispensed <= quantity_prescribed),
  check ((frequency = 'every_x_hours') = (frequency_interval_hours is not null))
);
create index prescription_items_rx on app.prescription_items (prescription_id);

alter table app.medication_statements
  add constraint medication_statements_item_fk
  foreign key (prescription_item_id) references app.prescription_items(id) on delete set null;

create table app.clinical_alerts (
  id                         uuid primary key default gen_random_uuid(),
  prescription_id            uuid not null references app.prescriptions(id) on delete cascade,
  patient_id                 uuid not null references app.patients(id),
  doctor_id                  uuid not null references app.practitioners(id),
  alert_key                  text not null,
  alert_type                 app.alert_type not null,
  severity                   app.alert_severity not null,
  rule_id                    text not null,
  source                     text not null,
  engine_version             text not null,
  dataset_version            text not null,
  overridden                 boolean not null default false,
  override_reason_code       text check (override_reason_code in
                             ('benefit_outweighs_risk','allergy_disputed','desensitisation_protocol','monitored_setting','other')),
  override_justification_enc text,
  overridden_at              timestamptz,
  created_at                 timestamptz not null default now(),
  check (not overridden or (override_reason_code is not null and override_justification_enc is not null))
);
create index clinical_alerts_rx on app.clinical_alerts (prescription_id);
create index clinical_alerts_review on app.clinical_alerts (patient_id, alert_key, created_at desc);

create table app.rx_verifications (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references app.prescriptions(id),
  pharmacist_id   uuid not null references app.practitioners(id),
  pharmacy_id     uuid not null references app.facilities(id),
  method          app.verification_method not null,
  result          text not null check (result in ('valid','already_dispensed','expired','cancelled','prescriber_invalid')),
  pickup_jti      text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '15 minutes'
);
create index rx_verifications_ctx on app.rx_verifications (pharmacist_id, prescription_id, expires_at desc);

create table app.dispense_leases (
  prescription_id uuid primary key references app.prescriptions(id) on delete cascade,
  pharmacy_id     uuid not null references app.facilities(id),
  pharmacist_id   uuid not null references app.practitioners(id),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '5 minutes'
);

create table app.dispensations (
  id                  uuid primary key default gen_random_uuid(),
  prescription_id     uuid not null references app.prescriptions(id),
  pharmacy_id         uuid not null references app.facilities(id),
  pharmacist_id       uuid not null references app.practitioners(id),
  verification_id     uuid not null references app.rx_verifications(id),
  verification_method app.verification_method not null,
  idempotency_key     uuid not null unique,
  pickup_jti          text unique,                   -- single-use pickup tokens
  counselling_given   boolean not null default false,
  notes_enc           text,
  dispensed_at        timestamptz not null default now()
);
create index dispensations_rx on app.dispensations (prescription_id);
create index dispensations_pharmacy on app.dispensations (pharmacy_id, dispensed_at desc);

create table app.dispensation_items (
  id                   uuid primary key default gen_random_uuid(),
  dispensation_id      uuid not null references app.dispensations(id) on delete cascade,
  prescription_item_id uuid not null references app.prescription_items(id),
  quantity             numeric(10,2) not null check (quantity > 0),
  substituted_drug_id  uuid references ref.drugs(id),
  batch_number         text,
  expiry_date          date,
  unique (dispensation_id, prescription_item_id)
);

-- ===== Emergency =====
create table app.emergency_sessions (
  id                    uuid primary key default gen_random_uuid(),
  paramedic_id          uuid not null references app.practitioners(id),
  facility_id           uuid references app.facilities(id),
  patient_id            uuid not null references app.patients(id),
  method                app.emergency_id_method not null,
  match_score           real,
  match_margin          real,
  low_confidence        boolean not null default false,
  confirmed_by_operator boolean not null default false,
  reason_code           text not null check (reason_code in
                        ('unconscious','unable_to_communicate','altered_mental_status','language_barrier','other')),
  incident_ref          text check (char_length(incident_ref) <= 64),
  location_lat          numeric(9,6),
  location_lng          numeric(9,6),
  idempotency_key       uuid unique,
  status                app.emergency_session_status not null default 'active',
  started_at            timestamptz not null default now(),
  expires_at            timestamptz not null default now() + interval '60 minutes',
  extended              boolean not null default false,
  extend_reason         text,
  closed_at             timestamptz,
  patient_notified_at   timestamptz,
  review_status         text not null default 'pending' check (review_status in ('pending','appropriate','inappropriate')),
  reviewed_by           uuid references app.profiles(id),
  reviewed_at           timestamptz,
  review_note           text
);
create index emergency_sessions_paramedic on app.emergency_sessions (paramedic_id, started_at desc);
create index emergency_sessions_review on app.emergency_sessions (started_at desc) where review_status = 'pending';
create index emergency_sessions_patient on app.emergency_sessions (patient_id, started_at desc);

-- ===== AI assistant =====
create table app.assistant_sessions (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references app.patients(id) on delete cascade,
  locale          text not null default 'ar' check (locale in ('ar','en')),
  status          text not null default 'open' check (status in ('open','closed')),
  closed_reason   text,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index assistant_sessions_patient on app.assistant_sessions (patient_id, created_at desc);

create table app.assistant_messages (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references app.assistant_sessions(id) on delete cascade,
  patient_id     uuid not null references app.patients(id) on delete cascade,
  role           text not null check (role in ('user','assistant')),
  content_enc    text not null,
  triage_level   app.triage_level,
  red_flag       boolean not null default false,
  rule_ids       text[] not null default '{}',
  specialty_code text references ref.specialties(code),
  created_at     timestamptz not null default now()
);
create index assistant_messages_session on app.assistant_messages (session_id, created_at);

-- ===== Ops =====
create table app.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app.profiles(id) on delete cascade,
  channel    text not null check (channel in ('push','sms','email','in_app')),
  template   text not null,                          -- e.g. 'emergency_profile_accessed'
  payload    jsonb not null default '{}'::jsonb,      -- NO PHI: ids, timestamps, facility names only
  status     text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts   int not null default 0,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index notifications_pending on app.notifications (created_at) where status = 'pending';

create table app.admin_approvals (
  id           uuid primary key default gen_random_uuid(),
  action       text not null check (action in ('assign_admin_role','revoke_admin_role','reset_admin_mfa')),
  target_id    uuid not null references app.profiles(id),
  payload      jsonb not null default '{}'::jsonb,
  requested_by uuid not null references app.profiles(id),
  approved_by  uuid references app.profiles(id),
  status       text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  check (approved_by is null or approved_by <> requested_by)   -- two-person rule
);

create table app.drug_requests (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid not null references app.profiles(id),
  drug_name    text not null,
  notes        text,
  status       text not null default 'open' check (status in ('open','added','rejected')),
  resolved_by  uuid references app.profiles(id),
  resolved_drug_id uuid references ref.drugs(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- ===== Biometric (isolated; no grants to authenticated) =====
create table biometric.face_templates (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references app.patients(id) on delete cascade,
  template              extensions.vector(512) not null,   -- TRANSFORMED (SD-03), L2-normalised
  model_version         text not null,
  transform_key_version int  not null,
  quality_score         real not null,
  liveness_score        real,
  source                text not null check (source in ('enrollment','refresh')),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);
create index face_templates_hnsw on biometric.face_templates
  using hnsw (template extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);
create index face_templates_patient on biometric.face_templates (patient_id) where is_active;

create table biometric.attempts (
  id                bigint generated always as identity primary key,
  actor_id          uuid not null,
  purpose           text not null check (purpose in ('enroll','identify','verify','duplicate_check')),
  result            text not null,          -- match | possible_match | no_match | liveness_failed | low_quality | …
  top_score         real,
  second_score      real,
  liveness_score    real,
  model_version     text,
  created_at        timestamptz not null default now()
);
create index biometric_attempts_actor on biometric.attempts (actor_id, created_at desc);

-- ===== Audit (append-only, hash-chained) =====
create type audit.outcome as enum ('success','denied','error');

create table audit.system_logs (
  id            bigint generated always as identity primary key,
  chain_seq     bigint not null unique,               -- assigned under advisory lock (gap-free order)
  occurred_at   timestamptz not null default clock_timestamp(),
  actor_id      uuid,
  actor_role    text,
  action        text not null check (action ~ '^[A-Z][A-Z0-9_]+$'),
  resource_type text,
  resource_id   uuid,
  patient_id    uuid,
  outcome       audit.outcome not null default 'success',
  reason        text,
  request_id    uuid,
  ip            inet,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,   -- NEVER PHI values; field NAMES and ids only
  prev_hash     bytea not null,
  row_hash      bytea not null
);
create index system_logs_patient on audit.system_logs (patient_id, occurred_at desc);
create index system_logs_actor   on audit.system_logs (actor_id, occurred_at desc);
create index system_logs_action  on audit.system_logs (action, occurred_at desc);
