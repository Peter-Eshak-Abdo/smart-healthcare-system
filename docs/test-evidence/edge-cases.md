# Edge-Cases & Failure Modes Verification Matrix

| Category / Edge IDs | Automated Coverage in Repo | Latest Verified Result |
|---------------------|----------------------------|------------------------|
| DB Constraints, RLS & Double-Dispense Race (T01–T25, E-RX-01..04) | `supabase/tests/*.sql` (`03_race_partial.sql`, `03_race_one.sql`, `04_emergency_biometric_audit.sql`) + `backend-api` route unit/race tests | Static SQL syntax checked (`bash -n` exit 0); live PostgreSQL run scheduled in CI `pgvector/pgvector:pg16`; `backend-api` 7 test suites / 30 tests passed |
| E-RX Signature Tamper, Offline Dispense Guard, Substitution & Partial Dispense | `backend-api/tests/prescriptions.test.ts`, `web-admin/tests/components/safety-and-rx.test.tsx`, `mobile-app/lib/features/pharmacist/` | Passed in `backend-api` Vitest (30 tests) & `web-admin` Vitest (7 tests) |
| Clinical Safety Deterministic Rules & Restricted Medication Masking | `ai-service/tests/test_clinical_and_assistant.py`, `web-admin/tests/components/safety-and-rx.test.tsx` | Passed in `ai-service` Pytest (12 tests) & `web-admin` Vitest |
| AI Biometrics Liveness, Transform Invariance, Thresholds & Red-Flag Triage | `ai-service/tests/test_face_and_contracts.py`, `ai-service/tests/test_clinical_and_assistant.py` | Passed in `ai-service` Pytest (12/12 passed, 100% red-flag recall across EN/MSA/Egyptian/Franco-Arabic) |
| RTL Layout, Zero-Hex Tokens, WCAG Contrast & Mobile Modes | `web-admin/scripts/tokens-contrast.mjs`, `web-admin/tests/components/rtl-and-contrast.test.ts`, `mobile-app/test/*.dart` | Contrast 12/12 passed; ESLint & Flutter analyze 0 errors; Flutter 4/4 widget tests passed |
