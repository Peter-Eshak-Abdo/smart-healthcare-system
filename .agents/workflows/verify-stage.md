---
description: Run all checks for the current stage and report Definition of Done status
---
1. Read `docs/ANTIGRAVITY-STAGES.md` and identify the current stage (ask if unclear).
// turbo
2. Run `npm run lint --workspaces && npm run typecheck --workspaces`
// turbo
3. Run `npm run test --workspaces && npm run build`
4. If `ai-service/` changed: run `cd ai-service && python -m uv run ruff check . && python -m uv run mypy app && python -m uv run pytest -v`.
5. If `mobile-app/` changed: run `cd mobile-app && flutter gen-l10n && flutter analyze --fatal-warnings && flutter test && flutter build web --release`.
6. Run `npm run contracts:check` and `gitleaks detect --no-banner`.
7. Produce a table of every DoD item of the stage with ✅/❌ and evidence (command output or file path). Do not claim ✅ without evidence.
