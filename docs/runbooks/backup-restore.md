# Backup & Restore Runbook

1. Perform automated daily encrypted PostgreSQL PITR/pg_dump snapshots on Supabase production.
2. Quarterly restore drill: restore snapshot into isolated staging DB, run `supabase/tests/run.sh` (T01–T25) and verify `audit.verify_audit_chain()` returns `ok`.
3. Never restore production PHI into unencrypted developer workstations.
