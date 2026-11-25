# 01 — Product Requirements Document & User Stories

**Product:** SmartHealth — Digital Healthcare Platform
**Version:** 1.0 (Graduation build)
**Canonical names:** see `00-INDEX.md`. Error codes, endpoints and tables referenced here are defined in `03-API-CONTRACTS-AND-INTEGRATION.md` and `role-02-database.md`.

---

## 1. Problem Statement

In the current system a patient's medical history is scattered across paper files at every clinic and hospital.
Paper prescriptions can be forged, misread, or dispensed twice. In an emergency, paramedics usually
know nothing about an unconscious patient: not their blood type, allergies, chronic diseases or current medication.
Every one of these gaps causes avoidable harm.

**SmartHealth** gives every patient a single identity and a single longitudinal record. Authorised
doctors, pharmacists and paramedics can each see the slice of that record their role needs, and only that slice.

## 2. Goals & Non-Goals

### 2.1 Goals

| ID | Goal | Measured by |
|----|------|-------------|
| G1 | One verified identity per patient | Duplicate-patient rate < 0.5% in test data (national-ID blind index unique) |
| G2 | Unified longitudinal record | 100% of encounters/diagnoses/prescriptions linked to one `patient_id` |
| G3 | Tamper-proof e-prescriptions | 0 successful forged/altered prescriptions in penetration tests; 0 double dispenses in concurrency tests |
| G4 | Fast emergency identification | Face scan → emergency profile on screen in **≤ 5 s p95** on 4G |
| G5 | Clinical safety at prescribing time | 100% of seeded high-severity interactions and allergy conflicts flagged |
| G6 | Privacy by design | Every PHI read audited; emergency view exposes only the 6 emergency fields |
| G7 | Safe AI assistance | 100% of red-flag test phrases (AR + EN) trigger the emergency override; 0 diagnoses asserted |

### 2.2 Non-Goals (explicitly out of scope for v1.0)

- Billing, insurance claims, appointment booking, lab/radiology ordering (LIS/RIS).
- Fingerprint **identification** of third parties (SD-01). Device fingerprint for step-up **is** in scope.
- Controlled-substance (narcotics) e-prescribing workflows required by law: the flag `is_controlled` exists, but v1 only shortens validity and blocks partial/early refills.
- HL7 FHIR server. The data model is FHIR-inspired so a future adapter is straightforward.
- Native offline sync of full records. Only the patient's own emergency card is cached offline.

## 3. Personas

| Persona | Context | Top need | Device |
|---------|---------|----------|--------|
| **Mona (Patient, 34)** | Has asthma, allergic to penicillin, mother of two | See her prescriptions, keep family as emergency contacts | Android phone (mid-range) |
| **Dr. Karim (Doctor)** | Outpatient internist, 40 patients/day | Fast history review, prescribing that won't hurt patients | Desktop browser in clinic |
| **Dr. Salma (Pharmacist)** | Community pharmacy, busy evenings | Verify a prescription in seconds and never dispense twice | Web at counter + phone |
| **Ahmed (Paramedic)** | Ambulance crew, poor signal, gloves on, night shifts | Identify unconscious patient and see allergies **now** | Rugged Android phone |
| **Nour (Admin)** | Platform administrator | Verify licences, suspend bad actors, review break-glass access | Desktop browser |

## 4. Functional Modules

1. **Patient Module** — US-01 … US-05
2. **Doctor Module** — US-06 … US-09
3. **Pharmacy Module** — US-10 … US-12
4. **AI Medical Assistant & Smart Clinical Support** — US-13 … US-15 + EXT-01 … EXT-03
5. **Emergency System** — US-16 … US-18 + EXT-04
6. **Security & Privacy** — US-19 … US-21 + EXT-05 … EXT-06

`EXT-*` stories are required by the brief's expanded scope (biometric enrolment, clinical alerts,
offline emergency card, audit review). They are numbered separately so the official US-01…US-21 list
the supervisor approved stays unchanged.

## 5. MVP Priority

The supervisor-recommended first slice is marked **P0**. Everything else is **P1** (must ship by
final defence) or **P2** (stretch).

| Priority | Stories |
|----------|---------|
| **P0** | US-02, US-08, US-10, US-13, US-14, US-16, US-17 (+ their dependencies US-01, US-06, US-07, US-19, US-21) |
| **P1** | US-03, US-04, US-05, US-09, US-11, US-12, US-15, US-18, US-20, EXT-01, EXT-02, EXT-03, EXT-05 |
| **P2** | EXT-04 (offline card), EXT-06 (patient access log) |

---

## 6. User Stories with Acceptance Criteria

Conventions:
- **Given/When/Then** scenarios are written so QA can turn each one directly into an automated test. The test name is the scenario ID, e.g. `US-08-AC3`.
- "Audited" means a row is written to `audit.system_logs` with the stated `action`.
- Unless a scenario says otherwise, every scenario also inherits these **global criteria**:
  - **GC-1** Request without a valid token → `401 AUTH_TOKEN_MISSING|INVALID|EXPIRED`.
  - **GC-2** Role lacking the permission → `403 RBAC_FORBIDDEN`, audited as `ACCESS_DENIED`.
  - **GC-3** Suspended account → `403 ACCOUNT_SUSPENDED` within ≤ 30 s of suspension.
  - **GC-4** Invalid payload → `422 VALIDATION_FAILED` with field-level `errors[]`.
  - **GC-5** UI fully usable in Arabic (RTL) and English (LTR).

---

### 6.1 Patient Module

#### US-01 — Account creation & profile management
> *As a patient, I want to create an account and manage my personal information so that I can access my medical profile.*

**Priority:** P0 (dependency) · **Endpoints:** Supabase `signUp`, `POST /v1/patients/me/onboarding`, `GET/PATCH /v1/me` · **Tables:** `auth.users`, `app.profiles`, `app.patients`, `app.consents`

| ID | Scenario |
|----|----------|
| US-01-AC1 | **Given** a new user on the mobile sign-up screen **When** they submit a valid email or phone, a password meeting policy (≥ 10 chars, not in breached list), and accept Terms v1 **Then** a Supabase user is created, a verification OTP/email is sent, and an `app.profiles` row exists with `role = 'patient'` and `status = 'pending_verification'`. |
| US-01-AC2 | **Given** a user who tampers with the sign-up request to include `role: "doctor"` in user metadata **When** the account is created **Then** the database trigger still assigns `role = 'patient'` (role is never client-controlled) and the attempt is audited as `ROLE_ESCALATION_ATTEMPT`. |
| US-01-AC3 | **Given** a verified user without a patient record **When** they submit onboarding with national ID, date of birth, sex **Then** an `app.patients` row is created with an MRN `SH-XXXXXXXX`, the national ID is stored **only** as AES-256-GCM ciphertext + blind index, and `profiles.status` becomes `active`. |
| US-01-AC4 | **Given** a national ID that already belongs to another patient **When** onboarding is submitted **Then** the API returns `409` with code `VALIDATION_FAILED` and the message "This national ID is already registered. Contact support." It does **not** reveal whose account holds it. |
| US-01-AC5 | **Given** an active patient **When** they update name, phone, preferred language **Then** changes persist, `updated_at` changes, and the action is audited automatically by the DB trigger as `PROFILES_UPDATE` (only changed column **names** are logged, never values). |
| US-01-AC6 | **Given** an active patient **When** they try to change national ID or date of birth themselves **Then** the API rejects with `403 RBAC_FORBIDDEN` (identity fields are changeable only by admin after verification). |
| US-01-AC7 | **Given** a patient under 16 (computed from DOB) **When** onboarding completes **Then** the account is flagged `is_minor = true` and the AI assistant is disabled for it (guardian flow is P2). |

#### US-02 — View medical history
> *As a patient, I want to view my medical history so that I can track my previous diagnoses, medications, and doctor visits.*

**Priority:** P0 · **Endpoints:** `GET /v1/patients/me/medical-history`, `GET /v1/patients/me/encounters/{id}` · **Tables:** `app.encounters`, `app.diagnoses`, `app.conditions`, `app.medication_statements`

| ID | Scenario |
|----|----------|
| US-02-AC1 | **Given** a patient with 3 encounters **When** they open "My History" **Then** they see a reverse-chronological timeline of visits, each showing date, facility, doctor name, specialty, and diagnoses (ICD-10 title in the user's language). |
| US-02-AC2 | **Given** the timeline **When** the patient filters by `type=diagnoses|medications|visits` **Then** only that type is listed, paginated with a cursor (20 per page). |
| US-02-AC3 | **Given** an encounter **When** the patient opens it **Then** they see the diagnosis, the doctor's patient-facing notes, and the prescriptions linked to it. Internal clinician-only notes (`notes_internal`) are **not** returned. |
| US-02-AC4 | **Given** patient A **When** they request `/v1/patients/me/encounters/{id}` with an encounter ID belonging to patient B **Then** the API returns `404 RESOURCE_NOT_FOUND` (RLS hides it; existence is not leaked). |
| US-02-AC5 | **Given** a patient with no history **When** they open the screen **Then** an empty state explains how records appear ("Records are added by your doctor after a visit"). |
| US-02-AC6 | **Given** any successful history read **Then** it is audited as `PATIENT_RECORD_READ` with `actor_role = patient`, `patient_id = self`. |

#### US-03 — View electronic prescriptions
> *As a patient, I want to view my electronic prescriptions so that I can access my prescribed medications anytime.*

**Priority:** P1 · **Endpoints:** `GET /v1/patients/me/prescriptions`, `GET /v1/patients/me/prescriptions/{id}`, `POST /v1/patients/me/prescriptions/{id}/pickup-tokens`

| ID | Scenario |
|----|----------|
| US-03-AC1 | **Given** a patient with prescriptions **When** they open "My Prescriptions" **Then** they see tabs *Active* (`pending`, `partially_dispensed`) and *Past* (`dispensed`, `cancelled`, `expired`), each card showing Rx number, doctor, date, status badge and expiry countdown. |
| US-03-AC2 | **Given** an active prescription **When** opened **Then** each item shows drug name, strength, dose, frequency, duration, instructions, and **remaining quantity** (`prescribed − dispensed`). |
| US-03-AC3 | **Given** an active prescription **When** the patient taps "Show at pharmacy" **Then** the app requires device-biometric step-up (`local_auth`), then displays a pickup-token QR that expires in 10 minutes with a visible countdown. |
| US-03-AC4 | **Given** a pickup token **When** 10 minutes pass **Then** the QR is blurred and a "Generate new code" button appears; the old token is rejected by the API with `401 PICKUP_TOKEN_INVALID`. |
| US-03-AC5 | **Given** a prescription cancelled by the doctor **When** the patient views it **Then** it shows status *Cancelled* with the doctor's cancellation reason category (not free text). |

#### US-04 — View critical medical data
> *As a patient, I want to view my blood type, allergies, and chronic diseases so that my important medical information is always available.*

**Priority:** P1 · **Endpoints:** `GET /v1/patients/me/critical-info`, `POST /v1/patients/me/allergies`, `PUT /v1/patients/me/blood-type`

| ID | Scenario |
|----|----------|
| US-04-AC1 | **Given** a patient **When** they open "Critical Info" **Then** they see blood type, allergies (with severity), chronic conditions, current medications, each tagged *Confirmed by clinician* or *Self-reported*. |
| US-04-AC2 | **Given** no blood type on file **When** the patient self-reports one **Then** it is stored with `blood_type_source = 'patient_reported'` and shown to clinicians with a "Self-reported — verify before transfusion" warning. |
| US-04-AC3 | **Given** a clinician-confirmed blood type **When** the patient tries to change it **Then** the API rejects with `403 RBAC_FORBIDDEN`; only a doctor can change a confirmed value (audited `CRITICAL_INFO_UPDATED` + trigger event `PATIENTS_UPDATE`). |
| US-04-AC4 | **Given** a patient adds a self-reported allergy "Penicillin – rash" **When** saved **Then** it is stored as `allergen_type = ingredient|drug_class` mapped from the reference catalogue (search-as-you-type), `source = patient_reported`, and it **immediately** participates in drug-allergy checks (EXT-02). |
| US-04-AC5 | **Given** a patient types an allergen not in the catalogue **When** saved **Then** it is stored as `allergen_type = other` with free text and the prescribing UI shows it as an un-coded warning that doctors must read (cannot be auto-checked). |

#### US-05 — Manage emergency contacts
> *As a patient, I want to update my emergency contacts so that my family can be contacted when necessary.*

**Priority:** P1 · **Endpoints:** `GET/POST /v1/patients/me/emergency-contacts`, `PATCH/DELETE /v1/patients/me/emergency-contacts/{id}`

| ID | Scenario |
|----|----------|
| US-05-AC1 | **Given** a patient **When** they add a contact with name, relationship, E.164 phone, priority (1–5), and `share_with_emergency` toggle **Then** it is saved with name/phone encrypted (Tier 3). |
| US-05-AC2 | **Given** 5 contacts exist **When** the patient tries to add a 6th **Then** `422 VALIDATION_FAILED` ("Maximum 5 emergency contacts"). |
| US-05-AC3 | **Given** a contact **When** `share_with_emergency` is turned off **Then** paramedics can no longer see it (US-18), effective on the next request. Active emergency sessions also lose it, because the data is fetched live and never copied into the session. |
| US-05-AC4 | **Given** a contact is deleted **When** the change is saved **Then** it is soft-deleted (`deleted_at`) for audit history and disappears from all views. |
| US-05-AC5 | **Given** any change **Then** the patient's offline emergency card is invalidated and re-issued on next app open (EXT-04). |
| US-05-AC6 | **Given** a phone number in local format `010xxxxxxxx` **When** saved **Then** it is normalised to E.164 `+2010xxxxxxxx` (default region EG). |

---

### 6.2 Doctor Module

#### US-06 — Create & manage patient medical records
> *As a doctor, I want to create and manage patient medical records so that I can maintain accurate medical information.*

**Priority:** P0 (dependency) · **Endpoints:** `POST /v1/doctor/patients/{patientId}/encounters`, `PATCH /v1/doctor/encounters/{id}`, `POST /v1/doctor/patients/{patientId}/conditions`, `POST /v1/doctor/patients/{patientId}/allergies`

| ID | Scenario |
|----|----------|
| US-06-AC1 | **Given** a verified doctor (licence `verified`, MFA `aal2`) with an active grant for patient P **When** they start an encounter **Then** an `app.encounters` row is created with `doctor_id`, `facility_id` (doctor's current facility), `encounter_type`, `started_at`. |
| US-06-AC2 | **Given** a doctor **without** a grant for P **When** they try to create an encounter **Then** `403 ACCESS_GRANT_REQUIRED`, audited `ACCESS_DENIED`. |
| US-06-AC3 | **Given** an open encounter **When** the doctor edits chief complaint and notes within 24 h of `ended_at` **Then** the changes save. After 24 h, edits are **addenda** only (new row in `encounter_addenda`, original immutable) to protect record integrity. |
| US-06-AC4 | **Given** a doctor confirms an allergy **When** saved **Then** `source = clinician_confirmed`, `recorded_by = doctor_id`, audited `CRITICAL_INFO_UPDATED` + trigger event `ALLERGIES_INSERT`. |
| US-06-AC5 | **Given** a doctor marks a condition `is_chronic = true` **Then** it appears in the patient's critical info and emergency profile. |

#### US-07 — Record diagnoses & medications
> *As a doctor, I want to record diagnoses and prescribed medications so that each patient's medical history stays updated.*

**Priority:** P0 (dependency) · **Endpoints:** `POST /v1/doctor/encounters/{id}/diagnoses`, `POST /v1/prescriptions`

| ID | Scenario |
|----|----------|
| US-07-AC1 | **Given** an open encounter **When** the doctor searches "diabetes" **Then** ICD-10 codes are suggested (EN + AR titles) and selection stores `icd10_code` + optional clinical notes (encrypted). |
| US-07-AC2 | **Given** a diagnosis marked *primary* **When** another primary is added in the same encounter **Then** `422 VALIDATION_FAILED` (one primary per encounter). |
| US-07-AC3 | **Given** a prescription is issued in the encounter **Then** each item creates/updates an `app.medication_statements` row (`status = active`, `effective_until = issued_at + duration`), so "current medications" stays current without manual entry. |
| US-07-AC4 | **Given** a chronic diagnosis (e.g. E11 Type 2 diabetes) **When** recorded with "add to problem list" **Then** an `app.conditions` row is created/updated with `is_chronic = true`. |

#### US-08 — Issue electronic prescriptions (tamper-proof)
> *As a doctor, I want to issue electronic prescriptions so that patients can receive authentic prescriptions without relying on paper documents.*

**Priority:** P0 · **Endpoints:** `POST /v1/prescriptions/check`, `POST /v1/prescriptions`, `POST /v1/prescriptions/{id}/cancel`

| ID | Scenario |
|----|----------|
| US-08-AC1 | **Given** a doctor with a grant and an open encounter **When** they add drugs to the builder **Then** each change calls `/v1/prescriptions/check` (debounced 400 ms) and alert banners appear within 1 s p95 (EXT-01/02). |
| US-08-AC2 | **Given** a valid draft with no `major`/`contraindicated` alerts **When** the doctor clicks *Sign & Issue* and completes MFA re-confirmation (if session older than 15 min) **Then** a prescription is created with status `pending`, an Rx number `RX-2026-NNNNNN`, `expires_at = issued_at + 30 days`, and an **Ed25519 signature** over the canonical JSON payload. |
| US-08-AC3 | **Given** a draft with a `major` or `contraindicated` alert **When** the doctor issues without an override reason **Then** `422 RX_ALERT_OVERRIDE_REQUIRED` lists the alert IDs that need reasons. |
| US-08-AC4 | **Given** the backend re-runs safety checks at issue time **When** the server finds an alert the client did not send an override for (e.g. allergy added meanwhile) **Then** issue is rejected with `RX_ALERT_OVERRIDE_REQUIRED`. Client-side warnings are advisory; the server is authoritative. |
| US-08-AC5 | **Given** an issued prescription **When** anyone modifies its items in the DB **Then** signature verification fails and the pharmacy sees `RX_SIGNATURE_INVALID`. Items are also immutable by trigger once status ≠ `pending`-draft. |
| US-08-AC6 | **Given** a `pending` prescription with no dispensations **When** the issuing doctor cancels it with a reason category **Then** status becomes `cancelled`, the patient is notified, audited `RX_CANCELLED`. A partially dispensed prescription can only have its **remaining** items cancelled. |
| US-08-AC7 | **Given** a drug flagged `is_controlled` **When** issued **Then** validity is 7 days, `substitution_allowed = false`, and partial dispensing is limited to a single remaining pickup. |
| US-08-AC8 | **Given** the issue request is retried with the same `Idempotency-Key` **Then** the same prescription is returned (no duplicate). |

#### US-09 — Access authorised patient history
> *As a doctor, I want to access a patient's authorized medical history so that I can make better-informed medical decisions.*

**Priority:** P1 · **Endpoints:** `POST /v1/doctor/access/redeem`, `GET /v1/doctor/patients`, `GET /v1/doctor/patients/{patientId}/summary`, `GET /v1/doctor/patients/{patientId}/history`

| ID | Scenario |
|----|----------|
| US-09-AC1 | **Given** a patient generates a 6-digit share code (valid 10 min) in the app and reads it to the doctor **When** the doctor redeems it **Then** an `access_grants` row (`grant_type = patient_share`, default 30 days, scope `read_write`) is created and the patient's summary opens. |
| US-09-AC2 | **Given** the doctor has an active grant **When** they open the patient's history **Then** they see all encounters across all facilities, including other doctors' diagnoses, **except** encounters the patient marked `restricted` (US-20), which are replaced by a placeholder "1 restricted record". |
| US-09-AC3 | **Given** a grant expired or was revoked **When** the doctor requests the history **Then** `403 ACCESS_GRANT_REQUIRED`. |
| US-09-AC4 | **Given** a doctor searches patients **When** typing an MRN or national ID **Then** only patients with active grants are returned. A doctor cannot browse the patient registry. |
| US-09-AC5 | **Given** every history read **Then** audited `PATIENT_RECORD_READ` with `grant_id`. The patient can see it in their access log (EXT-06). |

---

### 6.3 Pharmacy Module

#### US-10 — Verify prescription authenticity
> *As a pharmacist, I want to verify electronic prescriptions so that I can ensure they were issued by an authorized doctor.*

**Priority:** P0 · **Endpoints:** `POST /v1/pharmacy/prescriptions/verify`, `GET /v1/.well-known/rx-jwks.json`

| ID | Scenario |
|----|----------|
| US-10-AC1 | **Given** a pharmacist (licence `verified`, member of a facility of type `pharmacy`) **When** they scan a patient's pickup-token QR **Then** the API verifies the token, the prescription signature, prescriber licence status **at issue time and now**, expiry, and status, returning `verification.result = "valid"` with prescriber name, licence number and facility. |
| US-10-AC2 | **Given** a QR whose payload was altered (one character changed) **When** scanned **Then** `422 RX_SIGNATURE_INVALID`; UI shows a red "Do NOT dispense — prescription failed authenticity check"; audited `RX_VERIFY_FAILED` with reason. |
| US-10-AC3 | **Given** the prescribing doctor's licence was revoked **after** issue **When** verified **Then** result is `"prescriber_invalid"` (`409 RX_PRESCRIBER_INVALID`), dispensing is blocked, and the pharmacist sees "Contact the patient's doctor." |
| US-10-AC4 | **Given** the patient has no phone **When** the pharmacist enters the Rx number + 6-char verification code printed on the paper summary **and** completes either face 1:1 verification or SMS OTP to the patient's phone **Then** verification succeeds with `verification_method` recorded accordingly. |
| US-10-AC5 | **Given** the pharmacy device is offline **When** a QR is scanned **Then** the app verifies the Ed25519 signature locally with the cached JWKS and shows "Authentic — connect to internet to dispense". The Dispense button stays disabled (SD-06). |

#### US-11 — View medication details
> *As a pharmacist, I want to view the medication details on a verified prescription so that I can dispense the correct medicines.*

**Priority:** P1 · **Endpoints:** `GET /v1/pharmacy/prescriptions/{id}`

| ID | Scenario |
|----|----------|
| US-11-AC1 | **Given** a verified prescription **When** opened **Then** each item shows generic + brand name, strength, dosage form, dose, route, frequency, duration, quantity prescribed, quantity already dispensed (with which pharmacy and date), remaining, substitution allowed, and instructions. |
| US-11-AC2 | **Given** the pharmacist view **Then** it shows the patient's **name, age, sex and allergies only**. It does not show diagnoses or history (minimum necessary). |
| US-11-AC3 | **Given** a prescription was **not** verified in this session (no `verification_id`) **When** the pharmacist calls the details endpoint directly **Then** `403 RBAC_FORBIDDEN`. Verification establishes a 15-minute pharmacy access context. |

#### US-12 — Record dispensing status
> *As a pharmacist, I want to record when a prescription has been dispensed so that it cannot be reused improperly.*

**Priority:** P1 · **Endpoints:** `POST /v1/pharmacy/prescriptions/{id}/lease`, `POST /v1/pharmacy/prescriptions/{id}/dispensations`

| ID | Scenario |
|----|----------|
| US-12-AC1 | **Given** a verified `pending` prescription with 3 items **When** the pharmacist dispenses all 3 in full **Then** in **one transaction** the items become `dispensed`, prescription becomes `dispensed`, a `dispensations` row with `pharmacy_id`, `pharmacist_id`, `verification_method` is created, audited `RX_DISPENSED`, patient notified. |
| US-12-AC2 | **Given** the pharmacy has only 2 of 3 drugs **When** dispensing 2 items **Then** those items become `dispensed`, the third stays `pending`, the prescription becomes `partially_dispensed`, and the remaining item can be dispensed later at **any** verified pharmacy until expiry. |
| US-12-AC3 | **Given** pharmacies A and B submit dispense requests for the same remaining item within the same second **When** both transactions run **Then** exactly one succeeds. The other receives `409 RX_ALREADY_DISPENSED` or `RX_QUANTITY_EXCEEDED`. Total dispensed never exceeds prescribed (DB `CHECK` constraint as last line). |
| US-12-AC4 | **Given** a network retry of the same dispense request with the same `Idempotency-Key` **Then** the original result is returned and nothing is dispensed twice. |
| US-12-AC5 | **Given** a fully dispensed prescription **When** any pharmacy scans it again **Then** verification returns `result = "already_dispensed"` with date and pharmacy, and the UI shows "Already dispensed on … at …". |
| US-12-AC6 | **Given** pharmacy A opens a prescription for dispensing **Then** a 5-minute soft lease is taken; pharmacy B sees "Being prepared at another pharmacy" (`409 RX_LEASE_HELD`) but may override after confirming. Correctness never depends on the lease (AC3 does). |
| US-12-AC7 | **Given** a pharmacist substitutes a generic (when `substitution_allowed`) **Then** `dispensation_items.substituted_drug_id` is recorded and must share the same active ingredients and strength (validated server-side). |

---

### 6.4 AI Medical Assistant & Smart Clinical Support

#### US-13 — Symptom input → preliminary guidance
> *As a patient, I want to enter my symptoms into an AI chatbot so that I can receive preliminary guidance.*

**Priority:** P0 · **Endpoints:** `POST /v1/assistant/sessions`, `POST /v1/assistant/sessions/{id}/messages`

| ID | Scenario |
|----|----------|
| US-13-AC1 | **Given** an adult patient who accepted the `ai_assistant` consent **When** they open the chat **Then** a persistent banner reads "This assistant gives general guidance only. It is not a diagnosis. In an emergency call 123." in their language. |
| US-13-AC2 | **Given** a symptom message in Arabic or English **When** sent **Then** a response arrives within 8 s p95 containing: plain-language guidance, self-care tips where appropriate, a `triage_level`, and the disclaimer. |
| US-13-AC3 | **Given** any assistant response **Then** it never states a definitive diagnosis ("You have X"), never recommends prescription-only drugs or doses, and never contradicts emergency advice. This is enforced by the output validator (role-04 §5.6). |
| US-13-AC4 | **Given** the LLM provider is down **When** the patient sends a message **Then** the red-flag rule engine still runs. If no red flag is found, the patient gets "The assistant is temporarily unavailable. If you feel very unwell, call 123 or visit the nearest emergency department." |
| US-13-AC5 | **Given** the chat **Then** messages are stored encrypted for 90 days, then deleted. The patient can delete a session at any time. |

#### US-14 — Specialty recommendation
> *As a patient, I want the AI assistant to recommend an appropriate medical specialty based on my symptoms so that I can choose the right doctor to consult.*

**Priority:** P0

| ID | Scenario |
|----|----------|
| US-14-AC1 | **Given** non-urgent symptoms (e.g. "itchy rash for 2 weeks") **When** the assistant responds **Then** it includes `recommended_specialty` from the **fixed** `ref.specialties` list (e.g. `dermatology`) with a one-line reason. |
| US-14-AC2 | **Given** the LLM proposes a specialty not in the list **Then** the validator maps it to the closest known code or falls back to `general_practice`. Free-text specialties are never shown. |
| US-14-AC3 | **Given** insufficient information **Then** the assistant asks up to 3 clarifying questions (onset, severity, age-relevant factors) before recommending. |

#### US-15 — Urgent-care red-flag warnings
> *As a patient, I want to receive urgent-care warnings when my symptoms may indicate an emergency so that I can seek immediate medical attention.*

**Priority:** P1 (safety-critical: treat as P0 in testing)

| ID | Scenario |
|----|----------|
| US-15-AC1 | **Given** a message matching any red-flag rule (e.g. "ألم شديد في الصدر وعرق" / "crushing chest pain and sweating") **When** sent **Then** the deterministic rule engine short-circuits **before** the LLM and returns `triage_level = emergency`, a full-screen red alert "Call 123 now", a one-tap dial button, and nearest-ER guidance. No LLM text is shown. |
| US-15-AC2 | **Given** the LLM classifies `emergency` but no rule matched **Then** the emergency alert is still shown (union of both signals; the system never downgrades). |
| US-15-AC3 | **Given** messages indicating suicidal intent or self-harm **Then** a dedicated crisis response with configured mental-health resources is shown, the assistant stays supportive, and no other content is generated. |
| US-15-AC4 | **Given** a red-flag event **Then** it is logged (`ASSISTANT_RED_FLAG`) with rule ID, **without** message text, for safety-metric reporting. |
| US-15-AC5 | **Given** the red-flag test suite (≥ 60 phrases AR/EN, incl. Egyptian dialect and misspellings) **Then** recall = 100% in CI. |

#### EXT-01 — Real-time drug–drug interaction alerts
> *As a doctor, I want to be alerted to interactions between the drugs I'm prescribing and the patient's current medications so that I avoid harmful combinations.*

| ID | Scenario |
|----|----------|
| EXT-01-AC1 | **Given** the patient's active medication includes warfarin **When** the doctor adds aspirin **Then** a `major` `drug_drug` alert shows mechanism ("increased bleeding risk") and management advice, with source attribution. |
| EXT-01-AC2 | **Given** two new drugs in the same draft interact **Then** the alert is shown as well (draft vs draft). |
| EXT-01-AC3 | **Given** two drugs sharing an active ingredient or same therapeutic class (e.g. two NSAIDs) **Then** a `duplicate_therapy` `moderate` alert appears. |
| EXT-01-AC4 | **Given** the AI service is unreachable **When** checking **Then** the API returns `checks_status = "unavailable"`, the UI shows a yellow "Safety check unavailable — review manually" banner, and issuing requires the doctor to tick "I have manually reviewed interactions" (recorded on the prescription as `safety_check_bypassed = true`, audited). |

#### EXT-02 — Drug–allergy conflict alerts & overrides
> *As a doctor, I want to be warned when a drug conflicts with a patient's recorded allergy, and to document my reason if I proceed.*

| ID | Scenario |
|----|----------|
| EXT-02-AC1 | **Given** a recorded penicillin allergy (`severity = anaphylaxis`) **When** amoxicillin is added **Then** a `contraindicated` `drug_allergy` alert appears, the line is outlined red, and *Sign & Issue* is disabled until an override is documented. |
| EXT-02-AC2 | **Given** a cephalosporin is added for a penicillin-allergic patient **Then** a `moderate` cross-reactivity alert appears. |
| EXT-02-AC3 | **Given** the doctor overrides **When** they pick a reason code (`benefit_outweighs_risk`, `allergy_disputed`, `desensitisation_protocol`, `monitored_setting`, `other`) and type ≥ 15 chars of justification **Then** the prescription issues, `clinical_alerts.overridden = true` with reason, audited `ALERT_OVERRIDDEN`, and the pharmacist sees an "Override documented by prescriber" note. |
| EXT-02-AC4 | **Given** an `other` (un-coded) allergy text exists **Then** a non-blocking `moderate` alert "Uncoded allergy on file: '…' — review manually" appears on every prescription for that patient. |

#### EXT-03 — Biometric face enrolment
> *As a patient, I want to enrol my face securely so that I can be identified in an emergency and verified at a pharmacy.*

| ID | Scenario |
|----|----------|
| EXT-03-AC1 | **Given** a patient without `biometric_face` consent **When** they open enrolment **Then** a plain-language consent explains purpose, storage (transformed template, no photos), retention, and deletion, and requires an explicit opt-in. |
| EXT-03-AC2 | **Given** consent **When** the patient captures 3 frames following active-liveness prompts (blink, turn left, turn right) **Then** the AI service checks quality + liveness, produces a transformed template, and `biometric.face_templates` gets one active row; no image is persisted anywhere. |
| EXT-03-AC3 | **Given** a printed photo or screen replay **When** used for enrolment **Then** `422 BIO_LIVENESS_FAILED` and the attempt is logged. 5 failures in 1 hour lock enrolment for 24 h. |
| EXT-03-AC4 | **Given** an enrolled patient **When** they delete their face data **Then** the template is hard-deleted, consent is withdrawn, audited `BIOMETRIC_DELETED`, and they are told emergency identification will then rely on the emergency card QR. |
| EXT-03-AC5 | **Given** a new face that matches an **existing** different patient at ≥ accept threshold **Then** enrolment is blocked with "This face is already registered. Contact support" (duplicate-identity protection) and flagged for admin review. |

---

### 6.5 Emergency System

#### US-16 — Biometric identification by authorised emergency staff
> *As an authorized emergency healthcare professional, I want to identify a registered patient using a supported biometric method so that I can retrieve their medical profile when necessary.*

**Priority:** P0 · **Endpoints:** `POST /v1/emergency/identify`, `POST /v1/emergency/identify/card`

| ID | Scenario |
|----|----------|
| US-16-AC1 | **Given** a paramedic (licence `verified`, `aal2`, member of an `ambulance_service` or `hospital`) **When** they tap *Emergency Scan* **Then** the camera opens in ≤ 1 s with face-guide overlay and torch toggle. Capture happens automatically when a face of sufficient quality is detected on-device. |
| US-16-AC2 | **Given** a captured face of a registered patient **When** identification runs **Then** the top match with cosine ≥ 0.50 **and** margin ≥ 0.08 over the 2nd candidate returns `result = "match"`, opens an `emergency_sessions` row (60 min), and navigates to the Emergency Profile. End-to-end ≤ 5 s p95. |
| US-16-AC3 | **Given** top similarity between 0.40 and 0.50, or margin < 0.08 **Then** `result = "possible_match"` shows **only** sex and age band of up to 2 candidates for visual confirmation; the paramedic must tap "Confirm this is the patient" to open the session (recorded `confirmed_by_operator = true`). |
| US-16-AC4 | **Given** no candidate ≥ 0.40 **Then** `result = "no_match"`; UI shows "No registered match — treat as unknown medical history" with standard unknown-patient precautions, plus options *Retry scan*, *Scan Emergency Card QR*. No session is opened. |
| US-16-AC5 | **Given** a spoof (photo on a phone screen) **Then** `422 BIO_LIVENESS_FAILED`; logged; after 3 liveness failures in 10 min by the same paramedic, the account is flagged for admin review. |
| US-16-AC6 | **Given** a patient carries an emergency card QR **When** the paramedic scans it **Then** the card's signature is verified (offline-capable) and, if online, an emergency session is opened with `method = emergency_card_qr`. |
| US-16-AC7 | **Given** a paramedic exceeds 20 identify attempts/hour **Then** `429 RATE_LIMITED`, and an admin alert is raised (possible abuse). |

#### US-17 — Access essential emergency information only
> *As an emergency healthcare professional, I want to access essential emergency information, such as blood type, allergies, and chronic diseases, so that I can provide safer and faster care.*

**Priority:** P0 · **Endpoints:** `GET /v1/emergency/sessions/{sessionId}/profile`

| ID | Scenario |
|----|----------|
| US-17-AC1 | **Given** an active emergency session **When** the profile loads **Then** it shows **exactly**: full name, age, sex, photo-free identity confirmation (MRN last 4), blood type (+ verified flag), allergies (allergen + severity), chronic conditions, current medications, and an *Emergency contacts* button. Nothing else is returned by the API (the response schema has no other fields). |
| US-17-AC2 | **Given** the UI **Then** it uses Emergency High-Contrast mode: anaphylaxis-level allergies first in a red block, minimum 20 sp text, works in sunlight, one-hand reachable. |
| US-17-AC3 | **Given** the session expired (60 min) **When** the profile is requested **Then** `410 EMERG_SESSION_EXPIRED`. The paramedic may extend once (+30 min) with a reason. |
| US-17-AC4 | **Given** any profile read **Then** audited `EMERGENCY_PROFILE_READ` with session ID, and the patient receives a notification after the fact: "Your emergency profile was accessed by [service] at [time]." |
| US-17-AC5 | **Given** a paramedic attempts `GET /v1/doctor/patients/{id}/history` **Then** `403 RBAC_FORBIDDEN`. Paramedics have no route to full history. |

#### US-18 — Access emergency contacts when permitted
> *As an emergency healthcare professional, I want to access emergency contacts when permitted so that I can notify the patient's family.*

**Priority:** P1 · **Endpoints:** `GET /v1/emergency/sessions/{sessionId}/contacts`

| ID | Scenario |
|----|----------|
| US-18-AC1 | **Given** an active session and contacts with `share_with_emergency = true` **When** the paramedic taps *Emergency contacts* **Then** those contacts are listed (name, relationship, phone) ordered by priority with one-tap call buttons; audited `EMERGENCY_CONTACTS_READ`. |
| US-18-AC2 | **Given** no shared contacts **Then** `403 EMERG_CONTACTS_NOT_SHARED` and the UI shows "The patient has not shared emergency contacts". |
| US-18-AC3 | **Given** the patient has the emergency-contacts consent withdrawn globally **Then** behaviour is as AC2 regardless of per-contact flags. |

#### EXT-04 — Offline emergency card
| ID | Scenario |
|----|----------|
| EXT-04-AC1 | **Given** a patient **When** the app is online **Then** it fetches a signed emergency card (JWS, 30-day expiry) and caches it encrypted in Hive; it can be shown from the app's lock-screen widget/quick action without logging in. |
| EXT-04-AC2 | **Given** a paramedic app offline **When** it scans the card QR **Then** it verifies the Ed25519 signature against cached JWKS and displays the card contents with banner "Offline card — issued [date]". |
| EXT-04-AC3 | **Given** a card older than 30 days **Then** it is shown with a red "Expired — data may be outdated" banner but still displayed (an outdated allergy list beats none in an emergency). |

---

### 6.6 Security & Privacy

#### US-19 — Secure authentication & access permissions
> *As a user, I want my medical data to be protected by secure authentication and access permissions so that only authorized people can access it.*

**Priority:** P0

| ID | Scenario |
|----|----------|
| US-19-AC1 | **Given** any API request **Then** the JWT is verified locally against Supabase JWKS (asymmetric signing keys), checking `iss`, `aud = authenticated`, `exp`, and the profile's `status` and `session_epoch` (≤ 30 s stale). |
| US-19-AC2 | **Given** a staff role (doctor, pharmacist, paramedic, admin) **When** the token's `aal` ≠ `aal2` **Then** `403 AUTH_MFA_REQUIRED`. |
| US-19-AC3 | **Given** 5 failed logins for an account in 15 min **Then** further attempts are throttled (exponential backoff) and the user is notified. |
| US-19-AC4 | **Given** a user taps *Log out of all devices* **Then** `session_epoch` increments and all refresh tokens are revoked; other devices get `401 AUTH_SESSION_REVOKED` within ≤ 30 s. |
| US-19-AC5 | **Given** all traffic **Then** TLS 1.2+ only (TLS 1.3 preferred), HSTS on web, no PHI in URLs or logs. |

#### US-20 — Permission-restricted record access
> *As a patient, I want access to my medical records to be restricted according to defined permissions so that my privacy is maintained.*

**Priority:** P1 · **Endpoints:** `GET /v1/patients/me/access-grants`, `POST /v1/patients/me/share-codes`, `DELETE /v1/patients/me/access-grants/{id}`, `PATCH /v1/patients/me/encounters/{id}/visibility`

| ID | Scenario |
|----|----------|
| US-20-AC1 | **Given** a patient **When** they open *Who can see my records* **Then** they see every active grant (doctor, facility, type, expiry) and can revoke any of them; revocation takes effect on the doctor's next request. |
| US-20-AC2 | **Given** a patient marks an encounter `restricted` **Then** doctors other than its author see only a placeholder (US-09-AC2), the emergency profile is unaffected (critical info is never hidden from emergency), and drug-safety checks still use all medications/allergies (safety overrides privacy for automated checks, without displaying the restricted record). |
| US-20-AC3 | **Given** a patient revokes a grant during an active doctor session **Then** the doctor's next request returns `403 ACCESS_GRANT_REQUIRED` and the web app redirects to the patient search page with an explanation. |

#### US-21 — Admin manages roles & permissions
> *As a system administrator, I want to manage user roles and permissions so that each user can access only the features relevant to their role.*

**Priority:** P0 (dependency) · **Endpoints:** `/v1/admin/users`, `/v1/admin/practitioners/{id}/license`, `/v1/admin/facilities`

| ID | Scenario |
|----|----------|
| US-21-AC1 | **Given** an admin (`aal2`) **When** they invite a doctor with email, licence number, specialty, facility **Then** a Supabase invite is sent, `profiles.role = doctor`, `practitioners.license_status = pending`. The doctor cannot prescribe until an admin marks the licence `verified` after document check. |
| US-21-AC2 | **Given** an admin suspends a practitioner **Then** `status = suspended`, `session_epoch` increments, refresh tokens are revoked; all their requests fail with `403 ACCOUNT_SUSPENDED` within ≤ 30 s; their already-issued prescriptions are re-evaluated per edge case E-LIC-02. |
| US-21-AC3 | **Given** an admin tries to change their **own** role or suspend themselves **Then** `403 RBAC_FORBIDDEN` (two-person rule: another admin must do it). |
| US-21-AC4 | **Given** every admin action **Then** audited with before/after (non-PHI) values. |
| US-21-AC5 | **Given** the admin role **Then** admins **cannot** read patient clinical data (no `patient_record:read:*` permission). Administration and clinical access are separated. |

#### EXT-05 — Audit review & break-glass oversight
| ID | Scenario |
|----|----------|
| EXT-05-AC1 | **Given** an admin **When** they open *Audit* **Then** they can filter `system_logs` by actor, action, patient MRN (resolved via blind index), outcome, date range; results export as CSV with PHI columns excluded. |
| EXT-05-AC2 | **Given** emergency sessions in the last 7 days **Then** each appears in a *Break-glass review* queue; admin marks `appropriate`/`inappropriate` with a note. |
| EXT-05-AC3 | **Given** the nightly integrity job **Then** it recomputes the audit hash chain; any mismatch raises a `critical` alert and the dashboard shows "Audit chain broken at event #N". |

#### EXT-06 — Patient access log (transparency)
| ID | Scenario |
|----|----------|
| EXT-06-AC1 | **Given** a patient **When** they open *Access history* **Then** they see who (role, name, facility) read or changed their record and when, including emergency access, for the last 12 months. |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Read APIs p95 ≤ 300 ms; `/prescriptions/check` p95 ≤ 800 ms; emergency identify p95 ≤ 3 s server-side |
| NFR-02 | Availability | Target 99.5% during demo period; emergency endpoints have priority (separate rate-limit bucket) |
| NFR-03 | Security | OWASP ASVS 4.0 Level 2 for all APIs; Level 3 controls for auth, crypto and emergency |
| NFR-04 | Privacy | Data minimisation per role; Egypt Personal Data Protection Law No. 151/2020 principles (consent, purpose limitation, sensitive-data safeguards) |
| NFR-05 | Accessibility | WCAG 2.2 AA (web), Material accessibility guidelines (mobile); Emergency mode AAA contrast |
| NFR-06 | Localisation | Arabic (RTL) and English (LTR) at feature parity; dates in Gregorian; Eastern-Arabic numerals optional setting |
| NFR-07 | Auditability | 100% of PHI reads and all writes logged; logs immutable and hash-chained |
| NFR-08 | Scalability | Designed for 100k patients, 1M encounters; HNSW index keeps face search < 100 ms at 100k templates |
| NFR-09 | Maintainability | ≥ 80% unit-test coverage on backend domain services and AI rule engines; contracts generated from one OpenAPI file |
| NFR-10 | Observability | Structured JSON logs with `request_id`; health/ready endpoints; error tracking (Sentry or equivalent) without PHI |
| NFR-11 | Device support | Android 8+ (API 26+), iOS 15+; Chrome/Edge/Firefox/Safari latest 2 versions |

## 8. Traceability Matrix (story → artefacts)

| Story | API (03) | Tables (R2) | Web (R5) | Mobile (R6) | Edge cases (02) |
|-------|----------|-------------|----------|-------------|-----------------|
| US-01 | `/v1/me`, `/v1/patients/me/onboarding` | profiles, patients, consents | — | `auth`, `onboarding` | E-ID-01..04 |
| US-02 | `/v1/patients/me/medical-history` | encounters, diagnoses, conditions | — | `medical_history` | E-PRIV-03 |
| US-03 | `/v1/patients/me/prescriptions*` | prescriptions, items | — | `prescriptions` | E-RX-07 |
| US-04 | `/v1/patients/me/critical-info` | allergies, conditions, patients | — | `critical_info` | E-CLIN-05 |
| US-05 | `/v1/patients/me/emergency-contacts` | emergency_contacts | — | `emergency_contacts` | E-PRIV-01, 02 |
| US-06/07 | `/v1/doctor/*` | encounters, diagnoses | Doctor workspace | — | E-REC-01..03 |
| US-08 | `/v1/prescriptions*` | prescriptions, clinical_alerts | Rx Builder | — | E-CLIN-01..06, E-RX-* |
| US-09 | `/v1/doctor/access/redeem`, `/summary`, `/history` | access_grants | Patient profile | `share_code` | E-PRIV-04 |
| US-10..12 | `/v1/pharmacy/*` | dispensations, leases | Pharmacist portal | `pharmacy` | E-RX-01..10, E-NET-03 |
| US-13..15 | `/v1/assistant/*` | assistant_* | — | `assistant` | E-AI-01..08 |
| US-16..18 | `/v1/emergency/*` | emergency_sessions, face_templates | ER desk (P2) | `emergency` | E-BIO-*, E-NET-01..02 |
| US-19..21 | `/v1/auth/*`, `/v1/admin/*` | profiles, devices, system_logs | Admin panel | `auth`, `security` | E-AUTH-*, E-LIC-* |

## 9. Release Acceptance (Definition of Done for the product)

1. Every acceptance criterion above has an automated test (unit, integration or E2E) whose name matches the AC ID, or a documented manual test in `docs/test-evidence/`.
2. All `02` edge cases marked **Must** pass.
3. Security checklist (`role-01 §11`) fully green; no open High/Critical findings.
4. Demo script (Stage 7) runs end-to-end in both languages on a physical Android phone and a laptop.
