# ANTIGRAVITY-STAGES — Staged Implementation Roadmap (Stage 0 → Stage 7)

Each stage is **atomic**: it ends with a green `/verify-stage`, a tag (`stage-N-done`) and a short demo.
The Antigravity prompts are ready to paste into the Agent panel (Planning mode). They reference files with `@path`.
Rules from `ANTIGRAVITY-RULES.md` must already be installed (Stage 0) for the prompts to behave as intended.

## Timeline (suggested; adjust to the faculty calendar)

Stages are sequential **for the Antigravity build of each module**, but people work in parallel. UI/UX design runs from
week 1, and AI model calibration starts as soon as Stage 3's skeleton exists.

| Week (from 1 Dec 2026) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S0 Monorepo & rules | ■ | | | | | | | | | | | | | | | | | | | |
| S1 Database | | ■ | ■ | | | | | | | | | | | | | | | | | |
| S2 Security + backend core | | | | ■ | ■ | ■ | | | | | | | | | | | | | | |
| S3 AI service | | | | ■ | ■ | ■ | ■ | | | | | | | | | | | | | |
| S4 Rx/pharmacy/emergency engine | | | | | | | ■ | ■ | ■ | | | | | | | | | | | |
| S5 Web | | | | | | ■ | ■ | ■ | ■ | ■ | ■ | | | | | | | | | |
| S6 Mobile | | | | | | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | | | | | | | |
| S7 E2E, pentest, deploy | | | | | | | | | | | | | ■ | ■ | ■ | ■ | | | | |
| Buffer / thesis / rehearsal | | | | | | | | | | | | | | | | | ■ | ■ | ■ | ■ |
| UI/UX design (continuous) | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | | | | | | | |

Stages 5 and 6 begin against **mocked API** (MSW / Dio mock adapter built from `packages/contracts/examples`) and switch to the staging backend when Stage 4 lands.

---

## Stage 0 — Monorepo Setup, Env Templates, Linters & Antigravity Rules

**Goal:** a monorepo that builds, lints and tests (empty) on CI, with Antigravity rules, contracts package, and env templates. No business logic yet.
**Owners:** Tech Lead (rotating) + Security Lead · **Duration:** 1 week

**Prerequisites:** GitHub repo `Peter-Eshak-Abdo/smart-healthcare-system`; Node 22, pnpm 9, Python 3.12 + uv, Flutter stable, Supabase CLI, Docker; a Supabase project (staging) created; team members added; Antigravity installed.

**Exact files to create/modify**
```text
AGENTS.md
.agents/rules/{00-core,10-security,15-boundaries,20-backend-typescript,30-web-nextjs,40-mobile-flutter,50-ai-python,60-database,70-contracts,80-git}.md
.agents/workflows/{verify-stage,new-endpoint,db-migration,contract-change,security-review}.md
docs/**                                   (this documentation set; move old root *.md into docs/legacy/)
README.md                                 (update structure + quick start)
package.json  pnpm-workspace.yaml  turbo.json (or plain pnpm -r scripts)  .nvmrc  .editorconfig  .gitignore  .gitattributes
.github/workflows/ci.yml                  (jobs: node, python, flutter, db, contracts, gitleaks)
.github/CODEOWNERS  .github/pull_request_template.md  .github/dependabot.yml
.gitleaks.toml  .pre-commit-config.yaml (or lefthook.yml)
infra/docker-compose.yml                  (redis; optional ai-service + backend containers)
packages/contracts/{package.json,tsconfig.json,src/index.ts,src/errors.ts,src/schemas/common.ts,scripts/openapi.ts,examples/.gitkeep,red-flags.yaml}
backend-api/{package.json,tsconfig.json,vitest.config.ts,eslint.config.js,.env.example,src/main.ts,src/app.ts,src/config/env.ts,src/modules/system/routes.ts,test/health.test.ts,Dockerfile}
ai-service/{pyproject.toml,.env.example,app/main.py,app/config.py,app/routers/health.py,tests/test_health.py,Dockerfile}
web-admin/   (create-next-app 16 + Tailwind v4 + shadcn init + next-intl skeleton; .env.example; proxy.ts stub)
mobile-app/  (flutter create --org app.smarthealth --platforms android,ios; pubspec deps from role-06 §2; l10n.yaml; analysis_options.yaml)
supabase/{config.toml,migrations/.gitkeep,seed/.gitkeep,tests/.gitkeep}
design/tokens/tokens.json                 (initial from role-07 §3)
```

**Antigravity prompt**
```text
You are setting up Stage 0 of SmartHealth. Read @AGENTS.md, @docs/00-INDEX.md (§3 layout, §8 env vars),
@docs/ANTIGRAVITY-RULES.md and @docs/ANTIGRAVITY-STAGES.md (Stage 0 only).

Produce an implementation plan first, listing every file from "Exact files to create/modify" for Stage 0, and wait for my approval.

Then:
1. Create AGENTS.md, every .agents/rules/*.md and .agents/workflows/*.md EXACTLY as written in docs/ANTIGRAVITY-RULES.md
   (keep the YAML frontmatter byte-for-byte; trigger values must be snake_case).
2. Create the pnpm workspace (packages/contracts, backend-api, web-admin) with TypeScript strict configs, ESLint (flat config)
   including the banned-RTL-utilities rule for web-admin and a no-restricted-imports rule that forbids importing
   src/integrations/supabase-admin.ts outside modules/admin, modules/auth and scripts.
3. backend-api: Express 5 skeleton with zod-validated env (docs/role-03 §10, values from process.env only),
   GET /v1/health returning {status, version, commit}, vitest test for it, multi-stage non-root Dockerfile.
4. ai-service: FastAPI skeleton (Python 3.12, uv, ruff, mypy --strict, pytest) with GET /internal/v1/health and a test.
5. web-admin: Next.js 16 App Router + Tailwind v4 + shadcn/ui init + next-intl with [locale] (ar default, en) and dir=rtl for ar;
   proxy.ts that only handles locale. Home page shows "SmartHealth" in both languages.
6. mobile-app: Flutter project with the dependencies from docs/role-06 §2 (pin current stable versions), ARB files ar/en,
   MaterialApp.router with locale switching and Directionality, a placeholder screen, analysis_options with avoid_print.
7. packages/contracts: zod + @asteasolutions/zod-to-openapi; ErrorCode enum with ALL codes from docs/00-INDEX §7;
   ProblemDetails schema; script `pnpm contracts:openapi` that writes openapi/smarthealth.v1.yaml; script `contracts:check`.
   Copy the red-flag YAML from docs/role-04 §5.3 into packages/contracts/red-flags.yaml.
8. .env.example files listing ONLY variable names from docs/00-INDEX §8 (no values). .gitignore must exclude .env*, *.pem, ai-service/models/*.onnx.
9. CI (.github/workflows/ci.yml): node (lint, typecheck, test), python (ruff, mypy, pytest), flutter (analyze, test),
   contracts (openapi regenerate + git diff --exit-code), gitleaks. Cache dependencies.
10. CODEOWNERS per docs/role-01 §12; PR template per .agents/rules/80-git.md; dependabot for npm, pip, pub, github-actions.
Run /verify-stage at the end and show the DoD table.
```

**Definition of Done**
- [ ] `pnpm -r lint && pnpm -r typecheck && pnpm -r test` green locally and in CI.
- [ ] `cd ai-service && uv run pytest` green; `cd mobile-app && flutter analyze && flutter test` green.
- [ ] *Customizations → Rules* in Antigravity lists all 10 rules (proves frontmatter is valid); `/verify-stage` is available.
- [ ] `gitleaks detect` clean; no `.env` committed; `.env.example` files contain names only.
- [ ] `pnpm contracts:openapi` produces a YAML with the ProblemDetails schema and all error codes.
- [ ] Web shows Arabic RTL by default and English LTR at `/en`.
- [ ] Tag `stage-0-done`.

---

## Stage 1 — Database Schema, pgvector, pgcrypto, RLS Policies & Seed Data

**Goal:** the complete Supabase database from `role-02`, passing tests T01–T25, deployed to the staging project.
**Owners:** Database Engineer (+ Security Lead review) · **Duration:** 2 weeks

**Prerequisites:** Stage 0 done; Supabase CLI logged in; staging project ref; the DB engineer has read role-02 fully.

**Exact files to create/modify**
```text
supabase/config.toml                                    (auth.jwt_expiry=900, refresh rotation, enable_signup, mfa totp)
supabase/migrations/20261201000001_extensions_and_schemas.sql
supabase/migrations/20261201000002_enums_and_reference.sql
supabase/migrations/20261201000003_core_tables.sql
supabase/migrations/20261201000004_functions_and_triggers.sql
supabase/migrations/20261201000005_rls_policies.sql
supabase/migrations/20261201000006_secure_functions.sql
supabase/migrations/20261201000007_jobs.sql
supabase/seed/01_reference.sql   supabase/seed/README.md
supabase/tests/{00_supabase_stub.sql,01_setup.sql,02_patient_doctor_pharmacy.sql,03_race_partial.sql,03_race_one.sql,04_emergency_biometric_audit.sql}
supabase/tests/run.sh                                   (plain-Postgres CI runner incl. the parallel race)
package.json                                            (scripts: db:reset, db:test)
.github/workflows/ci.yml                                (add "db" job: postgres:16 + pgvector service, run tests/run.sh)
```

**Antigravity prompt**
```text
Stage 1 — Database. Read @docs/00-INDEX.md §5 and @docs/role-02-database.md (all sections). The SQL in role-02 §6 and §7.1
has already been executed and tested; treat it as authoritative.

Plan first, then:
1. Create the 7 migration files with EXACTLY the SQL from role-02 §6.1–§6.7 (same order; timestamps as listed in Stage 1 files).
   Do not "improve" the SQL. If you believe something is wrong, stop and report instead.
2. Create supabase/seed/01_reference.sql from role-02 §7.1 and seed/README.md from §7.2–§7.3.
3. Create the test scripts from role-02 §9 (stub, setup, flows, race) so that each assertion T01–T25 in §9.2 raises an
   exception on failure (convert the observed-result checks into `do $$ ... raise exception ... $$` assertions).
   tests/run.sh: creates a fresh database, applies stub + migrations + seed, runs setup + flows, runs 03_race_one.sql twice
   in parallel and asserts exactly one success, then runs 04.
4. Add a CI job "db" using the pgvector/pgvector:pg16 image that runs tests/run.sh.
5. Update supabase/config.toml auth settings per role-01 §5.1 where the CLI supports them; list the remaining
   Dashboard-only settings in seed/README.md as a checklist.
Then run: `supabase db reset` locally and `bash supabase/tests/run.sh` against a local Postgres, and show the output.
Finish with /verify-stage.
```

**Definition of Done**
- [ ] `supabase db reset` succeeds from zero; `tests/run.sh` green locally and in CI (T01–T25 incl. race).
- [ ] Staging project migrated (`supabase db push`); Data API exposed schemas = `public` only.
- [ ] Custom Access Token Hook enabled on staging; asymmetric JWT signing key active; JWT expiry 900 s.
- [ ] pg_cron jobs scheduled on staging (role-02 §6.7).
- [ ] Security Lead signed off on every policy and definer function (PR approval).
- [ ] Tag `stage-1-done`.

---

## Stage 2 — Security Layer & Backend Core (Auth, RBAC, Audit, Patient/Doctor APIs)

**Goal:** a production-shaped backend with the full middleware pipeline, crypto, step-up, rate limiting and audit, plus the Patient, Access, Doctor, Ref, Me and Admin modules.
**Owners:** Backend A + Security Lead · **Duration:** 3 weeks

**Prerequisites:** Stage 1 deployed to staging; dev keys generated (`pnpm keys:dev`); Redis running (docker compose).

**Exact files to create/modify**
```text
packages/contracts/src/schemas/{auth,me,patients,access,doctor,ref,admin,biometric}.ts
packages/contracts/examples/{auth,me,patients,access,doctor,ref,admin}/**.json
backend-api/src/config/env.ts
backend-api/src/db/{pool,kysely,types.gen,with-user-tx,pg-errors}.ts
backend-api/src/security/{jwt,auth-context,permissions,step-up,internal-jwt}.ts
backend-api/src/security/crypto/{keyring,field-cipher,signer,jcs}.ts
backend-api/src/middleware/{request-id,security-headers,client-version,authenticate,require,step-up,rate-limit,idempotency,validate,audit,error-handler}.ts
backend-api/src/shared/{errors,pagination,time,phone}.ts
backend-api/src/integrations/{supabase-admin,notifier}.ts
backend-api/src/modules/{auth,me,patients,access,doctor,ref,admin,system,biometrics}/**   (biometrics: routes only, AI call stubbed until Stage 3)
backend-api/src/workers/outbox.ts
backend-api/scripts/{keys-dev,seed-dev,crypto-rewrap}.ts
backend-api/test/{helpers/**,unit/**,integration/**}
```

**Antigravity prompt**
```text
Stage 2 — Security layer & backend core. Read @docs/role-03-backend.md (§1–§5, §6.1–§6.2, §8–§12), @docs/role-01-super-security.md
(§4, §5, §6.2–§6.4, §8, §9), @docs/03-API-CONTRACTS-AND-INTEGRATION.md (§2–§6, §11–§12) and @docs/role-02-database.md §5 and §8.

Plan first (list files and endpoints), wait for approval, then implement in this order, running tests after each step:
1. Contracts: Zod schemas + examples for every endpoint in docs/03 §3–§6, §11, §12 (strict objects, snake_case).
2. Config, pg pool (+ reserved emergency pool), Kysely + `kysely-codegen` types, withUserTx exactly as role-03 §5, pg-errors mapping per role-02 §8.
3. Security: JWKS verification (jose, ES256, issuer/audience, 60 s leeway), AuthContext with Redis 30 s cache + invalidate(),
   permissions.ts exactly as role-01 §4, field-cipher exactly as role-01 §6.3 (with AAD), Ed25519 signer + JCS, step-up per role-01 §5.3,
   internal JWT signer.
4. Middleware pipeline in the exact order of role-03 §4 with RFC 9457 error handler; rate-limit buckets from role-01 §8 with in-memory insurance limiter.
5. Modules: auth (devices, step-up, logout-all), me, patients (onboarding with Egyptian national ID validation, critical info, allergies,
   blood type, history, encounters, visibility, prescriptions READ endpoints, emergency contacts, emergency card signing), access (share codes,
   grants, access log), doctor (redeem, search, summary, history, encounters, addenda, entered-in-error, diagnoses, allergies, blood type),
   ref (drugs incl. `equivalent_to` filter, icd10, allergens, specialties), admin (users, invite, status, role with two-person approval,
   licence, facilities, audit search/export/integrity, emergency review, metrics), system (health, ready, well-known JWKS, mobile config).
6. Audit events from role-01 §9.3 on every sensitive read; never log PHI.
7. scripts/seed-dev.ts per role-03 §11 (refuses production).
8. Tests: unit (cipher round-trip + AAD tamper, national ID validator, permissions snapshot), integration for every endpoint incl.
   BOLA matrix (foreign ids → 404), mass-assignment (extra fields → 422), suspended user ≤ 30 s, logout-all, MFA required for staff,
   and a router-walk test asserting every /v1 route (except system) has requirePermission.
Finish with /security-review and /verify-stage.
```

**Definition of Done**
- [ ] All Stage 2 endpoints implemented and contract-tested; OpenAPI regenerated.
- [ ] Coverage ≥ 80% on `security/*` and implemented services.
- [ ] Penetration checks P1–P5 (role-01 §11.2) pass on staging.
- [ ] `seed-dev` creates all dev accounts; Dr. Karim can redeem Mona's share code and read her summary on staging.
- [ ] Logs from the integration run contain no PHI (CI grep test).
- [ ] Tag `stage-2-done`.

---

## Stage 3 — AI Microservice (Face Recognition + Liveness + Drug Alerts + Medical Assistant)

**Goal:** `ai-service` implementing `03 §13` with calibrated face thresholds, PAD, the deterministic clinical engine, and the safe assistant pipeline, all wired to the backend's biometric and check endpoints.
**Owners:** AI/ML Engineer (+ Backend B for wiring) · **Duration:** 4 weeks (overlaps Stage 2)

**Prerequisites:** Stage 1 (ref data) done; `ai_ref_reader` password set; internal JWT keys; model files downloaded with SHA256SUMS; team-consented calibration photos collected (Mobile helps capture).

**Exact files to create/modify**
```text
ai-service/app/{main,config,security,logging,concurrency}.py
ai-service/app/schemas/{face,clinical,assistant,common}.py
ai-service/app/face/{decode,detector,quality,liveness,align,embedder,transform,pipeline}.py
ai-service/app/clinical/{refdata,engine,i18n}.py
ai-service/app/assistant/{normalize,pii,red_flags,llm,prompts,validator,specialty_mapper,pipeline}.py
ai-service/app/assistant/templates/{ar,en}/*.md
ai-service/app/routers/{face,clinical,assistant,fingerprint,health}.py
ai-service/scripts/{import_ddinter,calibrate_face,eval_pad,rekey_templates,eval_assistant}.py
ai-service/scripts/mappings/ddinter_to_ingredient.csv
ai-service/models/SHA256SUMS                              (weights themselves are NOT committed)
ai-service/tests/{face,clinical,assistant,contract}/**
packages/contracts/examples/internal/**.json
packages/contracts/red-flags.yaml                          (extend fixtures)
backend-api/src/integrations/ai-client.ts
backend-api/src/modules/biometrics/**                       (enrol, delete, challenge — now calling AI)
backend-api/src/modules/prescriptions/safety.ts             (check orchestration only; issue comes in Stage 4)
backend-api/src/modules/prescriptions/routes.ts             (POST /v1/prescriptions/check)
docs/test-evidence/ai/{face-calibration.md,pad-report.md,assistant-eval.md,interaction-golden.md}
```

**Antigravity prompt**
```text
Stage 3 — AI microservice. Read @docs/role-04-ai-ml.md (entire), @docs/03-API-CONTRACTS-AND-INTEGRATION.md §13 and §7.1,
@docs/role-01-super-security.md §6.5 and §2.4 (S3, I5, I6, D2), and @docs/02-EDGE-CASES-AND-FAILURE-MODES.md sections 1 and 6.

Plan first, wait for approval, then:
1. Internal auth dependency (EdDSA, aud=ai-service, exp, jti replay cache) and scopes; priority executors per role-04 §2.3.
2. Face pipeline exactly per role-04 §4.1–§4.5 and §4.8 with ONNX Runtime; model SHA256 verification at startup; no disk writes;
   never return raw embeddings (only transformed). Unit tests: transform preserves cosine (|Δ| < 1e-5), rekey math, quality hints,
   multi-face selection, challenge verification logic (blink/turn/smile), passive-only mode.
3. Clinical engine per role-04 §3 with in-memory snapshot refresh; golden tests for EVERY seed rule in role-02 §7.1 and the
   allergy/duplicate/condition cases in role-04 §3.7. DDInter importer per §3.6 (dry-run mode prints mapping coverage).
4. Assistant pipeline per role-04 §5 (normalise → PII scrub → red flags → LLM adapter (JSON mode) → validator → assembly) with
   the system prompt from §5.4 verbatim and the fallback templates. CI uses a mock LLM; add a nightly job flag for the real provider.
   Evaluation suites per §5.9 with fixtures in AR (MSA + Egyptian), EN and Franco-Arabic.
5. Fingerprint router returning 501 FEATURE_NOT_IMPLEMENTED.
6. Contract tests using packages/contracts/examples/internal/**.
7. Backend wiring: ai-client.ts with circuit breakers (role-03 §7); biometrics enrol/delete/challenge endpoints (03 §5 Biometrics)
   using private.face_duplicate_exists + private.enroll_face_template; POST /v1/prescriptions/check (03 §7.1) with
   checks_status=unavailable fallback.
8. Scripts calibrate_face.py and eval_pad.py producing markdown reports into docs/test-evidence/ai/.
Finish with /verify-stage.
```

**Definition of Done**
- [ ] ai-service tests green; mypy strict + ruff clean; contract tests green.
- [ ] Calibration report committed with chosen `FACE_MATCH_ACCEPT/POSSIBLE/MARGIN` (FAR ≤ 1e-4 at accept) and env defaults updated if needed.
- [ ] PAD report committed (APCER/BPCER per attack type), meeting role-04 §4.7 targets or documenting the gap.
- [ ] Red-flag recall 100%; jailbreak suite 0 escapes; interaction golden tests 100%.
- [ ] Patient can enrol a face via the API on staging (with consent); duplicate detection works; deletion works.
- [ ] `/v1/prescriptions/check` returns the warfarin+aspirin `major` and penicillin `contraindicated` alerts for Mona.
- [ ] Tag `stage-3-done`.

---

## Stage 4 — E-Prescription & Pharmacy Transactional Engine + Emergency API

**Goal:** prescription issue/cancel with signatures and overrides; pharmacy verify/lease/dispense with locking and idempotency; pickup tokens; emergency identify/session/profile/contacts/card/offline events; assistant proxy.
**Owners:** Backend B (+ Security Lead review) · **Duration:** 3 weeks

**Prerequisites:** Stages 2 and 3 done; signing keys configured on staging.

**Exact files to create/modify**
```text
packages/contracts/src/schemas/{prescriptions,pharmacy,emergency,assistant}.ts + examples/**
backend-api/src/modules/prescriptions/{routes,controller,service,repository,signing,safety,mappers}.ts
backend-api/src/modules/patients/pickup-tokens.ts           (POST /v1/patients/me/prescriptions/{id}/pickup-tokens)
backend-api/src/modules/pharmacy/{routes,controller,verify.service,dispense.service,presence,repository,mappers}.ts
backend-api/src/modules/emergency/{routes,controller,identify.service,card.service,session.service,repository,mappers}.ts
backend-api/src/modules/assistant/{routes,controller,service,red-flags,repository}.ts
backend-api/src/modules/system/routes.ts                    (rx-jwks, emergency-card-jwks)
backend-api/test/integration/{prescriptions,pharmacy,emergency,assistant}/**
backend-api/test/load/{dispense-race.k6.js,emergency-identify.k6.js}
```

**Antigravity prompt**
```text
Stage 4 — Prescription, pharmacy and emergency engine. Read @docs/role-03-backend.md §6.3–§6.7, §7–§9,
@docs/03-API-CONTRACTS-AND-INTEGRATION.md §5 (pickup tokens, emergency card), §7, §8, §9, §10, §14,
@docs/02-EDGE-CASES-AND-FAILURE-MODES.md sections 2, 3, 4, 5, @docs/role-02-database.md §6.4, §6.6, §8,
and @docs/role-01-super-security.md §6.4.

Plan first, wait for approval, then implement:
1. Prescription issue exactly per role-03 §6.3: authoritative re-check, override validation (≥15 chars, ≥3 words), controlled-drug
   rules, Argon2id paper code, JCS canonical payload (03 §7.5) signed with Ed25519 BEFORE commit, alerts persisted, audit events.
   Cancel (items → cancelled; prescription status derived by DB triggers). GET doctor prescriptions.
2. Pickup tokens (EdDSA JWS, 10 min, single-use jti) behind step-up purpose=pickup_token. Rx JWKS endpoint.
3. Pharmacy verify per role-03 §6.4 (pickup_token | rx_code + sms_otp | face_1to1), payload re-verification from DB rows
   (mismatch → RX_SIGNATURE_INVALID + critical alert), open_pharmacy_context, minimal patient view, soft lease.
4. Dispense per role-03 §6.5: FOR UPDATE lock order (header, then items by id), validation under lock, idempotency (Redis + DB unique),
   pickup jti single-use, substitution equivalence, controlled rules, outbox notification, audit. Map 23514 → RX_QUANTITY_EXCEEDED.
5. Emergency per role-03 §6.6: identify (passive liveness, match_face, decideMatch with env thresholds, candidate tokens for
   possible_match in Redis 120 s, confirm endpoint), identify/card (verify card JWS), identify/manual (blind index), session
   profile/contacts via private.* only with STRICT response schemas, extend, close, offline-events (verify device signatures),
   emergency pool, emergency rate-limit buckets, patient notification.
6. Assistant proxy per role-03 §6.7 with the local red-flag fallback when AI is down.
7. Tests: every AC of US-08, US-10..US-18, EXT-01..EXT-04 and edge cases E-RX-01..E-RX-13, E-CLIN-01..05, E-LIC-01..04, E-BIO-01..04, E-BIO-12,
   E-NET-02, E-NET-04, E-PRIV-01..02; a 20-parallel dispense race test asserting exactly one 201; k6 scripts.
Finish with /security-review and /verify-stage.
```

**Definition of Done**
- [ ] Race: 20 parallel dispense requests → exactly 1 × `201`, remaining = 0, no 500s.
- [ ] Tampered DB row → `RX_SIGNATURE_INVALID`; forged QR → `422`; replayed pickup token → `401`.
- [ ] Emergency profile strict schema test fails if any extra field is added (proved by a negative test).
- [ ] Licence revoke → open prescriptions return `prescriber_invalid`; suspend → still dispensable with banner flag.
- [ ] AI down → identify returns `503` + fallbacks; check returns `unavailable`; assistant returns the fallback text or red-flag response.
- [ ] Tag `stage-4-done`.

---

## Stage 5 — Web Frontend (Next.js Doctor, Pharmacist, Admin Portals)

**Goal:** all web screens from role-05/07 implemented against staging (mock first), bilingual, accessible, E2E-tested.
**Owners:** Web Engineer (+ UI/UX visual QA) · **Duration:** 6 weeks (starts on mocks during Stage 3)

**Prerequisites:** Stage 2 contracts available (mocks); Figma frames for D-*, F-*, A-* screens; tokens.json.

**Exact files to create/modify**
```text
web-admin/next.config.ts  web-admin/proxy.ts  web-admin/i18n/**  web-admin/app/globals.css (tokens)
web-admin/app/[locale]/**                       (every route in role-05 §3)
web-admin/components/{shell,patient,prescription,pharmacy,admin,common}/**
web-admin/lib/{supabase,api,auth,hooks,format}/**
web-admin/stores/rx-builder.store.ts
web-admin/mocks/**                              (MSW handlers from packages/contracts/examples)
web-admin/tests/{components,e2e}/**
web-admin/playwright.config.ts
```

**Antigravity prompt**
```text
Stage 5 — Web portals. Read @docs/role-05-frontend-web.md (entire), @docs/role-07-ui-ux.md (§3–§7, §8.2–§8.3, §9),
@docs/03-API-CONTRACTS-AND-INTEGRATION.md (§2, §4, §6–§8, §11) and the US/EXT stories for doctor, pharmacist and admin in
@docs/01-PRD-AND-USER-STORIES.md.

Plan first (routes, components, data hooks), wait for approval, then implement in slices, each with tests:
1. Shell: tokens → CSS variables, fonts (IBM Plex Sans Arabic + Inter), AppShell/Sidebar/TopBar, locale switch, RTL rules,
   SessionTimeoutDialog, ProblemAlert, MSW mocks from packages/contracts/examples (toggle via NEXT_PUBLIC_API_MOCKS=1).
2. Auth: login, TOTP enroll/verify, requireRole server guards, ReauthDialog on AUTH_STEP_UP_REQUIRED, not-authorized page.
3. Doctor: dashboard, redeem share code, patient search, PatientHeader + CriticalInfoBanner, summary/history/encounter
   (If-Match versioning, addenda, entered-in-error), diagnoses ICD combobox, allergy verify/code.
4. Prescription builder exactly per role-05 §7.3: debounced live check, SafetyAlertBanner severities, OverrideDialog validation,
   ManualReviewAttestation, SignAndIssueBar with idempotency key reuse, RxSummaryCard with one-time paper code, print view §7.6.
5. Pharmacist: QR scan with local JWS pre-check (cached rx-jwks), manual entry + SMS/face presence, VerificationResult states,
   lease banner, DispenseTable (partial, substitution, batch/expiry), race and offline UX.
6. Admin: KPIs, users (suspend/role/two-person), invite, licence panel with revoke impact, facilities, audit search/export +
   ChainIntegrityBadge, emergency review queue, security flags.
7. Tests: component tests for alert/override/dispense logic; Playwright E2E for US-08 (with override), US-10/11/12 (partial),
   US-21 (invite→verify licence→login with TOTP), and a two-context dispense race; axe checks on every page; ar+en screenshots.
Switch from mocks to staging at the end and run the E2E suite against staging. Finish with /verify-stage.
```

**Definition of Done**
- [ ] role-05 §12 checklist complete.
- [ ] Playwright suite green on staging in `ar` and `en`; axe 0 serious/critical.
- [ ] UI/UX visual QA sign-off.
- [ ] Tag `stage-5-done`.

---

## Stage 6 — Mobile App (Flutter Patient, Paramedic Emergency, Pharmacist Modes)

**Goal:** the Flutter app per role-06/07 on physical Android (and iOS if available), with offline emergency card, step-up, face capture, chatbot and pharmacy flows.
**Owners:** Mobile Engineer (+ UI/UX, + AI for capture tuning) · **Duration:** 8 weeks (starts on mocks during Stage 3)

**Prerequisites:** contracts for all mobile endpoints; Figma P-*, E-*, F-* frames; ML Kit capture spec (role-04 §4.5); staging backend for the final weeks.

**Exact files to create/modify**
```text
mobile-app/pubspec.yaml  mobile-app/l10n.yaml  mobile-app/lib/l10n/{app_ar.arb,app_en.arb}
mobile-app/lib/{main.dart,bootstrap.dart,app.dart}
mobile-app/lib/core/{config,network,security,storage,connectivity,router,theme,widgets}/**
mobile-app/lib/features/{auth,onboarding,home,medical_history,prescriptions,critical_info,emergency_contacts,emergency_card,
                         biometrics,access_control,assistant,emergency,pharmacy,settings}/**
mobile-app/android/app/src/main/AndroidManifest.xml          (permissions, cleartext off, allowBackup false)
mobile-app/android/app/src/main/kotlin/**/DeviceKeyPlugin.kt  (only if no suitable plugin; Keystore + BiometricPrompt)
mobile-app/ios/Runner/{Info.plist,DeviceKeyPlugin.swift}      (camera/FaceID usage strings; Secure Enclave)
mobile-app/test/**  mobile-app/integration_test/**
mobile-app/assets/fonts/**
```

**Antigravity prompt**
```text
Stage 6 — Flutter app. Read @docs/role-06-mobile-flutter.md (entire), @docs/role-07-ui-ux.md (§3, §4, §6, §7.1, §7.3, §7.4, §8.1, §9),
@docs/03-API-CONTRACTS-AND-INTEGRATION.md (§3.4, §5, §8, §9, §10), @docs/role-01-super-security.md §5.3 and §11.2 P16,
and @docs/02-EDGE-CASES-AND-FAILURE-MODES.md sections 1, 2 and 8.

Plan first (features, providers, routes, platform code), wait for approval, then implement feature by feature with tests:
1. Core: env via --dart-define, dio + interceptors (auth refresh, request id, X-Client, X-Device-Id, problem mapping, idempotency
   persistence for dispense), go_router with role shells and the no-login /card route, themes (light + Emergency from tokens),
   encrypted Hive boxes (key in flutter_secure_storage), connectivity provider + OfflineBanner, FLAG_SECURE helper.
2. Auth & onboarding: Supabase auth (email/phone + OTP, TOTP for staff), device registration with a hardware-backed, biometric-gated
   P-256 key (plugin or platform channel), StepUpService with the exact message format from role-01 §5.3.
3. Patient: home, history, encounter, prescriptions + pickup QR (step-up, FLAG_SECURE, brightness, countdown), critical info,
   emergency contacts (max 5, reorder, share toggle), emergency card (fetch, cache, quick action, offline render), sharing/grants/
   access log, settings (devices, logout-all, delete face data).
4. Face capture module per role-06 §6.1: ML Kit gating, challenge flow from /v1/biometric/challenge, auto-capture, compression,
   temp file deletion; enrolment screens with consent.
5. Assistant UI per role-06 §6.5 incl. emergency and crisis takeovers and tel: dialing.
6. Paramedic mode per role-06 §6.8: shift start, scan (rear camera, torch), match/possible/no-match/offline flows, High-Contrast
   profile, contacts, session timer + wakelock, offline QR verification with cached JWKS and encrypted audit outbox flush.
7. Pharmacist mode per role-06 §6.7: scan with local JWS pre-check, manual code + SMS/face presence, verify result, lease,
   dispense steppers, substitution sheet, offline disable, RX_QUANTITY_EXCEEDED refresh.
8. Tests: unit (step-up bytes golden, JWS verifier cases, quality gate), widget (emergency ordering, QR countdown blur, chat takeover),
   integration_test flows for patient, paramedic and pharmacist against a Dio mock adapter, then against staging.
Finish with `flutter analyze`, tests, a release build with --obfuscate --split-debug-info, and /verify-stage.
```

**Definition of Done**
- [ ] role-06 §11 checklist complete on a physical Android device.
- [ ] Emergency flow ≤ 10 s median to critical info in the usability test (role-07 §10).
- [ ] MobSF static scan: no hard-coded secrets, cleartext disabled, backup disabled.
- [ ] Tag `stage-6-done`.

---

## Stage 7 — End-to-End Integration, Security Penetration Checklist, Edge-Case Testing & Deployment

**Goal:** integrated system on staging → production-like deployment, all edge cases verified, security sign-off, demo script rehearsed.
**Owners:** Everyone; QA (M8) coordinates; Security Lead signs off · **Duration:** 4 weeks

**Prerequisites:** Stages 0–6 tagged; staging stable; keys for the demo environment generated by the Security Lead.

**Exact files to create/modify**
```text
infra/docker-compose.prod.yml                     (or Railway/Render service definitions: backend-api, ai-service (private), redis)
infra/Caddyfile or platform TLS config            (TLS 1.3, HSTS)
.github/workflows/{deploy-staging,deploy-prod,nightly}.yml   (nightly: assistant real-LLM eval, audit chain check, ZAP baseline)
docs/test-evidence/{edge-cases.md,security/**,performance/**,usability/**}
docs/runbooks/{deploy,rollback,key-rotation,incident-response,backup-restore}.md
docs/DEMO-SCRIPT.md
e2e/**                                            (cross-system scenarios: web + mobile + API scripts)
```

**Antigravity prompt**
```text
Stage 7 — Integration, security testing and deployment. Read @docs/02-EDGE-CASES-AND-FAILURE-MODES.md (entire, esp. §12 matrix),
@docs/role-01-super-security.md §10–§11, @docs/01-PRD-AND-USER-STORIES.md §7–§9, and @docs/03-API-CONTRACTS-AND-INTEGRATION.md §14.

Plan first, wait for approval, then:
1. Create e2e/ scenarios that drive the API (and Playwright for web) end-to-end:
   (a) Mona onboarding → face enrol → share code → Dr. Karim prescribes with a documented override → pickup token → pharmacy A
       dispenses 1 of 2 items → pharmacy B dispenses the rest → patient sees dispensed;
   (b) parallel dispense race across two pharmacies;
   (c) paramedic identifies Mona (match), reads profile and contacts, admin reviews the session, Mona sees access log;
   (d) no-match and offline-card paths; (e) licence revoke mid-flow; (f) AI down during prescribing and emergency.
2. Write docs/test-evidence/edge-cases.md: for EVERY edge case ID in 02 record test type, link to test or manual steps, result, date.
3. Execute role-01 §11.2 P1–P16 on staging; record evidence under docs/test-evidence/security/ (commands, outputs, screenshots).
   Run OWASP ZAP baseline + API scan with the OpenAPI file, sqlmap on query params, jwt_tool, MobSF on the release APK.
4. k6 performance tests for NFR-01 (read p95 ≤ 300 ms, check p95 ≤ 800 ms, identify server p95 ≤ 3 s) → docs/test-evidence/performance/.
5. Deployment: backend-api and ai-service containers (ai-service on PRIVATE networking only), Redis, Vercel for web-admin,
   Supabase production project (migrations via `supabase db push`, Dashboard settings checklist), env/secrets via the platform
   secret store, TLS/HSTS, CI deploy workflows with manual approval for prod.
6. Runbooks: deploy, rollback, key rotation (KEK + Rx key, tested once on staging), incident response, backup restore drill.
7. DEMO-SCRIPT.md: a 15-minute bilingual demo following scenario (a)+(c) with fallbacks if the network fails (offline card).
Finish with /security-review and /verify-stage; list any open findings with severity.
```

**Definition of Done (release gate)**
- [ ] All **Must** edge cases pass; **Should** cases pass or have a documented acceptance.
- [ ] Security checklist P1–P16 complete; no open High/Critical; Security Lead sign-off recorded.
- [ ] NFR-01 performance targets met or documented with measurements.
- [ ] Audit chain verified on production after the E2E run; restore drill done once.
- [ ] Production deployed: web on HTTPS with security headers; backend reachable; ai-service **not** reachable from the internet (verified).
- [ ] Demo rehearsed twice in Arabic and English on a physical phone + laptop; offline fallback rehearsed.
- [ ] Tag `stage-7-done` / `v1.0.0`.
