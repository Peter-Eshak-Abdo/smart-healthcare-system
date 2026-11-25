---
trigger: always_on
description: File-modification boundaries between modules and stages
---
# Boundaries
- Only modify files listed under the CURRENT stage in docs/ANTIGRAVITY-STAGES.md, plus their tests. Ask before touching others.
- Ownership (do not edit another module's internals to make your task work; open a contract change instead):
  firebase/** → Database · backend-api/** → Backend · ai-service/** → AI · web-admin/** → Web · mobile-app/** → Mobile ·
  packages/contracts/** → Backend Lead + consumer approval · design/tokens/** → UI/UX · .agents/**, AGENTS.md, docs/00-INDEX.md → Tech Lead.
- Keep `firebase/firestore.rules` and `firebase/storage.rules` in sync with `backend-api/src/firebase/firestore-types.ts`.
- Never change a public API shape without updating packages/contracts (schemas + examples) in the same PR (/contract-change).
- Never add a dependency without stating why in the plan; prefer the stack in the role blueprint.
