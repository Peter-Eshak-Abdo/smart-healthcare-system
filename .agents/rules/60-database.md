---
trigger: glob
globs: "firebase/**/*.rules, firebase/**/*.json, backend-api/src/firebase/**/*.ts"
description: Firebase Firestore & Storage security rules, indexes, and schema conventions
---
# Database & Security Rules conventions (Firebase Firestore + Cloud Storage)
- Zero-trust Firestore: `firebase/firestore.rules` MUST default-deny all direct client writes and restrict client reads strictly to verified Firebase Auth Custom Claims (`role`, `account_status == 'active'`, `licence_status == 'verified'`).
- Server-only collections (`biometric_templates`, `system_logs`, `prescriptions`, `emergency_cards`, `medical_records`, `dispense_events`) MUST be accessed only via `backend-api` Admin SDK after RBAC (`requirePermission`) and audit logging.
- Every collection index change belongs in `firebase/firestore.indexes.json`.
- Audit chain integrity: every `system_logs` write appends via atomic Firestore transaction with `prev_hash` + `row_hash` SHA-256 chaining (`verifyAuditChain`).
- Seed data lives in `backend-api/scripts/seed-firebase.ts` (`npm run seed:firebase`) and never embeds production secrets.
