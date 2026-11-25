-- 0004_functions_and_triggers.sql
-- All SECURITY DEFINER functions: owner = postgres, `set search_path = ''`, fully-qualified names.

-- ===== Generic helpers =====
create or replace function private.tg_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','facilities','practitioners','patients','encounters','conditions',
                           'allergies','medication_statements','emergency_contacts','prescriptions','prescription_items']
  loop
    execute format('create trigger set_updated_at before update on app.%I
                    for each row execute function private.tg_set_updated_at()', t);
  end loop;
end $$;

-- Crockford base32 MRN, e.g. SH-7K2M9Q4D
create or replace function private.generate_mrn() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  result text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    result := 'SH-';
    for i in 0..7 loop
      result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from app.patients where mrn = result);
  end loop;
  return result;
end $$;
alter table app.patients alter column mrn set default private.generate_mrn();

create or replace function private.next_rx_number() returns text
language sql volatile set search_path = '' as $$
  select 'RX-' || to_char(now() at time zone 'Africa/Cairo', 'YYYY') || '-' ||
         lpad(nextval('app.rx_number_seq')::text, 6, '0')
$$;
alter table app.prescriptions alter column rx_number set default private.next_rx_number();

create or replace function private.age_years(p_dob date) returns int
language sql immutable set search_path = '' as $$
  select extract(year from age(current_date, p_dob))::int
$$;

-- ===== Identity of the caller (used by RLS) =====
-- Role is read from app.profiles, NOT trusted from the JWT, and only for ACTIVE accounts.
create or replace function private.current_app_role() returns app.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from app.profiles p
  where p.id = (select auth.uid()) and p.status = 'active'
$$;

create or replace function private.is_verified_practitioner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.practitioners pr
    join app.profiles p on p.id = pr.id
    where pr.id = (select auth.uid())
      and p.status = 'active'
      and pr.license_status = 'verified'
      and (pr.license_expires_at is null or pr.license_expires_at >= current_date)
  )
$$;

create or replace function private.has_grant(p_patient uuid, p_write boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_app_role() = 'doctor'
     and private.is_verified_practitioner()
     and exists (
       select 1 from app.access_grants g
       where g.patient_id = p_patient
         and g.practitioner_id = (select auth.uid())
         and g.status = 'active'
         and g.expires_at > now()
         and (not p_write or g.scope = 'read_write'))
$$;

create or replace function private.has_pharmacy_context(p_prescription uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_app_role() = 'pharmacist'
     and private.is_verified_practitioner()
     and exists (
       select 1 from app.rx_verifications v
       where v.prescription_id = p_prescription
         and v.pharmacist_id = (select auth.uid())
         and v.expires_at > now())
$$;

create or replace function private.pharmacy_context_patient(p_patient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_app_role() = 'pharmacist'
     and exists (
       select 1 from app.rx_verifications v
       join app.prescriptions rx on rx.id = v.prescription_id
       where rx.patient_id = p_patient
         and v.pharmacist_id = (select auth.uid())
         and v.expires_at > now())
$$;

create or replace function private.has_consent(p_patient uuid, p_type app.consent_type) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.granted from app.consents c
    where c.patient_id = p_patient and c.consent_type = p_type
    order by c.recorded_at desc, c.id desc limit 1), false)
$$;

create or replace function private.is_member_of(p_facility uuid, p_type app.facility_type) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.practitioner_facilities pf
    join app.facilities f on f.id = pf.facility_id
    where pf.practitioner_id = (select auth.uid())
      and pf.facility_id = p_facility
      and pf.ended_at is null
      and f.is_active
      and f.type = p_type)
$$;

grant execute on function
  private.current_app_role(), private.is_verified_practitioner(), private.has_grant(uuid, boolean),
  private.has_pharmacy_context(uuid), private.pharmacy_context_patient(uuid),
  private.has_consent(uuid, app.consent_type), private.is_member_of(uuid, app.facility_type),
  private.age_years(date)
to authenticated;

-- ===== New auth user → profile (role is NEVER taken from user-controlled metadata) =====
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role app.app_role := 'patient';
  v_invited text := new.raw_app_meta_data ->> 'invited_role';   -- app_meta_data: service-role only
begin
  if v_invited in ('doctor','pharmacist','paramedic','admin') then
    v_role := v_invited::app.app_role;
  end if;
  insert into app.profiles (id, role, status, full_name)
  values (new.id, v_role, 'pending_verification',
          left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  if (new.raw_user_meta_data ? 'role') or (new.raw_user_meta_data ? 'app_role') then
    insert into audit.system_logs (action, actor_id, resource_type, resource_id, outcome, reason)
    values ('ROLE_ESCALATION_ATTEMPT', new.id, 'profile', new.id, 'denied', 'role in user metadata ignored');
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ===== Supabase Custom Access Token Hook =====
-- Enable in Dashboard → Authentication → Hooks → Custom Access Token → private.custom_access_token_hook
create or replace function private.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_claims jsonb := event -> 'claims';
  v_profile record;
begin
  select role, status, session_epoch into v_profile
  from app.profiles where id = (event ->> 'user_id')::uuid;

  if found then
    v_claims := v_claims
      || jsonb_build_object('app_role', v_profile.role,
                            'account_status', v_profile.status,
                            'session_epoch', v_profile.session_epoch);
  else
    v_claims := v_claims || jsonb_build_object('app_role', null, 'account_status', 'pending_verification', 'session_epoch', 0);
  end if;
  return jsonb_set(event, '{claims}', v_claims);
end $$;

grant usage on schema app, private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function private.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select (id, role, status, session_epoch) on app.profiles to supabase_auth_admin;

-- ===== Audit: append-only + hash chain =====
create or replace function audit.tg_chain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prev_hash bytea;
  v_prev_seq  bigint;
begin
  -- Serialise writers so chain_seq order == hash-chain order (held until commit).
  perform pg_advisory_xact_lock(7243001);
  select l.chain_seq, l.row_hash into v_prev_seq, v_prev_hash
  from audit.system_logs l order by l.chain_seq desc limit 1;

  new.chain_seq := coalesce(v_prev_seq, 0) + 1;
  new.prev_hash := coalesce(v_prev_hash, '\x00'::bytea);
  new.row_hash  := extensions.digest(
      new.prev_hash || convert_to(concat_ws('|',
        new.chain_seq, new.occurred_at, new.actor_id, new.actor_role, new.action, new.resource_type,
        new.resource_id, new.patient_id, new.outcome, new.reason, new.request_id, new.ip,
        new.metadata::text), 'UTF8'),
      'sha256');
  return new;
end $$;

create trigger chain before insert on audit.system_logs
  for each row execute function audit.tg_chain();

create or replace function audit.tg_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit.system_logs is append-only (% blocked)', tg_op using errcode = '42501';
end $$;

create trigger no_update_delete before update or delete on audit.system_logs
  for each row execute function audit.tg_immutable();
create trigger no_truncate before truncate on audit.system_logs
  for each statement execute function audit.tg_immutable();

revoke all on audit.system_logs from public, anon, authenticated, api_server;

-- Explicit event logging (used by backend for READS, which triggers can't see).
create or replace function private.log_event(
  p_action text, p_resource_type text, p_resource_id uuid, p_patient_id uuid,
  p_outcome audit.outcome default 'success', p_reason text default null,
  p_metadata jsonb default '{}'::jsonb, p_request_id uuid default null,
  p_ip inet default null, p_user_agent text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into audit.system_logs (actor_id, actor_role, action, resource_type, resource_id, patient_id,
                                 outcome, reason, request_id, ip, user_agent, metadata)
  values ((select auth.uid()), (select auth.jwt() ->> 'app_role'), p_action, p_resource_type, p_resource_id,
          p_patient_id, p_outcome, left(p_reason, 500), p_request_id, p_ip, left(p_user_agent, 300),
          coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function private.log_event(text, text, uuid, uuid, audit.outcome, text, jsonb, uuid, inet, text) to authenticated;

-- Automatic row-change logging for clinically/security relevant tables.
-- Logs column NAMES that changed, never values.
create or replace function audit.tg_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
  v_patient uuid;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at','version') and (v_new -> k) is distinct from (v_old -> k);
    if v_changed is null then return null; end if;   -- no meaningful change
  end if;

  v_patient := case
    when tg_table_name = 'patients' then (v_row ->> 'id')::uuid
    when v_row ? 'patient_id'       then (v_row ->> 'patient_id')::uuid
  end;

  insert into audit.system_logs (actor_id, actor_role, action, resource_type, resource_id, patient_id, metadata)
  values ((select auth.uid()), (select auth.jwt() ->> 'app_role'),
          upper(tg_table_name) || '_' || tg_op, tg_table_name,
          case when (v_row ->> 'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               then (v_row ->> 'id')::uuid end,
          v_patient,
          jsonb_build_object('schema', tg_table_schema, 'row_id', v_row ->> 'id',
                             'changed', coalesce(to_jsonb(v_changed), '[]'::jsonb)));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','practitioners','patients','consents','devices','access_grants','encounters',
                           'diagnoses','conditions','allergies','emergency_contacts','prescriptions',
                           'prescription_items','clinical_alerts','dispensations','emergency_sessions','admin_approvals']
  loop
    execute format('create trigger audit_row_change after insert or update or delete on app.%I
                    for each row execute function audit.tg_row_change()', t);
  end loop;
end $$;
create trigger audit_row_change after insert or update or delete on biometric.face_templates
  for each row execute function audit.tg_row_change();

create or replace function private.verify_audit_chain()
returns table (ok boolean, checked bigint, broken_at_seq bigint)
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_prev bytea := '\x00'::bytea;
  v_expected bytea;
  v_n bigint := 0;
begin
  for r in select * from audit.system_logs order by chain_seq loop
    v_n := v_n + 1;
    v_expected := extensions.digest(
      v_prev || convert_to(concat_ws('|',
        r.chain_seq, r.occurred_at, r.actor_id, r.actor_role, r.action, r.resource_type,
        r.resource_id, r.patient_id, r.outcome, r.reason, r.request_id, r.ip, r.metadata::text), 'UTF8'),
      'sha256');
    if r.prev_hash <> v_prev or r.row_hash <> v_expected or r.chain_seq <> v_n then
      return query select false, v_n, r.chain_seq; return;
    end if;
    v_prev := r.row_hash;
  end loop;
  return query select true, v_n, null::bigint;
end $$;

-- ===== Prescription invariants =====

-- 1) Items: clinical columns immutable after insert; derive item status from quantities.
create or replace function app.tg_items_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.drug_id, new.dose, new.route, new.frequency, new.frequency_interval_hours, new.duration_days,
      new.quantity_prescribed, new.quantity_unit, new.instructions, new.substitution_allowed, new.prescription_id)
     is distinct from
     (old.drug_id, old.dose, old.route, old.frequency, old.frequency_interval_hours, old.duration_days,
      old.quantity_prescribed, old.quantity_unit, old.instructions, old.substitution_allowed, old.prescription_id) then
    raise exception 'prescription item clinical fields are immutable' using errcode = '42501';
  end if;
  if new.quantity_dispensed < old.quantity_dispensed then
    raise exception 'quantity_dispensed cannot decrease' using errcode = '23514';
  end if;
  if old.status = 'cancelled' and new.quantity_dispensed <> old.quantity_dispensed then
    raise exception 'cannot dispense a cancelled item' using errcode = '23514';
  end if;
  if new.status <> 'cancelled' then
    new.status := case
      when new.quantity_dispensed = new.quantity_prescribed then 'dispensed'
      when new.quantity_dispensed > 0                       then 'partially_dispensed'
      else 'pending' end::app.rx_item_status;
  end if;
  return new;
end $$;
create trigger items_guard before update on app.prescription_items
  for each row execute function app.tg_items_guard();

-- 2) Dispensation item → atomically increment the prescription item (row lock + CHECK = no over-dispense).
create or replace function app.tg_apply_dispensation_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_rx uuid;
  v_item_rx uuid;
begin
  select d.prescription_id into v_rx from app.dispensations d where d.id = new.dispensation_id;
  select pi.prescription_id into v_item_rx from app.prescription_items pi where pi.id = new.prescription_item_id;
  if v_rx is distinct from v_item_rx then
    raise exception 'item does not belong to this prescription' using errcode = '23514';
  end if;

  update app.prescription_items
     set quantity_dispensed = quantity_dispensed + new.quantity,
         dispense_count     = dispense_count + 1
   where id = new.prescription_item_id;      -- waits on concurrent dispensers; CHECK fires on overflow
  return new;
end $$;
create trigger apply_dispensation_item after insert on app.dispensation_items
  for each row execute function app.tg_apply_dispensation_item();

-- 3) Recompute prescription status from its items.
create or replace function app.tg_recompute_rx_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_total int; v_done int; v_any_dispensed boolean; v_cur app.prescription_status;
begin
  select status into v_cur from app.prescriptions where id = new.prescription_id for no key update;  -- compatible with FK KEY SHARE locks → no deadlock
  if v_cur in ('cancelled','expired') and new.quantity_dispensed > old.quantity_dispensed then
    raise exception 'prescription is %', v_cur using errcode = '23514';
  end if;

  select count(*),
         count(*) filter (where status in ('dispensed','cancelled')),
         bool_or(quantity_dispensed > 0)
    into v_total, v_done, v_any_dispensed
    from app.prescription_items where prescription_id = new.prescription_id;

  update app.prescriptions
     set status = case
           when v_done = v_total and v_any_dispensed then 'dispensed'
           when v_done = v_total and not v_any_dispensed then 'cancelled'
           when v_any_dispensed then 'partially_dispensed'
           else 'pending' end::app.prescription_status,
         version = version + 1
   where id = new.prescription_id
     and status not in ('expired');
  return null;
end $$;
create trigger recompute_rx_status after update of quantity_dispensed, status on app.prescription_items
  for each row execute function app.tg_recompute_rx_status();

-- 4) Prescription header guard: allowed status transitions + signature write-once.
create or replace function app.tg_rx_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.signature is not null and (new.signature, new.signature_kid, new.payload_sha256)
       is distinct from (old.signature, old.signature_kid, old.payload_sha256) then
    raise exception 'prescription signature is write-once' using errcode = '42501';
  end if;
  if (new.patient_id, new.doctor_id, new.facility_id, new.encounter_id, new.issued_at, new.expires_at, new.rx_number)
     is distinct from
     (old.patient_id, old.doctor_id, old.facility_id, old.encounter_id, old.issued_at, old.expires_at, old.rx_number) then
    raise exception 'prescription header is immutable' using errcode = '42501';
  end if;
  if old.status <> new.status and not (
       (old.status = 'pending'             and new.status in ('partially_dispensed','dispensed','cancelled','expired')) or
       (old.status = 'partially_dispensed' and new.status in ('dispensed','expired','cancelled'))
     ) then
    raise exception 'illegal prescription status transition % -> %', old.status, new.status using errcode = '23514';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  return new;
end $$;
create trigger rx_guard before update on app.prescriptions
  for each row execute function app.tg_rx_guard();

-- 5) A prescription must be signed by the end of the issuing transaction.
create or replace function app.tg_rx_must_be_signed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from app.prescriptions where id = new.id and (signature is null or payload_sha256 is null)) then
    raise exception 'prescription % committed without signature', new.id using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger rx_must_be_signed after insert on app.prescriptions
  deferrable initially deferred
  for each row execute function app.tg_rx_must_be_signed();

-- 6) Items can only be inserted while the prescription is being issued (same transaction, unsigned).
create or replace function app.tg_items_insert_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from app.prescriptions where id = new.prescription_id and signature is not null) then
    raise exception 'cannot add items to a signed prescription' using errcode = '42501';
  end if;
  new.quantity_dispensed := 0;
  new.status := 'pending';
  return new;
end $$;
create trigger items_insert_guard before insert on app.prescription_items
  for each row execute function app.tg_items_insert_guard();

-- 7) Issued items feed the current-medication list.
create or replace function app.tg_items_to_medication_statements() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.medication_statements (patient_id, drug_id, source, prescription_item_id, dose_text,
                                         effective_from, effective_until)
  select rx.patient_id, new.drug_id, 'prescription', new.id,
         new.dose || ' ' || replace(new.frequency, '_', ' '),
         (rx.issued_at at time zone 'Africa/Cairo')::date,
         (rx.issued_at at time zone 'Africa/Cairo')::date + new.duration_days
  from app.prescriptions rx where rx.id = new.prescription_id;
  return null;
end $$;
create trigger items_to_medication_statements after insert on app.prescription_items
  for each row execute function app.tg_items_to_medication_statements();

create or replace function app.tg_cancelled_items_stop_meds() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update app.medication_statements set status = 'stopped', effective_until = current_date
    where prescription_item_id = new.id and status = 'active';
  end if;
  return null;
end $$;
create trigger cancelled_items_stop_meds after update of status on app.prescription_items
  for each row execute function app.tg_cancelled_items_stop_meds();

-- ===== Clinical record guards =====
create or replace function app.tg_encounter_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'closed' and old.ended_at < now() - interval '24 hours'
     and (new.chief_complaint_enc, new.notes_internal_enc, new.patient_summary_enc)
         is distinct from (old.chief_complaint_enc, old.notes_internal_enc, old.patient_summary_enc) then
    raise exception 'edit window closed; add an addendum' using errcode = '42501';
  end if;
  if (new.patient_id, new.doctor_id, new.facility_id, new.started_at)
     is distinct from (old.patient_id, old.doctor_id, old.facility_id, old.started_at) then
    raise exception 'encounter identity fields are immutable' using errcode = '42501';
  end if;
  if new.status = 'closed' and old.status = 'open' then
    new.ended_at := coalesce(new.ended_at, now());
  end if;
  new.version := old.version + 1;
  return new;
end $$;
create trigger encounter_guard before update on app.encounters
  for each row execute function app.tg_encounter_guard();

create or replace function app.tg_max_emergency_contacts() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from app.emergency_contacts
      where patient_id = new.patient_id and deleted_at is null) >= 5 then
    raise exception 'maximum 5 emergency contacts' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger max_emergency_contacts before insert on app.emergency_contacts
  for each row execute function app.tg_max_emergency_contacts();

-- Patient-reported data may never claim to be clinician-confirmed.
create or replace function app.tg_source_matches_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.current_app_role() = 'patient' and new.source <> 'patient_reported' then
    raise exception 'patients can only add patient_reported data' using errcode = '42501';
  end if;
  if private.current_app_role() = 'doctor' and new.source = 'patient_reported' then
    new.source := 'clinician_confirmed';
  end if;
  new.recorded_by := coalesce(new.recorded_by, (select auth.uid()));
  return new;
end $$;
create trigger source_matches_role before insert on app.allergies
  for each row execute function app.tg_source_matches_role();
create trigger source_matches_role before insert on app.conditions
  for each row execute function app.tg_source_matches_role();

-- Protected identity fields on profiles/patients: only via SECURITY DEFINER admin functions.
create or replace function app.tg_protect_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Inside SECURITY DEFINER admin functions current_user is the owner (postgres), not `authenticated`.
  if current_user <> 'authenticated' then return new; end if;
  if tg_table_name = 'profiles' and
     (new.role, new.status, new.session_epoch) is distinct from (old.role, old.status, old.session_epoch) then
    raise exception 'role/status/session_epoch change requires admin function' using errcode = '42501';
  end if;
  if tg_table_name = 'patients' and
     (new.id_document_enc, new.id_document_bidx, new.date_of_birth, new.mrn)
       is distinct from (old.id_document_enc, old.id_document_bidx, old.date_of_birth, old.mrn) then
    raise exception 'identity fields require admin function' using errcode = '42501';
  end if;
  if tg_table_name = 'patients' and old.blood_type_source = 'clinician_confirmed'
     and new.blood_type is distinct from old.blood_type
     and private.current_app_role() <> 'doctor' then
    raise exception 'confirmed blood type can only be changed by a doctor' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger protect_identity before update on app.profiles
  for each row execute function app.tg_protect_identity();
create trigger protect_identity before update on app.patients
  for each row execute function app.tg_protect_identity();
