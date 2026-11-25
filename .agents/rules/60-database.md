---
trigger: glob
globs: "supabase/**/*.sql, supabase/config.toml"
description: Postgres/Supabase migration, RLS and function conventions
---
# Database conventions
- New migration file per change: supabase/migrations/<YYYYMMDDHHMMSS>_<snake_desc>.sql. Never edit merged migrations.
- Every table in `app` has RLS enabled + forced, with explicit allow policies per role and WITH CHECK pinning the actor column.
- SECURITY DEFINER functions only in `private`/`audit`, always `set search_path = ''`, fully-qualified names,
  explicit role checks inside, explicit `grant execute ... to authenticated`.
- Use `(select auth.uid())` in policies. Derived columns (status, quantity_dispensed) are never client-updatable.
- Enum values and names exactly as docs/00-INDEX §5.2. Ref severities are text + CHECK.
- No seed data in migrations. Reference data in supabase/seed/01_reference.sql only.
- Every new policy/function gets an allow AND deny test in supabase/tests.
- Never expose app/ref/biometric/audit/private schemas in the Data API.
