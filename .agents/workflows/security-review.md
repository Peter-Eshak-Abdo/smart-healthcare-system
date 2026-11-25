---
description: Self-review a change against the SmartHealth security checklist before opening a PR
---
1. For each changed route: permission declared? aal2/licence for staff? 404 on foreign ids? audit on sensitive reads?
2. For each changed table/function: RLS + WITH CHECK? search_path=''? grants explicit? tests for deny?
3. Grep the diff for: console.log, print(, sql.raw, service key usage, *_enc written without encryptField, PHI in logs.
// turbo
4. Run `gitleaks detect --no-banner && pnpm -r lint`
5. Output findings as a table (file, line, issue, fix) and fix them before finishing.
