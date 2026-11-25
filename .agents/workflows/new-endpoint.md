---
description: Add a backend endpoint end-to-end following SmartHealth contracts
---
1. Locate the endpoint in docs/03 (or propose it via /contract-change if missing). Note permission, headers, errors.
2. Add/confirm Zod request/response schemas + examples in `packages/contracts`.
3. Create/extend `modules/<area>/routes.ts` with `requirePermission` + `validate` (+ idempotency/step-up if marked).
4. Access Firestore via `getDb()` / `firestore-helpers.ts`, verify custom claims + `requirePermission`, encrypt Tier-3 `*_enc` fields with `encryptField`, and record immutable SHA-256 `appendAuditEvent` entries per `docs/role-01` §9.3.
5. Write unit/security tests: happy path + every listed error code + BOLA (other user's id → 404).
// turbo
6. Run `npm run test -w backend-api && npm run contracts:check`
