---
description: Safely change an API contract (schemas, examples, OpenAPI, docs)
---
1. Follow .agents/rules/70-contracts.md steps 1–7 exactly.
// turbo
2. Run `pnpm contracts:openapi && pnpm contracts:check`
3. List impacted consumers (web/mobile/ai) and the files they must update.
