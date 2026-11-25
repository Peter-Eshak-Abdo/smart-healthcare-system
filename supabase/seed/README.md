# SmartHealth Seed Data & Hosted Supabase Checklist

## 1. Reference Data (`01_reference.sql`)
Contains non-PHI reference tables (`ref.specialties`, `ref.icd10_codes`, `ref.drug_classes`, `ref.ingredients`, `ref.ingredient_classes`, `ref.drugs`, `ref.drug_ingredients`, `ref.ddi_rules`, `ref.allergy_cross_reactivity`, `ref.drug_condition_rules`, `ref.crisis_resources`) and demo facilities (`app.facilities`).

## 2. Development Users (PHI → seeded via Backend, NOT SQL)
Patient identifiers and contacts must be encrypted with the backend's AES-256-GCM keys and blind indexes (`BLIND_INDEX_KEY`), so dev users are created by `backend-api/scripts/seed-dev.ts` (`pnpm seed:dev`):

| Email (local only) | Role | Notes |
|--------------------|------|-------|
| `admin1@smarthealth.test`, `admin2@smarthealth.test` | `admin` | Two admins for the two-person rule |
| `dr.karim@smarthealth.test` | `doctor` (`internal_medicine`) @ Canal Family Clinic | |
| `dr.heba@smarthealth.test` | `doctor` (`cardiology`) @ Ismailia Medical Center | |
| `ph.salma@smarthealth.test` | `pharmacist` @ El-Shifa Pharmacy | |
| `ph.nour@smarthealth.test` | `pharmacist` @ Nour Pharmacy | For concurrent dispense race demos |
| `pm.ahmed@smarthealth.test` | `paramedic` @ Ismailia Ambulance Service | |
| `mona@smarthealth.test` | `patient` | Penicillin anaphylaxis, asthma, on warfarin (E2E hero patient) |
| `hany@smarthealth.test` | `patient` | CKD stage 4, diabetic (drug-condition alerts) |

`DEV_SEED_PASSWORD` must be provided via environment variable (never committed). The seed script refuses to run when `APP_ENV=production`.

## 3. First Admin Bootstrap (Hosted Supabase)
1. In Supabase Dashboard → Authentication → Users → **Invite user**, set **App metadata** `{"invited_role":"admin"}`.
2. In the SQL Editor (runs as `postgres`): `update app.profiles set status = 'active' where id = '<uuid>';`
3. Log in as that admin, enrol TOTP (`aal2`), and invite the second admin through the app.

## 4. Hosted Supabase Dashboard Settings Checklist (cannot be set via CLI `config.toml`)
- [ ] **API → Exposed schemas**: set to `public` ONLY (never expose `app`, `biometric`, `audit`, `ref`, `private`).
- [ ] **Authentication → JWT Signing Keys**: enable **Asymmetric (ES256)** and revoke legacy HS256 secret after migration.
- [ ] **Authentication → Hooks → Custom Access Token**: enable `private.custom_access_token_hook`.
- [ ] **Authentication → Password Protection**: enable leaked-password protection (HIBP).
- [ ] **Authentication → Bot & Abuse Protection**: configure Turnstile or hCaptcha on sign-up/sign-in/password reset.
- [ ] **Authentication → Sessions**: set staff timebox (12 h) and inactivity timeout (1 h) where supported.
- [ ] **Database → Extensions**: enable `pg_cron` and schedule the 7 jobs from `migrations/20261201000007_jobs.sql`.
- [ ] **Database → Roles**: set strong passwords for `api_server` and `ai_ref_reader` via `ALTER ROLE ... PASSWORD ...` in SQL Editor.
