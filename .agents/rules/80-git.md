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
