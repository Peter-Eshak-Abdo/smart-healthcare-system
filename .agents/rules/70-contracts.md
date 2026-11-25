---
trigger: model_decision
description: Use when adding or changing any API endpoint, request/response field, error code, or internal AI payload
---
# Contract change protocol
1. Edit Zod schemas in packages/contracts/src/schemas/* first (snake_case fields, .strict()).
2. Add/update examples in packages/contracts/examples/** (request + every documented response/error).
3. Run `npm run contracts:openapi` and commit the regenerated YAML; run `npm run contracts:check` (oasdiff breaking).
4. Update docs/03-API-CONTRACTS-AND-INTEGRATION.md in the same PR.
5. New error codes must be added to docs/00-INDEX.md §7 and packages/contracts/src/errors.ts.
6. Breaking change in /v1 is not allowed; add a new optional field or a new endpoint instead.
7. Notify consumers: tag the Web/Mobile/AI owners in the PR.
