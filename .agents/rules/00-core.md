---
trigger: always_on
description: Core engineering rules for every task in SmartHealth
---
# Core rules
- Use only identifiers defined in docs/00-INDEX.md (schemas, tables, enums, error codes, env vars, permissions).
- Strict typing everywhere: TypeScript `strict` (no `any`, no `@ts-ignore`), Dart sound null-safety (no `dynamic`
  in domain/presentation), Python `mypy --strict` (no bare `Any` in public functions).
- No secrets in code, tests, fixtures, docs, or commit messages. Read config from env via the validated config module.
- Never weaken a test to make it pass. Never delete a failing test without explaining why in the PR.
- Every new behaviour gets a test named after its acceptance-criterion ID (e.g. `US-12-AC3 ...`) or edge case ID (`E-RX-02 ...`).
- Generated files (shadcn ui/, kysely types.gen.ts, OpenAPI yaml, *.g.dart, *.freezed.dart) are regenerated, not hand-edited.
- Arabic (RTL) and English (LTR) are equal: every user-facing string goes through i18n (no hard-coded UI text).
- Prefer small pure functions; keep files under ~400 lines; one responsibility per module.
