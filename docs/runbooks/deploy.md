# Deploy Runbook

1. Verify CI green on `main` / release tag (`pnpm -r lint`, `typecheck`, `test`, `contracts:check`, `ruff`, `mypy`, `pytest`, `flutter analyze`, `flutter test`).
2. Push Supabase migrations (`supabase db push --db-url "$PROD_SUPABASE_DB_URL"`).
3. Validate `docker compose -f infra/docker-compose.prod.yml config -q`.
4. Confirm `ai-service` is attached **only** to `smarthealth_private` (`internal: true`) and has zero published host ports.
5. Start/update services: `docker compose -f infra/docker-compose.prod.yml up -d --build`.
6. Verify `/v1/health`, `/v1/ready`, TLS/HSTS headers via Caddy, and `/v1/admin/audit-integrity` status `ok`.
