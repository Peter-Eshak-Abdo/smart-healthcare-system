---
description: Add a backend endpoint end-to-end following SmartHealth contracts
---
1. Locate the endpoint in docs/03 (or propose it via /contract-change if missing). Note permission, headers, errors.
2. Add/confirm Zod request/response schemas + examples in packages/contracts.
3. Create/extend modules/<area>/{routes,controller,service,repository}.ts with requirePermission + validate (+ idempotency/step-up if marked).
4. Use withUserTx for DB access; call private.* functions where docs/role-02 defines them; add audit events per docs/role-01 §9.3.
5. Write integration tests: happy path + every listed error code + BOLA (other user's id → 404).
// turbo
6. Run `pnpm --filter backend-api test` and `pnpm contracts:check`.
