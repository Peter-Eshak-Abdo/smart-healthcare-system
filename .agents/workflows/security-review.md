---
description: Self-review a change against the SmartHealth security checklist before opening a PR
---
1. For each changed route: permission declared? aal2/licence for staff? 404 on foreign ids? audit on sensitive reads?
2. For each changed Firestore collection/rule: custom claims verified (`role`, `account_status == 'active'`, `licence_status == 'verified'`)? client writes denied?
3. Grep the diff for: console.log, print(, service key leakage in client apps, *_enc written without encryptField, PHI in logs.
// turbo
4. Run `gitleaks detect --no-banner && npm run lint --workspaces`
5. Output findings as a table (file, line, issue, fix) and fix them before finishing.
