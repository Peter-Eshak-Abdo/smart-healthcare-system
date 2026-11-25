# ANTIGRAVITY-RULES — Workspace Rules for Google Antigravity

This file defines **exactly** which rule and workflow files to put in the repo so Antigravity's agent follows
SmartHealth's conventions, security rules and module boundaries. Copy each block below into the stated path
during Stage 0. Do not edit them casually: rule changes go through a PR reviewed by the Tech Lead and Security Lead.

## 0. How Antigravity loads these (verified against the Antigravity docs, Nov 2026)

| Mechanism | Location | Behaviour |
|-----------|----------|-----------|
| Root rules | `AGENTS.md` (repo root) | Always active, no frontmatter |
| Workspace rules | `.agents/rules/*.md` | **Must** start with YAML frontmatter `trigger:` = `always_on` \| `model_decision` \| `glob` \| `manual`. Missing or misspelled frontmatter (e.g. `alwaysOn`) → **silently discarded** |
| Glob rules | `trigger: glob` + `globs: "a/**/*.ts, b/**/*.tsx"` | Active when the agent touches matching files |
| Model-decision rules | `trigger: model_decision` + `description:` | The agent reads the rule when the task matches the description |
| Limits | 24,000 bytes per rule file; 20,000 tokens total for all `always_on` + global rules | Over budget → the largest files are demoted to pointers. **Keep always-on rules short** |
| Includes | `@[label](relative/path.md)` inside a rule inlines that file | Don't inline the large docs (role-02 is ~155 KB). Reference them by path instead |
| Workflows | `.agents/workflows/<name>.md` with frontmatter `description:` | Invoked as `/<name>`; `// turbo` above a step auto-runs that command |

> Older Antigravity builds used `.agent/` (singular). If rules don't appear under *Customizations → Rules*, check the folder name first.

Budget plan: `AGENTS.md` + three `always_on` rules ≈ 2,500 tokens. Everything else is `glob` or `model_decision`.

---

## 1. `AGENTS.md` (repo root)

```markdown
# SmartHealth — Agent Instructions

You are working in the SmartHealth monorepo (graduation project, 8-person team).
Vision: One Identity. One Medical Record. One Secure Healthcare System.

## Sources of truth (read before changing anything)
- Names (tables, enums, error codes, env vars): docs/00-INDEX.md — NEVER invent a name that is not there.
- Requirements & acceptance criteria: docs/01-PRD-AND-USER-STORIES.md
- Edge cases: docs/02-EDGE-CASES-AND-FAILURE-MODES.md
- API contracts: docs/03-API-CONTRACTS-AND-INTEGRATION.md and packages/contracts (generated OpenAPI wins on conflict)
- Role blueprints: docs/role-0X-*.md for the module you touch
- Current stage & allowed files: docs/ANTIGRAVITY-STAGES.md

## Working method
1. Start every task in Planning mode: produce an implementation plan listing files to create/modify, mapped to
   the current stage's "Exact Files" list. Stop and wait for approval if the plan touches files outside that list.
2. Implement in small, reviewable steps. After each step run the module's tests/linters.
3. Never mark a task done until the stage's Definition of Done items you touched are verified (run /verify-stage).
4. If documentation and code disagree, stop and report; do not silently "fix" the docs or the contract.
```

---

## 2. `.agents/rules/00-core.md`

```markdown
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
```

## 3. `.agents/rules/10-security.md`

```markdown
---
trigger: always_on
description: Non-negotiable security and privacy rules (healthcare data)
---
# Security rules (violations block merge)
1. Never bypass RBAC: every backend route declares `requirePermission(...)`; staff routes require aal2 and a verified licence.
2. Never bypass RLS: domain DB access ONLY through `withUserTx(auth, fn)`. Never use the Supabase secret/service key
   for user-initiated data access (allowed only in modules/admin, modules/auth signOut, scripts/seed-dev.ts).
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
```

## 4. `.agents/rules/15-boundaries.md`

```markdown
---
trigger: always_on
description: File-modification boundaries between modules and stages
---
# Boundaries
- Only modify files listed under the CURRENT stage in docs/ANTIGRAVITY-STAGES.md, plus their tests. Ask before touching others.
- Ownership (do not edit another module's internals to make your task work; open a contract change instead):
  supabase/** → Database · backend-api/** → Backend · ai-service/** → AI · web-admin/** → Web · mobile-app/** → Mobile ·
  packages/contracts/** → Backend Lead + consumer approval · design/tokens/** → UI/UX · .agents/**, AGENTS.md, docs/00-INDEX.md → Tech Lead.
- Never edit a merged migration in supabase/migrations; add a new timestamped migration.
- Never change a public API shape without updating packages/contracts (schemas + examples) in the same PR (/contract-change).
- Never add a dependency without stating why in the plan; prefer the stack in the role blueprint.
```

## 5. `.agents/rules/20-backend-typescript.md`

```markdown
---
trigger: glob
globs: "backend-api/**/*.ts, packages/contracts/**/*.ts"
description: Backend (Express 5 + TS + Zod + Kysely) conventions
---
# Backend conventions
- Layering: routes.ts → controller.ts (HTTP↔DTO only) → service.ts (rules, transactions) → repository.ts (Kysely only, receives tx).
  Controllers never import db/; repositories never import express.
- Middleware order is fixed (docs/role-03-backend.md §4). Per-route: requirePermission → requireStepUp? → rateLimit? → idempotency? → validate → controller.
- Errors: throw `new AppError('<ErrorCode from 00-INDEX §7>', {...})`; the error handler renders RFC 9457 problem+json. Never `res.status(...).json({error})` ad hoc.
- SQL: Kysely builder or `sql` tagged templates with parameters. Never string-concatenate SQL. Never `sql.raw` with user input.
- Map Postgres errors via `db/pg-errors.ts` (docs/role-02 §8). Retry once on 40P01/40001.
- IDs for rows with *_enc columns are generated in the backend (`randomUUID()`) before insert (AAD needs them).
- Idempotent routes (03 §2.7) use the `idempotency({required:true})` middleware AND persist the key in the DB unique column.
- Naming: files kebab-case; types/classes PascalCase; functions/vars camelCase; constants UPPER_SNAKE; DB/JSON fields snake_case.
- JSON API fields are snake_case exactly as in docs/03; convert at the mapper layer only.
- Tests: vitest; integration tests hit a real Postgres (Supabase local) with the DB test stub only for plain-Postgres CI.
- Logging: pino with the redaction config; log ids and codes, never values.
```

## 6. `.agents/rules/30-web-nextjs.md`

```markdown
---
trigger: glob
globs: "web-admin/**/*.ts, web-admin/**/*.tsx, web-admin/**/*.css"
description: Next.js 16 web portal conventions (doctor, pharmacist, admin)
---
# Web conventions
- Next.js 16 App Router. Use `proxy.ts` (NOT middleware.ts) only for locale + optimistic redirect; real authorization in
  role layouts via `requireRole()` (server) and in the backend.
- Data: Server Components fetch with `cache: 'no-store'` for PHI; client components use TanStack Query with keys from lib/api/query-keys.ts.
  Never copy server data into Zustand. Clear the query cache on logout and patient switch.
- API calls only through the typed openapi-fetch client (`useApi()` / `serverApi()`); never call Supabase tables from the browser.
- Forms: React Hook Form + zod resolvers using schemas from @smarthealth/contracts.
- Styling: Tailwind logical utilities only (ms/me/ps/pe/start/end/text-start/text-end). Banned: ml-, mr-, pl-, pr-, left-, right-, text-left, text-right.
- Colors/spacing from design tokens (CSS variables). No hard-coded hex in components.
- Components in components/<domain>/PascalCase.tsx; shadcn primitives only in components/ui (generated via CLI).
- Severity UI always = icon + text + colour (docs/role-07 §3.2). Blocking alerts use role="alert".
- No dangerouslySetInnerHTML. Render LLM/user text as plain text.
- Every page: loading, empty, error states; ar + en messages (next-intl strict, no missing keys).
```

## 7. `.agents/rules/40-mobile-flutter.md`

```markdown
---
trigger: glob
globs: "mobile-app/**/*.dart, mobile-app/**/*.arb, mobile-app/pubspec.yaml"
description: Flutter app conventions (patient, paramedic, pharmacist modes)
---
# Flutter conventions
- Feature-first clean architecture: features/<f>/{data,domain,presentation}. presentation → domain ← data.
  Widgets never call dio; providers call repositories/use cases.
- Riverpod with code generation (@riverpod). No global singletons except via providers. No setState for server data.
- Models: freezed + json_serializable; JSON keys snake_case via @JsonKey / fieldRename.
- Errors: map ProblemDetails → sealed ApiException in core/network; UI switches on `code`.
- Use EdgeInsetsDirectional/AlignmentDirectional/PositionedDirectional only (RTL). All strings from ARB (ar + en).
- Security: FLAG_SECURE on screens listed in docs/role-06 §7; secrets never in code; Hive boxes always encrypted
  (key from flutter_secure_storage); never cache other patients' data on staff devices; delete captured images after upload.
- Supabase SDK is used for Auth ONLY. All data via backend REST.
- local_auth/device key is for the user's OWN step-up; never present it as identifying another person.
- Emergency theme rules (docs/role-07 §3.1): ≥ 20 sp body, ≥ 64 dp targets, no light grey text.
- Lints: flutter analyze clean; avoid_print; prefer_const; no `dynamic` in domain/presentation.
```

## 8. `.agents/rules/50-ai-python.md`

```markdown
---
trigger: glob
globs: "ai-service/**/*.py, ai-service/pyproject.toml, packages/contracts/red-flags.yaml"
description: FastAPI AI service conventions (face, clinical rules, assistant)
---
# AI service conventions
- Python 3.12, FastAPI, Pydantic v2 (strict models mirroring docs/03 §13), mypy --strict, ruff.
- Every router depends on `require_internal` + `require_scope(...)`. The service is never exposed publicly.
- Face: images in memory only; no disk writes; never log/return raw embeddings; templates returned only AFTER the keyed
  orthogonal transform (app/face/transform.py). Model files verified by SHA256 at startup.
- Thresholds/config from pydantic-settings env; never hard-code.
- Clinical engine is deterministic over ref.* data; deterministic alert_key formats (docs/role-04 §3.4); highest severity wins.
- Assistant: red-flag rules run BEFORE the LLM; final triage = max(rule, llm); validator (docs/role-04 §5.6) is mandatory;
  user text only inside <user_message> delimiters; PII scrubbed before any provider call; temperature ≤ 0.3.
- Tests: pytest; red-flag recall must be 100% on the fixture suite; contract tests against packages/contracts/examples/internal.
```

## 9. `.agents/rules/60-database.md`

```markdown
---
trigger: glob
globs: "supabase/**/*.sql, supabase/config.toml"
description: Postgres/Supabase migration, RLS and function conventions
---
# Database conventions
- New migration file per change: supabase/migrations/<YYYYMMDDHHMMSS>_<snake_desc>.sql. Never edit merged migrations.
- Every table in `app` has RLS enabled + forced, with explicit allow policies per role and WITH CHECK pinning the actor column.
- SECURITY DEFINER functions only in `private`/`audit`, always `set search_path = ''`, fully-qualified names,
  explicit role checks inside, explicit `grant execute ... to authenticated`.
- Use `(select auth.uid())` in policies. Derived columns (status, quantity_dispensed) are never client-updatable.
- Enum values and names exactly as docs/00-INDEX §5.2. Ref severities are text + CHECK.
- No seed data in migrations. Reference data in supabase/seed/01_reference.sql only.
- Every new policy/function gets an allow AND deny test in supabase/tests.
- Never expose app/ref/biometric/audit/private schemas in the Data API.
```

## 10. `.agents/rules/70-contracts.md`

```markdown
---
trigger: model_decision
description: Use when adding or changing any API endpoint, request/response field, error code, or internal AI payload
---
# Contract change protocol
1. Edit Zod schemas in packages/contracts/src/schemas/* first (snake_case fields, .strict()).
2. Add/update examples in packages/contracts/examples/** (request + every documented response/error).
3. Run `pnpm contracts:openapi` and commit the regenerated YAML; run `pnpm contracts:check` (oasdiff breaking).
4. Update docs/03-API-CONTRACTS-AND-INTEGRATION.md in the same PR.
5. New error codes must be added to docs/00-INDEX.md §7 and packages/contracts/src/errors.ts.
6. Breaking change in /v1 is not allowed; add a new optional field or a new endpoint instead.
7. Notify consumers: tag the Web/Mobile/AI owners in the PR.
```

## 11. `.agents/rules/80-git.md`

```markdown
---
trigger: model_decision
description: Use when creating branches, commits, or pull requests
---
# Git workflow
- Branches: `main` (protected, deployable), short-lived feature branches from main:
  `feat/s<stage>-<area>-<short-desc>`, `fix/<area>-<desc>`, `chore/<desc>`, `docs/<desc>`. Example: feat/s4-pharmacy-dispense-engine.
- Conventional Commits: `feat(pharmacy): add idempotent dispense endpoint`, `fix(db): ...`, `test(...)`, `docs(...)`, `chore(...)`.
  Reference IDs in the body: `Refs: US-12, E-RX-02`.
- One stage area per PR; ≤ ~400 changed lines where possible; PR template sections: Summary, Stories/Edge cases, Files, Tests, Security impact, Screenshots.
- Never commit .env*, keys, *.pem, model weights, or patient-like data. gitleaks runs in pre-commit and CI.
- Rebase on main before merge; squash-merge; CI must be green; CODEOWNERS approvals required (security-labelled PRs need the Security Lead).
- Tag stage completions: `stage-0-done` ... `stage-7-done`.
```

---

## 12. Workflows (`.agents/workflows/`)

### 12.1 `.agents/workflows/verify-stage.md`
```markdown
---
description: Run all checks for the current stage and report Definition of Done status
---
1. Read docs/ANTIGRAVITY-STAGES.md and identify the current stage (ask if unclear).
// turbo
2. Run `pnpm -r lint && pnpm -r typecheck`
// turbo
3. Run `pnpm -r test`
4. If supabase/ changed: run `supabase db reset` then `pnpm db:test`.
5. If ai-service/ changed: run `cd ai-service && uv run ruff check . && uv run mypy app && uv run pytest`.
6. If mobile-app/ changed: run `cd mobile-app && flutter analyze && flutter test`.
7. Run `pnpm contracts:check` and `gitleaks detect --no-banner`.
8. Produce a table of every DoD item of the stage with ✅/❌ and evidence (command output or file path). Do not claim ✅ without evidence.
```

### 12.2 `.agents/workflows/new-endpoint.md`
```markdown
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
```

### 12.3 `.agents/workflows/db-migration.md`
```markdown
---
description: Create a new database migration with RLS and tests
---
1. Create supabase/migrations/<timestamp>_<desc>.sql (never edit old ones).
2. Follow .agents/rules/60-database.md; include RLS, grants, comments.
3. Add allow + deny tests to supabase/tests.
// turbo
4. Run `supabase db reset && pnpm db:test`
5. Regenerate Kysely types: `pnpm --filter backend-api db:types` and commit.
```

### 12.4 `.agents/workflows/contract-change.md`
```markdown
---
description: Safely change an API contract (schemas, examples, OpenAPI, docs)
---
1. Follow .agents/rules/70-contracts.md steps 1–7 exactly.
// turbo
2. Run `pnpm contracts:openapi && pnpm contracts:check`
3. List impacted consumers (web/mobile/ai) and the files they must update.
```

### 12.5 `.agents/workflows/security-review.md`
```markdown
---
description: Self-review a change against the SmartHealth security checklist before opening a PR
---
1. For each changed route: permission declared? aal2/licence for staff? 404 on foreign ids? audit on sensitive reads?
2. For each changed table/function: RLS + WITH CHECK? search_path=''? grants explicit? tests for deny?
3. Grep the diff for: console.log, print(, sql.raw, service key usage, *_enc written without encryptField, PHI in logs.
// turbo
4. Run `gitleaks detect --no-banner && pnpm -r lint`
5. Output findings as a table (file, line, issue, fix) and fix them before finishing.
```

---

## 13. Naming Conventions (summary)

| Item | Convention | Example |
|------|-----------|---------|
| DB schema/table/column | snake_case, plural tables | `app.prescription_items.quantity_dispensed` |
| Enum values | snake_case | `partially_dispensed` |
| API paths | kebab-case nouns, `/v1` prefix | `/v1/pharmacy/prescriptions/{id}/dispensations` |
| JSON fields | snake_case | `quantity_remaining` |
| Error codes | UPPER_SNAKE with area prefix | `RX_QUANTITY_EXCEEDED` |
| Audit actions | UPPER_SNAKE verb-ish | `EMERGENCY_PROFILE_READ` |
| TS files | kebab-case | `dispense.service.ts` |
| React components | PascalCase file + export | `SafetyAlertBanner.tsx` |
| Dart files | snake_case | `step_up_service.dart` |
| Dart classes | PascalCase | `StepUpService` |
| Python modules | snake_case | `red_flags.py` |
| Env vars | UPPER_SNAKE | `FACE_MATCH_ACCEPT` |
| Branches | `feat/s<stage>-<area>-<desc>` | `feat/s3-ai-liveness` |
| i18n keys | dot.case by feature | `rx.overrideRequired` |

## 14. Typing Rules (summary)

| Language | Rules |
|----------|-------|
| TypeScript | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any`/`as unknown as`; Zod-inferred types for DTOs; branded types for IDs (`PatientId`, `PrescriptionId`) in services |
| Dart | sound null safety; `freezed` unions for states; no `dynamic` outside JSON parsing; `sealed` classes for errors/results |
| Python | `mypy --strict`; Pydantic models at boundaries; `numpy.typing.NDArray[np.float32]` for vectors; no implicit `Optional` |
| SQL | explicit types on function params/returns; enums instead of free text where a closed set exists |
