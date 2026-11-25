-- 0007_jobs.sql — housekeeping functions, scheduled with pg_cron on Supabase.
create or replace function private.job_expire_prescriptions() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update app.prescriptions set status = 'expired'
   where status in ('pending','partially_dispensed') and expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function private.job_expire_grants() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update app.access_grants set status = 'expired' where status = 'active' and expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function private.job_expire_emergency_sessions() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update app.emergency_sessions set status = 'expired' where status = 'active' and expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function private.job_expire_licenses() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update app.practitioners set license_status = 'expired', license_status_changed_at = now()
   where license_status = 'verified' and license_expires_at < current_date;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function private.job_purge_assistant() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from app.assistant_sessions where last_message_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function private.job_cleanup_ephemeral() returns void
language sql security definer set search_path = '' as $$
  delete from app.dispense_leases where expires_at < now();
  delete from app.share_codes where expires_at < now() - interval '1 day';
  delete from app.rx_verifications where expires_at < now() - interval '30 days';
$$;

-- On Supabase (pg_cron enabled in Dashboard → Database → Extensions):
-- select cron.schedule('expire-rx',        '*/15 * * * *', $$select private.job_expire_prescriptions()$$);
-- select cron.schedule('expire-grants',    '*/15 * * * *', $$select private.job_expire_grants()$$);
-- select cron.schedule('expire-emergency', '*/5 * * * *',  $$select private.job_expire_emergency_sessions()$$);
-- select cron.schedule('expire-licenses',  '10 0 * * *',   $$select private.job_expire_licenses()$$);
-- select cron.schedule('purge-assistant',  '20 0 * * *',   $$select private.job_purge_assistant()$$);
-- select cron.schedule('cleanup',          '0 * * * *',    $$select private.job_cleanup_ephemeral()$$);
-- select cron.schedule('audit-verify',     '30 1 * * *',
--   $$insert into audit.system_logs (action, outcome, metadata)
--     select 'AUDIT_CHAIN_VERIFIED', case when ok then 'success' else 'error' end::audit.outcome,
--            jsonb_build_object('checked', checked, 'broken_at_seq', broken_at_seq)
--       from private.verify_audit_chain()$$);
