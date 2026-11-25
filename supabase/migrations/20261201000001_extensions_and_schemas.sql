-- 0001_extensions_and_schemas.sql
-- Extensions live in the Supabase-standard `extensions` schema.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector   with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

create schema if not exists app;
create schema if not exists biometric;
create schema if not exists audit;
create schema if not exists ref;
create schema if not exists private;

-- Lock everything down first, then grant the minimum.
revoke all on schema app, biometric, audit, ref, private from public, anon, authenticated;

-- The backend executes domain queries as `authenticated` (SD-07), so it needs USAGE on app/ref.
grant usage on schema app, ref to authenticated;
-- RLS helper functions live in `private`; execution is granted per function below.
grant usage on schema private to authenticated;
-- biometric and audit: NO usage for authenticated. Access only through SECURITY DEFINER functions.

-- Default privileges: new functions are NOT executable by public.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema app     revoke execute on functions from public;

-- Login roles (passwords set by ops via `alter role … password …`, never in Git).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'api_server') then
    create role api_server login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'ai_ref_reader') then
    create role ai_ref_reader login;
  end if;
end $$;
-- api_server can switch to `authenticated` per transaction (SET LOCAL ROLE authenticated).
grant authenticated to api_server;
grant usage on schema ref to ai_ref_reader;
