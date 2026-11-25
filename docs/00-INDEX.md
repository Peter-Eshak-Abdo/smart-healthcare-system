# 00 — SmartHealth Documentation Index & Canonical Glossary

> **One Identity. One Medical Record. One Secure Healthcare System.**
>
> This file is the **single source of truth for names**. Every other document, every
> migration, every DTO and every Antigravity prompt must use the identifiers below
> verbatim. If you need a new name, add it here first (PR to `docs/00-INDEX.md`,
> reviewed by the Security Lead + Database Engineer), then use it.

---

## 1. Document Map

| # | File | Owner (role slot) | Consumers |
|---|------|-------------------|-----------|
| 00 | `00-INDEX.md` | Tech Lead (rotating) | Everyone |
| 01 | `01-PRD-AND-USER-STORIES.md` | Tech Lead + UI/UX | Everyone |
| 02 | `02-EDGE-CASES-AND-FAILURE-MODES.md` | Security Lead + QA | Everyone |
| 03 | `03-API-CONTRACTS-AND-INTEGRATION.md` | Backend Lead | Web, Mobile, AI |
| R1 | `role-01-super-security.md` | Security Lead | Everyone |
| R2 | `role-02-database.md` | Database Engineer | Backend, Security |
| R3 | `role-03-backend.md` | Backend Engineer(s) | Web, Mobile, AI |
| R4 | `role-04-ai-ml.md` | AI/ML Engineer | Backend |
| R5 | `role-05-frontend-web.md` | Web Engineer | UI/UX |
| R6 | `role-06-mobile-flutter.md` | Mobile Engineer(s) | UI/UX |
| R7 | `role-07-ui-ux.md` | UI/UX Designer | Web, Mobile |
| A1 | `ANTIGRAVITY-RULES.md` | Tech Lead | Antigravity agent + everyone |
| A2 | `ANTIGRAVITY-STAGES.md` | Tech Lead | Antigravity agent + everyone |

### Suggested allocation of the 8 team members

| Slot | Role | Primary file | Secondary duty |
|------|------|--------------|----------------|
| M1 | Super Security / Cybersecurity Lead | R1 | Code review of every PR touching auth, RLS, crypto |
| M2 | Database Engineer | R2 | Seed data, pgTAP tests |
| M3 | Backend Engineer A (core, auth, patients, doctors) | R3 | OpenAPI contract owner |
| M4 | Backend Engineer B (prescriptions, pharmacy, emergency) | R3 | Integration tests |
| M5 | AI / ML Engineer | R4 | Drug-reference data import |
| M6 | Frontend Web Engineer | R5 | Playwright E2E |
| M7 | Mobile Engineer | R6 | Device testing matrix |
| M8 | UI/UX Designer + QA/Release | R7 | Edge-case test execution (02), demo script |

If the team prefers two mobile engineers instead of two backend engineers, move M4 to mobile and
give Backend Engineer A ownership of the Stage 4 engine; the stage plan still holds.

---

## 2. Scope Decisions (read before anything else)

These are binding architecture decisions that resolve contradictions in the original brief.

| ID | Decision | Why |
|----|----------|-----|
| **SD-01** | **Patient identification = Face Recognition (1:N).** Fingerprint *identification* of a third person is **out of MVP** and kept as a reserved interface (`/internal/v1/fingerprint/*`, returns `501`). | Flutter `local_auth` (iOS Face ID/Touch ID, Android BiometricPrompt) only answers "did the **device owner** authenticate?". It never exposes a template, so a paramedic phone cannot fingerprint-identify an unconscious patient. Real fingerprint 1:N needs an external scanner SDK (ISO/IEC 19794-2 templates). |
| **SD-02** | **`local_auth` = device-bound step-up / MFA.** A P-256 key pair lives in the device's hardware keystore, gated by biometric; the server stores only the public key and verifies signed challenges. | Gives "Biometric MFA" honestly: inherence (biometric) + possession (device key). |
| **SD-03** | **Face templates are stored as keyed orthogonal transforms** (`T = R · e`, `R` a secret 512×512 orthogonal matrix held only by the AI service) in the isolated `biometric` schema. Raw embeddings and face images are **never persisted**. | pgvector cannot search AES-encrypted vectors. Orthogonal transforms preserve cosine similarity, so search works, while stored data is not the raw template and can be re-keyed (`T' = R₂ R₁ᵀ T`) without re-enrolment. Defence-in-depth adds RLS deny-all + Supabase disk encryption (AES-256). |
| **SD-04** | **Clinical free text and identifiers use application-level AES-256-GCM envelope encryption** in the backend. `pgcrypto` is used for hash-chaining the audit log (`digest()`), not for column encryption. | `pgcrypto` has no GCM mode and would force keys to live inside the database. Keeping keys out of the DB means a DB dump alone reveals no Tier-3 data. |
| **SD-05** | **Drug safety checks are deterministic rules**, never LLM output. Data source: curated seed + DDInter 2.0 import (CC BY-NC-SA 4.0, academic use, attribution required). | NLM RxNav's drug-interaction API was discontinued on 2 Jan 2024. LLMs hallucinate; interaction alerts must be reproducible. |
| **SD-06** | **No offline dispensing.** Pharmacies can verify *authenticity* offline (Ed25519 signature on QR), but recording a dispense requires a live row lock. | Offline dispensing makes double-dispensing undetectable until sync. |
| **SD-07** | **Clients never talk to Postgres directly for domain data.** Flutter/Next.js use the Supabase SDK **for Auth only**; all data goes through `backend-api`. The `app`, `biometric`, `audit`, `ref` schemas are **not exposed** through the Supabase Data API. RLS is still enforced because the backend executes every query as role `authenticated` with the caller's JWT claims. | One enforcement point for RBAC, audit and rate-limiting, with RLS as a second wall. |
| **SD-08** | **Face models:** InsightFace `buffalo_l` (SCRFD detector + ArcFace R50, 512-d) for the graduation build. Its pretrained weights are **non-commercial research only**. Commercial swap path: OpenCV Zoo YuNet + SFace (Apache-2.0). | Licence compliance. |
| **SD-09** | **Backend = Express 5 + TypeScript + Zod + Kysely** (modular monolith). | Smaller learning curve than NestJS for an 8-person student team; Zod schemas double as the contract source. |
| **SD-10** | **Next.js 16** (`proxy.ts` replaces the deprecated `middleware.ts`). The proxy only does optimistic redirects; real authorization happens in Server Components/Route Handlers and in the backend. | CVE-2025-29927 showed middleware-only auth is unsafe. |

---

## 3. Monorepo Layout (canonical)

```text
smarthealth/                          # repo: Peter-Eshak-Abdo/smart-healthcare-system
├── AGENTS.md                         # Antigravity entry rules (points to .agents/rules)
├── .agents/
│   ├── rules/                        # Antigravity workspace rules (see ANTIGRAVITY-RULES.md)
│   └── workflows/                    # Antigravity workflows (/verify-stage, /new-endpoint …)
├── docs/                             # THIS documentation set
├── packages/
│   └── contracts/                    # Single source of truth for API contracts
│       ├── openapi/smarthealth.v1.yaml
│       ├── src/schemas/*.ts          # Zod schemas (backend + web import these)
│       ├── src/errors.ts             # ErrorCode enum
│       └── dart/                     # generated Dart models for Flutter
├── supabase/
│   ├── config.toml
│   ├── migrations/                   # 0001_extensions.sql … (ordered, immutable once merged)
│   ├── seed/                         # seed.sql + ref data CSV
│   └── tests/                        # pgTAP tests
├── backend-api/                      # Express 5 + TS
├── ai-service/                       # FastAPI + Python 3.12
├── web-admin/                        # Next.js 16 (Doctors, Pharmacists, Admins)
├── mobile-app/                       # Flutter 3.x (Patients, Paramedics, Pharmacists)
├── infra/                            # docker-compose.yml, Caddy/nginx, CI scripts
└── .github/workflows/                # CI pipelines
```

---

## 4. Roles & Permissions (canonical identifiers)

### 4.1 `app_role` enum

| Value | Human name | Client(s) |
|-------|-----------|-----------|
| `patient` | Patient | Mobile |
| `doctor` | Doctor | Web (+ mobile read-only later) |
| `pharmacist` | Pharmacist | Web + Mobile |
| `paramedic` | Paramedic / ER staff | Mobile (+ Web ER desk) |
| `admin` | System Administrator | Web |

### 4.2 Permission strings (`<resource>:<action>[:<scope>]`)

```
profile:read:self            profile:update:self
patient_record:read:self     patient_record:read:granted     patient_record:write:granted
critical_info:read:self      emergency_contact:manage:self
access_grant:manage:self     access_log:read:self
biometric:enroll:self        biometric:delete:self
prescription:read:self       prescription:create             prescription:cancel:own
prescription:check           prescription:verify             prescription:dispense
emergency:identify           emergency_profile:read:session  emergency_contact:read:session
assistant:use
user:manage                  role:assign                     license:manage
audit:read                   emergency_session:review        facility:manage
drug_catalog:read            drug_catalog:manage
```

The role → permission matrix lives in `role-01-super-security.md §4` and is implemented once in
`backend-api/src/security/permissions.ts`.

---

## 5. Database Canonical Names

### 5.1 Schemas

| Schema | Purpose | Exposed via Data API? |
|--------|---------|----------------------|
| `app` | Domain tables | **No** |
| `biometric` | Face templates (transformed) | **No** (no grants to `authenticated` at all) |
| `audit` | `system_logs` (append-only, hash-chained) | **No** |
| `ref` | Reference data: drugs, ingredients, interactions, ICD-10, specialties | **No** |
| `private` | Security-definer helper functions | **No** |
| `public` | Left empty on purpose | Yes (but empty) |

### 5.2 Enums

| Enum | Values |
|------|--------|
| `app.app_role` | `patient`, `doctor`, `pharmacist`, `paramedic`, `admin` |
| `app.account_status` | `pending_verification`, `active`, `suspended`, `deactivated` |
| `app.license_status` | `pending`, `verified`, `suspended`, `revoked`, `expired` |
| `app.facility_type` | `hospital`, `clinic`, `pharmacy`, `ambulance_service` |
| `app.sex` | `male`, `female` |
| `app.blood_type` | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, `unknown` |
| `app.data_source` | `patient_reported`, `clinician_confirmed`, `imported` |
| `app.allergen_type` | `ingredient`, `drug_class`, `food`, `environmental`, `other` |
| `app.allergy_severity` | `mild`, `moderate`, `severe`, `anaphylaxis` |
| `app.condition_status` | `active`, `resolved`, `inactive` |
| `app.encounter_type` | `outpatient`, `inpatient`, `emergency`, `teleconsult` |
| `app.grant_type` | `patient_share`, `encounter`, `admin_override` |
| `app.grant_status` | `active`, `revoked`, `expired` |
| `app.prescription_status` | `pending`, `partially_dispensed`, `dispensed`, `cancelled`, `expired` |
| `app.rx_item_status` | `pending`, `partially_dispensed`, `dispensed`, `cancelled` |
| `app.alert_type` | `drug_drug`, `drug_allergy`, `duplicate_therapy`, `drug_condition` |
| `app.alert_severity` | `minor`, `moderate`, `major`, `contraindicated` |
| `app.verification_method` | `pickup_token`, `face_1to1`, `sms_otp`, `rx_code_only` |
| `app.emergency_id_method` | `face`, `emergency_card_qr`, `manual_search` |
| `app.emergency_session_status` | `active`, `closed`, `expired` |
| `app.triage_level` | `emergency`, `urgent`, `soon`, `routine`, `self_care` |
| `app.consent_type` | `biometric_face`, `emergency_contacts_share`, `ai_assistant`, `terms_of_service` |
| `audit.outcome` | `success`, `denied`, `error` |

### 5.3 Tables

| Table | One-line purpose |
|-------|------------------|
| `app.profiles` | 1:1 with `auth.users`; role, status, `session_epoch` |
| `app.facilities` | Hospitals, clinics, pharmacies, ambulance services |
| `app.practitioners` | Doctor/pharmacist/paramedic licence data |
| `app.practitioner_facilities` | Practitioner ↔ facility membership |
| `app.patients` | Patient demographics, MRN, blind index of national ID |
| `app.consents` | Versioned patient consents |
| `app.devices` | Device-bound public keys (SD-02) |
| `app.access_grants` | Patient → practitioner authorisation (US-09, US-20) |
| `app.share_codes` | 10-minute patient share codes (HMAC-stored) |
| `app.encounters` | Visits |
| `app.encounter_addenda` | Append-only corrections after the 24 h edit window |
| `app.diagnoses` | Diagnoses recorded in an encounter |
| `app.conditions` | Problem list incl. chronic diseases |
| `app.allergies` | Allergies (coded) |
| `app.medication_statements` | Current medications (derived + reported) |
| `app.emergency_contacts` | Patient emergency contacts |
| `app.prescriptions` | E-prescription header (signed) |
| `app.prescription_items` | Lines with prescribed/dispensed quantities |
| `app.clinical_alerts` | Safety alerts + overrides |
| `app.rx_verifications` | 15-minute pharmacy access context created by a successful verify |
| `app.dispense_leases` | Soft 5-minute "being prepared" lease (UX only) |
| `app.dispensations` | One dispense event (idempotent) |
| `app.dispensation_items` | Quantities dispensed per line |
| `app.emergency_sessions` | Break-glass sessions |
| `app.assistant_sessions` | AI chat sessions |
| `app.assistant_messages` | AI chat messages (encrypted) |
| `app.notifications` | Outbox for push/SMS/email (no PHI in payloads) |
| `app.admin_approvals` | Two-person approvals for admin-role changes |
| `app.drug_requests` | Doctor/pharmacist requests to add a drug to the catalogue |
| `biometric.face_templates` | `vector(512)` transformed templates |
| `biometric.attempts` | Enrol/identify/verify telemetry: scores and results, no images |
| `audit.system_logs` | Immutable audit trail |
| `ref.specialties`, `ref.icd10_codes`, `ref.ingredients`, `ref.drug_classes`, `ref.ingredient_classes`, `ref.drugs`, `ref.drug_ingredients`, `ref.ddi_rules`, `ref.allergy_cross_reactivity`, `ref.drug_condition_rules`, `ref.crisis_resources` | Reference data |

---

## 6. Service Endpoints & Ports (local dev)

| Service | URL | Notes |
|---------|-----|-------|
| Supabase (local CLI) | `http://127.0.0.1:54321` (API), `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | `supabase start` |
| backend-api | `http://localhost:4000/v1` | Public API |
| ai-service | `http://localhost:8000/internal/v1` | **Never public**; backend only |
| web-admin | `http://localhost:3000` | |
| Redis | `redis://localhost:6379` | Rate limits, caches, idempotency |

---

## 7. Canonical Error Codes

All errors use RFC 9457 Problem Details with an extra `code` field (see `03 §2.4`).

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_TOKEN_MISSING` | 401 | No bearer token |
| `AUTH_TOKEN_INVALID` | 401 | Bad signature/issuer/audience |
| `AUTH_TOKEN_EXPIRED` | 401 | `exp` passed; client must refresh |
| `AUTH_SESSION_REVOKED` | 401 | `session_epoch` mismatch / logout-all |
| `AUTH_MFA_REQUIRED` | 403 | Staff route requires `aal2` |
| `AUTH_STEP_UP_REQUIRED` | 403 | Device-biometric step-up needed |
| `AUTH_STEP_UP_INVALID` | 401 | Bad/expired step-up signature |
| `ACCOUNT_SUSPENDED` | 403 | Account not `active` |
| `LICENSE_NOT_VALID` | 403 | Practitioner licence not `verified` or expired |
| `RBAC_FORBIDDEN` | 403 | Role lacks permission |
| `ACCESS_GRANT_REQUIRED` | 403 | No active grant for this patient |
| `RESOURCE_NOT_FOUND` | 404 | Or hidden by RLS (never reveal which) |
| `VALIDATION_FAILED` | 422 | Zod / Pydantic validation |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Missing header on idempotent route |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | Same key, different body |
| `CONFLICT_VERSION` | 409 | Optimistic lock failed |
| `RATE_LIMITED` | 429 | With `Retry-After` |
| `RX_NOT_FOUND` | 404 | |
| `RX_SIGNATURE_INVALID` | 422 | Tampered/forged QR |
| `RX_EXPIRED` | 409 | |
| `RX_CANCELLED` | 409 | |
| `RX_ALREADY_DISPENSED` | 409 | Fully dispensed |
| `RX_QUANTITY_EXCEEDED` | 409 | Requested > remaining |
| `RX_LEASE_HELD` | 409 | Another pharmacy currently preparing (soft) |
| `RX_ALERT_OVERRIDE_REQUIRED` | 422 | Major/contraindicated alert without override reason |
| `RX_PRESCRIBER_INVALID` | 409 | Prescriber licence revoked after issue |
| `PICKUP_TOKEN_INVALID` | 401 | Bad/expired patient pickup token |
| `EMERG_NO_MATCH` | 200 (`result: "no_match"`) | Not an error status; see 03 |
| `EMERG_SESSION_EXPIRED` | 410 | Break-glass window closed |
| `EMERG_CONTACTS_NOT_SHARED` | 403 | Patient did not permit |
| `BIO_NO_FACE` | 422 | |
| `BIO_MULTIPLE_FACES` | 422 | |
| `BIO_LOW_QUALITY` | 422 | Blur/dark/pose |
| `BIO_LIVENESS_FAILED` | 422 | Spoof suspected |
| `BIO_CONSENT_REQUIRED` | 403 | No `biometric_face` consent |
| `BIO_ALREADY_ENROLLED` | 409 | |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI down; see fallbacks in 02 |
| `AI_TIMEOUT` | 504 | |
| `FEATURE_NOT_IMPLEMENTED` | 501 | Reserved interfaces (fingerprint) |
| `INTERNAL_ERROR` | 500 | Never leaks stack traces |

---

## 8. Canonical Environment Variables

| Variable | Used by | Secret? |
|----------|---------|---------|
| `SUPABASE_URL` | backend, web, mobile | No |
| `SUPABASE_PUBLISHABLE_KEY` | web, mobile | No (public by design) |
| `SUPABASE_SECRET_KEY` | backend only (admin user ops) | **Yes** |
| `SUPABASE_JWKS_URL` | backend | No — `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_ISSUER` | backend | No — `${SUPABASE_URL}/auth/v1` |
| `DATABASE_URL` | backend (login role `api_server`) | **Yes** |
| `DATABASE_URL_AI_REF` | ai-service (role `ai_ref_reader`, `ref` schema only) | **Yes** |
| `REDIS_URL` | backend | **Yes** |
| `KEK_CURRENT_ID`, `KEK_<ID>` (base64 32 bytes) | backend | **Yes** |
| `BLIND_INDEX_KEY` (base64 32 bytes) | backend | **Yes** |
| `RX_SIGNING_KEY_ID`, `RX_SIGNING_PRIVATE_KEY` (Ed25519 PKCS8 PEM) | backend | **Yes** |
| `EMERGENCY_CARD_SIGNING_KEY_ID`, `EMERGENCY_CARD_SIGNING_PRIVATE_KEY` | backend | **Yes** |
| `INTERNAL_JWT_SIGNING_KEY` (Ed25519) / `INTERNAL_JWT_PUBLIC_KEY` | backend / ai-service | **Yes** / No |
| `AI_SERVICE_URL` | backend | No |
| `FACE_TRANSFORM_KEY_VERSION`, `FACE_TRANSFORM_SEED_<V>` (base64 32 bytes) | ai-service only | **Yes** |
| `FACE_MATCH_ACCEPT` (default `0.50`), `FACE_MATCH_POSSIBLE` (`0.40`), `FACE_MATCH_MARGIN` (`0.08`) | backend | No |
| `LIVENESS_THRESHOLD` (default `0.80`) | ai-service | No |
| `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY` | ai-service | **Yes** (key) |
| `EMERGENCY_PHONE_NUMBER` (default `123`, verify with MoH) | ai-service, mobile | No |
| `NEXT_PUBLIC_API_BASE_URL` | web | No |
| `API_BASE_URL` (dart-define) | mobile | No |

---

## 9. Canonical Thresholds & Timings

| Name | Value | Where enforced |
|------|-------|----------------|
| Access-token TTL | 900 s | Supabase Auth settings |
| Refresh-token reuse interval | 10 s | Supabase Auth settings |
| Profile/status cache staleness | ≤ 30 s | backend `AuthContext` cache |
| Step-up token TTL | 300 s | backend |
| Pickup token TTL | 600 s | backend |
| Dispense lease TTL | 300 s | backend |
| Emergency session TTL | 60 min (extendable once by 30 min) | backend + DB check |
| Encounter grant TTL | 72 h | DB default |
| Patient-share grant default TTL | 30 days (max 365) | backend validation |
| Prescription validity | 30 days (controlled: 7 days) | DB default / backend |
| Offline emergency card validity | 30 days | backend signing |
| Face match accept / possible / margin | 0.50 / 0.40 / 0.08 cosine | backend (calibrate in Stage 3) |
| Liveness pass | ≥ 0.80 | ai-service |
| Chat retention | 90 days | nightly job |
| Audit log retention | ≥ 6 years (append-only) | policy |

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **MRN** | Medical Record Number, format `SH-` + 8 Crockford base32 chars, e.g. `SH-7K2M9Q4D` |
| **Rx number** | Human prescription number `RX-YYYY-NNNNNN` |
| **Pickup token** | 10-minute signed token generated on the patient's phone after biometric step-up, shown as QR at the pharmacy |
| **Emergency card** | Offline, signed (Ed25519) minimal emergency profile stored on the patient's phone and printable |
| **Break-glass** | Time-boxed emergency access that is fully audited and reviewed afterwards |
| **Blind index** | `HMAC-SHA256(BLIND_INDEX_KEY, normalised_value)` used to search encrypted identifiers |
| **AAL2** | Supabase Authenticator Assurance Level 2 (password + TOTP) |
| **Grant** | Row in `app.access_grants` allowing a practitioner to read/write a patient's record |
