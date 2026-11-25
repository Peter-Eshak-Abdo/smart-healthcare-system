---
description: Build one UI screen end-to-end from the SmartHealth UI specs
---
1. Ask for the screen ID (W-… or M-…). Open its section in docs/UI&UX/UI-05 or UI-06, its flow in UI-04 §5, and every UI-07 row that names it.
2. List the copy keys it needs; confirm each exists in UI-03 (follow 55-ui-copy if not).
3. List the components it needs from UI-01 §11–§12; reuse existing ones in components/** or lib/core/widgets/**; create missing ones there first.
4. Implement states in this order: happy path → loading → empty → error codes → offline → edge-case rows → Large-Font → dark/emergency/sunlight.
5. Add motion last, from UI-02 tokens only, with reduced-motion and Tier E variants.
// turbo
6. Run `pnpm --filter web-admin test && pnpm --filter web-admin e2e` (web) or `cd mobile-app && flutter analyze && flutter test` (mobile).
7. Produce a table: every state/edge row → ✅/❌ with evidence (test name or screenshot path).
