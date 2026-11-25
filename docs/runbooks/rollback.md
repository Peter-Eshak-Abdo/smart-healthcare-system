# Rollback Runbook

1. Never delete or edit applied migrations in `supabase/migrations/`.
2. If application deployment regresses, re-deploy previous known-good container tag via `docker compose -f infra/docker-compose.prod.yml up -d`.
3. If an additive schema change causes incompatibility, add a forward corrective timestamped migration (`YYYYMMDDHHMMSS_rollback_*.sql`).
4. Verify `/v1/ready` and run `node e2e/scenarios.mjs`.
