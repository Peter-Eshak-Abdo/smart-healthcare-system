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
