-- 0002_enums_and_reference.sql
-- ===== Enums (names are canonical — see docs/00-INDEX.md §5.2) =====
create type app.app_role                 as enum ('patient','doctor','pharmacist','paramedic','admin');
create type app.account_status           as enum ('pending_verification','active','suspended','deactivated');
create type app.license_status           as enum ('pending','verified','suspended','revoked','expired');
create type app.facility_type            as enum ('hospital','clinic','pharmacy','ambulance_service');
create type app.sex                      as enum ('male','female');
create type app.blood_type               as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown');
create type app.data_source              as enum ('patient_reported','clinician_confirmed','imported');
create type app.allergen_type            as enum ('ingredient','drug_class','food','environmental','other');
create type app.allergy_severity         as enum ('mild','moderate','severe','anaphylaxis');
create type app.condition_status         as enum ('active','resolved','inactive');
create type app.encounter_type           as enum ('outpatient','inpatient','emergency','teleconsult');
create type app.grant_type               as enum ('patient_share','encounter','admin_override');
create type app.grant_status             as enum ('active','revoked','expired');
create type app.prescription_status      as enum ('pending','partially_dispensed','dispensed','cancelled','expired');
create type app.rx_item_status           as enum ('pending','partially_dispensed','dispensed','cancelled');
create type app.alert_type               as enum ('drug_drug','drug_allergy','duplicate_therapy','drug_condition');
create type app.alert_severity           as enum ('minor','moderate','major','contraindicated');
create type app.verification_method      as enum ('pickup_token','face_1to1','sms_otp','rx_code_only');
create type app.emergency_id_method      as enum ('face','emergency_card_qr','manual_search');
create type app.emergency_session_status as enum ('active','closed','expired');
create type app.triage_level             as enum ('emergency','urgent','soon','routine','self_care');
create type app.consent_type             as enum ('biometric_face','emergency_contacts_share','ai_assistant','terms_of_service');

-- ===== Reference data (non-PHI). Severity in ref is TEXT so ai_ref_reader needs no access to `app`. =====
create table ref.specialties (
  code        text primary key,                       -- e.g. 'internal_medicine'
  name_en     text not null,
  name_ar     text not null,
  sort_order  int  not null default 100
);

create table ref.icd10_codes (
  code               text primary key,                -- e.g. 'J45.909'
  title_en           text not null,
  title_ar           text,
  is_chronic_default boolean not null default false
);

create table ref.ingredients (
  code        text primary key check (code ~ '^ING-[A-Z0-9-]+$'),
  name_en     text not null,
  name_ar     text,
  atc_code    text,
  ddinter_id  text
);

create table ref.drug_classes (
  code            text primary key check (code ~ '^CLS-[A-Z0-9-]+$'),
  name_en         text not null,
  name_ar         text,
  duplicate_check boolean not null default false     -- true → two drugs in this class = duplicate therapy
);

create table ref.ingredient_classes (
  ingredient_code text not null references ref.ingredients(code) on update cascade,
  class_code      text not null references ref.drug_classes(code) on update cascade,
  primary key (ingredient_code, class_code)
);

create table ref.drugs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^DRG-[A-Z0-9-]+$'),
  brand_name    text not null,
  generic_name  text not null,
  strength      text not null,                        -- display, e.g. '500 mg'
  dosage_form   text not null,                        -- tablet, capsule, syrup, inhaler, injection …
  route         text not null,                        -- oral, inhalation, iv, im, topical …
  base_unit     text not null,                        -- unit used for quantities: tablet, capsule, ml, puff, vial …
  is_controlled boolean not null default false,
  is_active     boolean not null default true,
  eda_reg_no    text                                  -- Egyptian Drug Authority registration no. (optional)
);
create index drugs_brand_trgm   on ref.drugs using gin (brand_name   extensions.gin_trgm_ops);
create index drugs_generic_trgm on ref.drugs using gin (generic_name extensions.gin_trgm_ops);

create table ref.drug_ingredients (
  drug_id         uuid not null references ref.drugs(id) on delete cascade,
  ingredient_code text not null references ref.ingredients(code) on update cascade,
  strength_value  numeric(12,4),
  strength_unit   text,
  primary key (drug_id, ingredient_code)
);

create table ref.ddi_rules (
  id             bigint generated always as identity primary key,
  ingredient_a   text not null references ref.ingredients(code) on update cascade,
  ingredient_b   text not null references ref.ingredients(code) on update cascade,
  severity       text not null check (severity in ('minor','moderate','major','contraindicated')),
  mechanism_en   text not null,
  mechanism_ar   text,
  management_en  text not null,
  management_ar  text,
  source         text not null,                       -- 'seed' | 'ddinter2'
  source_ref     text,
  check (ingredient_a < ingredient_b),                -- canonical ordering, one row per pair per source
  unique (ingredient_a, ingredient_b, source)
);

create table ref.allergy_cross_reactivity (
  id                 bigint generated always as identity primary key,
  allergen_class     text not null references ref.drug_classes(code),
  target_class       text not null references ref.drug_classes(code),
  severity_if_severe text not null check (severity_if_severe in ('minor','moderate','major','contraindicated')),
  severity_if_mild   text not null check (severity_if_mild   in ('minor','moderate','major','contraindicated')),
  note_en            text not null,
  note_ar            text,
  unique (allergen_class, target_class)
);

create table ref.drug_condition_rules (
  id              bigint generated always as identity primary key,
  class_code      text references ref.drug_classes(code),
  ingredient_code text references ref.ingredients(code),
  icd10_prefix    text not null,                      -- matches icd10_code LIKE prefix || '%'
  severity        text not null check (severity in ('minor','moderate','major','contraindicated')),
  message_en      text not null,
  message_ar      text,
  check (num_nonnulls(class_code, ingredient_code) = 1)
);

create table ref.crisis_resources (
  id          bigint generated always as identity primary key,
  country     text not null default 'EG',
  label_en    text not null,
  label_ar    text not null,
  phone       text not null,
  verified_at date                                    -- must be set before production use
);

grant select on all tables in schema ref to authenticated, ai_ref_reader;
