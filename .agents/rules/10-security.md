---
trigger: always_on
description: Non-negotiable security and privacy rules (healthcare data)
---
# Security rules (violations block merge)
1. Never bypass RBAC: every backend route declares `requirePermission(...)`; staff routes require aal2 and a verified licence.
2. Never expose Firestore/Storage directly for clinical writes: domain DB access runs ONLY through `backend-api` Admin SDK with `requirePermission(...)`, custom claims validation, and audit logging. Never embed Firebase service account credentials in client bundles.
3. Always log sensitive reads: any read of patient clinical data, emergency profile/contacts, or prescriptions by a
   non-owner calls the audit helper (`PATIENT_RECORD_READ`, `EMERGENCY_PROFILE_READ`, ...). Writes are logged by DB triggers.
4. Never log PHI: no request/response bodies, national IDs, phones, names, clinical text, chat text, images, embeddings, tokens.
5. Tier-3 fields (*_enc) are encrypted with `encryptField` (AES-256-GCM, AAD = table|column|rowId) before insert; never store them in plaintext.
6. Biometric: never persist face images; never return or log embeddings; never query `biometric.*` except via `private.*` functions.
7. Emergency responses use the CLOSED schema (strict Zod); never add fields beyond docs/03 §9.4.
8. Drug-safety decisions are deterministic rules; an LLM must never decide interactions, doses, or downgrade triage.
9. Prescriptions are signed (Ed25519/JCS) before commit; signed rows and items are immutable; dispensing is idempotent and lock-protected.
10. Unauthorised resource access returns 404 (not 403) for patient-scoped resources, to prevent enumeration.
11. No PHI in URLs/query strings, localStorage, IndexedDB, unencrypted Hive boxes, or push/SMS payloads.
12. Validate all input with Zod/Pydantic at the boundary (`.strict()`), reject unknown fields.
