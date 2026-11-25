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
