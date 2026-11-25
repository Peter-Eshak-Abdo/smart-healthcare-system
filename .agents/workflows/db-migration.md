---
description: Create a new database migration with RLS and tests
---
1. Create supabase/migrations/<timestamp>_<desc>.sql (never edit old ones).
2. Follow .agents/rules/60-database.md; include RLS, grants, comments.
3. Add allow + deny tests to supabase/tests.
// turbo
4. Run `supabase db reset && pnpm db:test`
5. Regenerate Kysely types: `pnpm --filter backend-api db:types` and commit.
