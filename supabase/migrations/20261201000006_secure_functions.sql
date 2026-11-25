-- 0006_secure_functions.sql
-- Business operations that must bypass row-level visibility in a CONTROLLED way.
-- Each function: SECURITY DEFINER, owner = postgres (BYPASSRLS on Supabase), search_path = '',
-- checks the caller's role itself, and is granted to `authenticated` explicitly.

-- ===== Patients =====
create or replace function private.onboard_patient(
  p_doc_type text, p_doc_enc text, p_doc_bidx bytea, p_dob date, p_sex app.sex,
  p_blood_type app.blood_type, p_tos_version text
) returns app.patients
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row app.patients;
begin
  if not exists (select 1 from app.profiles where id = v_uid and role = 'patient'
                 and status in ('pending_verification','active')) then
    raise exception 'not a patient account' using errcode = '42501';
  end if;
  if exists (select 1 from app.patients where id = v_uid) then
    raise exception 'already onboarded' using errcode = '23505';
  end if;
  if exists (select 1 from app.patients where id_document_bidx = p_doc_bidx) then
    raise exception 'id_already_registered' using errcode = '23505';
  end if;

  insert into app.patients (id, id_document_type, id_document_enc, id_document_bidx, date_of_birth, sex,
                            blood_type, blood_type_source)
  values (v_uid, p_doc_type, p_doc_enc, p_doc_bidx, p_dob, p_sex, coalesce(p_blood_type, 'unknown'),
          case when p_blood_type is not null and p_blood_type <> 'unknown' then 'patient_reported'::app.data_source end)
  returning * into v_row;

  insert into app.consents (patient_id, consent_type, version, granted)
  values (v_uid, 'terms_of_service', p_tos_version, true);

  update app.profiles set status = 'active' where id = v_uid;
  return v_row;
end $$;

-- ===== Access grants =====
create or replace function private.redeem_share_code(p_patient_mrn text, p_code_hmac bytea)
returns app.access_grants
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_patient uuid;
  v_code app.share_codes;
  v_grant app.access_grants;
begin
  if private.current_app_role() <> 'doctor' or not private.is_verified_practitioner() then
    raise exception 'doctor with verified licence required' using errcode = '42501';
  end if;
  select id into v_patient from app.patients where mrn = upper(p_patient_mrn);
  select * into v_code from app.share_codes
   where patient_id = v_patient and redeemed_at is null and expires_at > now()
   order by created_at desc limit 1
   for update;
  if v_code.id is null or v_code.code_hmac <> p_code_hmac then
    if v_code.id is not null then
      -- NOTE: do NOT raise here — an exception would roll back this counter (brute-force protection).
      update app.share_codes set failed_attempts = failed_attempts + 1,
             expires_at = case when failed_attempts + 1 >= 5 then now() else expires_at end
       where id = v_code.id;
    end if;
    return null;   -- backend maps NULL → 422 VALIDATION_FAILED (detail: invalid_or_expired_code)
  end if;

  update app.share_codes set redeemed_at = now(), redeemed_by = v_uid where id = v_code.id;

  -- Replace any existing active grant for this pair
  update app.access_grants set status = 'revoked', revoked_at = now(), revoked_by = v_uid
   where patient_id = v_patient and practitioner_id = v_uid and status = 'active';

  insert into app.access_grants (patient_id, practitioner_id, grant_type, scope, expires_at, source_share_code_id)
  values (v_patient, v_uid, 'patient_share', v_code.scope, now() + make_interval(days => v_code.grant_duration_days), v_code.id)
  returning * into v_grant;
  return v_grant;
end $$;

-- ===== Pharmacy =====
create or replace function private.find_prescription_for_pharmacy(p_rx_number text)
returns table (prescription_id uuid, patient_id uuid, verification_code_hash text)
language plpgsql security definer set search_path = '' as $$
begin
  if private.current_app_role() <> 'pharmacist' or not private.is_verified_practitioner() then
    raise exception 'pharmacist with verified licence required' using errcode = '42501';
  end if;
  return query select rx.id, rx.patient_id, rx.verification_code_hash
               from app.prescriptions rx where rx.rx_number = upper(p_rx_number);
end $$;

-- Called by the backend ONLY after it has verified a pickup token, or rx code + presence proof.
create or replace function private.open_pharmacy_context(
  p_prescription_id uuid, p_pharmacy_id uuid, p_method app.verification_method, p_pickup_jti text default null
) returns app.rx_verifications
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_rx app.prescriptions;
  v_pr app.practitioners;
  v_result text;
  v_row app.rx_verifications;
begin
  if private.current_app_role() <> 'pharmacist' or not private.is_verified_practitioner() then
    raise exception 'pharmacist with verified licence required' using errcode = '42501';
  end if;
  if not private.is_member_of(p_pharmacy_id, 'pharmacy') then
    raise exception 'not a member of this pharmacy' using errcode = '42501';
  end if;
  select * into v_rx from app.prescriptions where id = p_prescription_id;
  if v_rx.id is null then raise exception 'rx_not_found' using errcode = 'P0002'; end if;
  select * into v_pr from app.practitioners where id = v_rx.doctor_id;

  v_result := case
    when v_rx.prescriber_invalid or v_pr.license_status = 'revoked'
      or (v_pr.license_status in ('suspended','expired') and v_pr.license_status_changed_at <= v_rx.issued_at)
      then 'prescriber_invalid'
    when v_rx.status = 'cancelled' then 'cancelled'
    when v_rx.status = 'dispensed' then 'already_dispensed'
    when v_rx.status = 'expired' or v_rx.expires_at <= now() then 'expired'
    else 'valid' end;

  insert into app.rx_verifications (prescription_id, pharmacist_id, pharmacy_id, method, result, pickup_jti)
  values (p_prescription_id, v_uid, p_pharmacy_id, p_method, v_result, p_pickup_jti)
  returning * into v_row;
  return v_row;
end $$;

-- ===== Emergency =====
create or replace function private.open_emergency_session(
  p_patient_id uuid, p_method app.emergency_id_method, p_score real, p_margin real,
  p_low_confidence boolean, p_confirmed_by_operator boolean, p_reason_code text,
  p_incident_ref text, p_lat numeric, p_lng numeric, p_idempotency_key uuid
) returns app.emergency_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_facility uuid;
  v_row app.emergency_sessions;
begin
  if private.current_app_role() <> 'paramedic' or not private.is_verified_practitioner() then
    raise exception 'paramedic with verified licence required' using errcode = '42501';
  end if;
  select pf.facility_id into v_facility
    from app.practitioner_facilities pf join app.facilities f on f.id = pf.facility_id
   where pf.practitioner_id = v_uid and pf.ended_at is null and f.type in ('ambulance_service','hospital')
   order by pf.started_at desc limit 1;
  if v_facility is null then
    raise exception 'paramedic must belong to an ambulance service or hospital' using errcode = '42501';
  end if;

  select * into v_row from app.emergency_sessions where idempotency_key = p_idempotency_key;
  if found then
    if v_row.paramedic_id <> v_uid then raise exception 'idempotency key conflict' using errcode = '23505'; end if;
    return v_row;
  end if;

  insert into app.emergency_sessions (paramedic_id, facility_id, patient_id, method, match_score, match_margin,
       low_confidence, confirmed_by_operator, reason_code, incident_ref, location_lat, location_lng, idempotency_key)
  values (v_uid, v_facility, p_patient_id, p_method, p_score, p_margin, p_low_confidence, p_confirmed_by_operator,
          p_reason_code, p_incident_ref, p_lat, p_lng, p_idempotency_key)
  returning * into v_row;

  insert into app.notifications (user_id, channel, template, payload)
  values (p_patient_id, 'push', 'emergency_profile_accessed',
          jsonb_build_object('session_id', v_row.id, 'facility_id', v_facility, 'at', v_row.started_at));
  return v_row;
end $$;

create or replace function private.active_emergency_session(p_session_id uuid) returns app.emergency_sessions
language plpgsql security definer set search_path = '' as $$
declare v_s app.emergency_sessions;
begin
  if private.current_app_role() <> 'paramedic' or not private.is_verified_practitioner() then
    raise exception 'paramedic with verified licence required' using errcode = '42501';
  end if;
  select * into v_s from app.emergency_sessions where id = p_session_id and paramedic_id = (select auth.uid());
  if v_s.id is null then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if v_s.status <> 'active' or v_s.expires_at <= now() then
    if v_s.status = 'active' then
      update app.emergency_sessions set status = 'expired' where id = v_s.id;
    end if;
    raise exception 'session_expired' using errcode = 'P0003';
  end if;
  return v_s;
end $$;

-- The ONLY way to read emergency data. Output shape is closed (US-17-AC1).
create or replace function private.get_emergency_profile(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_s app.emergency_sessions := private.active_emergency_session(p_session_id);
  v_p record;
begin
  select pr.full_name, pa.date_of_birth, pa.sex, pa.mrn, pa.blood_type, pa.blood_type_source
    into v_p
    from app.patients pa join app.profiles pr on pr.id = pa.id
   where pa.id = v_s.patient_id;

  return jsonb_build_object(
    'session', jsonb_build_object('id', v_s.id, 'expires_at', v_s.expires_at,
                                  'low_confidence', v_s.low_confidence, 'method', v_s.method),
    'patient', jsonb_build_object('full_name', v_p.full_name, 'age', private.age_years(v_p.date_of_birth),
                                  'sex', v_p.sex, 'mrn_last4', right(v_p.mrn, 4)),
    'blood_type', jsonb_build_object('value', v_p.blood_type,
                                     'verified', v_p.blood_type_source = 'clinician_confirmed'),
    'allergies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', coalesce(i.name_en, c.name_en, a.free_text),
               'severity', a.severity,
               'verified', a.verification = 'confirmed' or a.source = 'clinician_confirmed')
             order by array_position(array['anaphylaxis','severe','moderate','mild']::app.allergy_severity[], a.severity))
        from app.allergies a
        left join ref.ingredients  i on i.code = a.ingredient_code
        left join ref.drug_classes c on c.code = a.drug_class_code
       where a.patient_id = v_s.patient_id and a.is_active and a.verification <> 'refuted'), '[]'::jsonb),
    'chronic_conditions', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(ic.title_en, co.free_text), 'since_year', co.onset_year))
        from app.conditions co left join ref.icd10_codes ic on ic.code = co.icd10_code
       where co.patient_id = v_s.patient_id and co.is_chronic and co.status = 'active'), '[]'::jsonb),
    'current_medications', coalesce((
      select jsonb_agg(jsonb_build_object('name', d.brand_name || ' ' || d.strength, 'dose_text', ms.dose_text))
        from app.medication_statements ms join ref.drugs d on d.id = ms.drug_id
       where ms.patient_id = v_s.patient_id and ms.status = 'active'
         and (ms.effective_until is null or ms.effective_until >= current_date)), '[]'::jsonb),
    'has_shared_contacts',
      private.has_consent(v_s.patient_id, 'emergency_contacts_share')
      and exists (select 1 from app.emergency_contacts ec where ec.patient_id = v_s.patient_id
                   and ec.deleted_at is null and ec.share_with_emergency),
    'generated_at', now()
  );
end $$;

-- Returns ENCRYPTED contact fields; the backend decrypts (keys never enter the DB).
create or replace function private.get_emergency_contacts(p_session_id uuid)
returns table (full_name_enc text, relationship text, phone_enc text, priority smallint)
language plpgsql security definer set search_path = '' as $$
declare v_s app.emergency_sessions := private.active_emergency_session(p_session_id);
begin
  if not private.has_consent(v_s.patient_id, 'emergency_contacts_share') then
    raise exception 'contacts_not_shared' using errcode = 'P0004';
  end if;
  return query
    select ec.full_name_enc, ec.relationship, ec.phone_enc, ec.priority
      from app.emergency_contacts ec
     where ec.patient_id = v_s.patient_id and ec.deleted_at is null and ec.share_with_emergency
     order by ec.priority, ec.created_at;
  if not found then raise exception 'contacts_not_shared' using errcode = 'P0004'; end if;
end $$;

create or replace function private.extend_emergency_session(p_session_id uuid, p_reason text)
returns app.emergency_sessions
language plpgsql security definer set search_path = '' as $$
declare v_s app.emergency_sessions := private.active_emergency_session(p_session_id);
begin
  if v_s.extended then raise exception 'already_extended' using errcode = 'P0001'; end if;
  if coalesce(char_length(p_reason), 0) < 5 then raise exception 'reason required' using errcode = 'P0001'; end if;
  update app.emergency_sessions set extended = true, extend_reason = p_reason, expires_at = expires_at + interval '30 minutes'
   where id = v_s.id returning * into v_s;
  return v_s;
end $$;

-- ===== Biometrics =====
-- 1:N search for paramedics. Probe is already TRANSFORMED by ai-service (SD-03).
create or replace function private.match_face(
  p_probe extensions.vector(512), p_model_version text, p_transform_version int, p_k int default 5
) returns table (patient_id uuid, similarity real)
language plpgsql security definer set search_path = '' as $$
begin
  if private.current_app_role() <> 'paramedic' or not private.is_verified_practitioner() then
    raise exception 'paramedic with verified licence required' using errcode = '42501';
  end if;
  perform set_config('hnsw.ef_search', '100', true);
  return query
    with nn as (
      select ft.patient_id as pid,
             (1 - (ft.template operator(extensions.<=>) p_probe))::real as sim
        from biometric.face_templates ft
       where ft.is_active and ft.model_version = p_model_version
         and ft.transform_key_version = p_transform_version
       order by ft.template operator(extensions.<=>) p_probe
       limit greatest(p_k, 1) * 3)
    select nn.pid, max(nn.sim) from nn group by nn.pid order by 2 desc limit greatest(p_k, 1);
end $$;

-- Used at enrolment: answers only yes/no so a patient learns nothing about others.
create or replace function private.face_duplicate_exists(
  p_probe extensions.vector(512), p_model_version text, p_transform_version int, p_threshold real
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if private.current_app_role() <> 'patient' then
    raise exception 'patient only' using errcode = '42501';
  end if;
  perform set_config('hnsw.ef_search', '100', true);
  return exists (
    select 1 from (
      select ft.patient_id, (1 - (ft.template operator(extensions.<=>) p_probe))::real as sim
        from biometric.face_templates ft
       where ft.is_active and ft.model_version = p_model_version and ft.transform_key_version = p_transform_version
       order by ft.template operator(extensions.<=>) p_probe limit 5) x
    where x.sim >= p_threshold and x.patient_id <> (select auth.uid()));
end $$;

-- 1:1 verification at a pharmacy (patient resolved from the prescription by the backend).
create or replace function private.verify_face(
  p_patient_id uuid, p_probe extensions.vector(512), p_model_version text, p_transform_version int
) returns real
language plpgsql security definer set search_path = '' as $$
declare v_sim real;
begin
  if private.current_app_role() not in ('pharmacist') or not private.is_verified_practitioner() then
    raise exception 'pharmacist with verified licence required' using errcode = '42501';
  end if;
  select max((1 - (ft.template operator(extensions.<=>) p_probe))::real) into v_sim
    from biometric.face_templates ft
   where ft.patient_id = p_patient_id and ft.is_active
     and ft.model_version = p_model_version and ft.transform_key_version = p_transform_version;
  return v_sim;   -- NULL = no template
end $$;

create or replace function private.enroll_face_template(
  p_template extensions.vector(512), p_model_version text, p_transform_version int,
  p_quality real, p_liveness real, p_source text default 'enrollment'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if private.current_app_role() <> 'patient' then raise exception 'patient only' using errcode = '42501'; end if;
  if not private.has_consent(v_uid, 'biometric_face') then
    raise exception 'consent_required' using errcode = 'P0005';
  end if;
  insert into biometric.face_templates (patient_id, template, model_version, transform_key_version,
                                        quality_score, liveness_score, source)
  values (v_uid, p_template, p_model_version, p_transform_version, p_quality, p_liveness, p_source)
  returning id into v_id;
  -- keep at most 3 active templates per patient and model (newest win)
  update biometric.face_templates set is_active = false
   where id in (select id from biometric.face_templates
                 where patient_id = v_uid and model_version = p_model_version and is_active
                 order by created_at desc offset 3);
  return v_id;
end $$;

create or replace function private.delete_my_face_templates() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from biometric.face_templates where patient_id = (select auth.uid());
  get diagnostics v_n = row_count;
  insert into app.consents (patient_id, consent_type, version, granted)
  select (select auth.uid()), 'biometric_face', 'withdrawal', false
   where exists (select 1 from app.patients where id = (select auth.uid()));
  return v_n;
end $$;

create or replace function private.record_biometric_attempt(
  p_purpose text, p_result text, p_top real, p_second real, p_liveness real, p_model text
) returns void
language sql security definer set search_path = '' as $$
  insert into biometric.attempts (actor_id, purpose, result, top_score, second_score, liveness_score, model_version)
  values ((select auth.uid()), p_purpose, p_result, p_top, p_second, p_liveness, p_model);
$$;

create or replace function private.recent_liveness_failures(p_minutes int) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from biometric.attempts
   where actor_id = (select auth.uid()) and result = 'liveness_failed'
     and created_at > now() - make_interval(mins => p_minutes);
$$;

-- ===== Self-service security =====
create or replace function private.bump_my_session_epoch() returns int
language sql security definer set search_path = '' as $$
  update app.profiles set session_epoch = session_epoch + 1 where id = (select auth.uid()) returning session_epoch;
$$;

create or replace function private.patient_access_log(p_limit int default 50, p_before timestamptz default null)
returns table (occurred_at timestamptz, actor_name text, actor_role text, action text, facility_name text)
language sql stable security definer set search_path = '' as $$
  select l.occurred_at, pr.full_name, l.actor_role, l.action,
         (select f.name from app.practitioner_facilities pf join app.facilities f on f.id = pf.facility_id
           where pf.practitioner_id = l.actor_id and pf.ended_at is null order by pf.started_at desc limit 1)
    from audit.system_logs l
    left join app.profiles pr on pr.id = l.actor_id
   where l.patient_id = (select auth.uid())
     and l.actor_id is distinct from (select auth.uid())
     and l.action in ('PATIENT_RECORD_READ','EMERGENCY_PROFILE_READ','EMERGENCY_CONTACTS_READ','RX_DISPENSED',
                      'PRESCRIPTIONS_INSERT','ENCOUNTERS_INSERT','DIAGNOSES_INSERT','ALLERGIES_INSERT','RX_VERIFIED')
     and (p_before is null or l.occurred_at < p_before)
     and l.occurred_at > now() - interval '12 months'
   order by l.occurred_at desc
   limit least(greatest(p_limit, 1), 100);
$$;

-- ===== Admin =====
create or replace function private.assert_admin(p_recent_auth boolean default false) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_app_role() <> 'admin' then raise exception 'admin only' using errcode = '42501'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'aal2 required' using errcode = '42501'; end if;
  if p_recent_auth and coalesce((auth.jwt() ->> 'auth_time')::bigint, 0) < extract(epoch from now())::bigint - 300 then
    raise exception 'recent re-authentication required' using errcode = '42501';
  end if;
  return (select auth.uid());
end $$;

create or replace function private.admin_set_user_status(p_user uuid, p_status app.account_status, p_reason text)
returns app.profiles
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.assert_admin(true); v_row app.profiles;
begin
  if p_user = v_admin then raise exception 'cannot change own status' using errcode = '42501'; end if;
  update app.profiles set status = p_status, session_epoch = session_epoch + 1 where id = p_user returning * into v_row;
  perform private.log_event('USER_STATUS_CHANGED', 'profile', p_user, null, 'success', p_reason,
                            jsonb_build_object('status', p_status));
  return v_row;
end $$;

create or replace function private.admin_create_practitioner(
  p_user uuid, p_type app.app_role, p_license_number text, p_license_authority text,
  p_license_expires_at date, p_specialty_code text, p_facility_ids uuid[]
) returns app.practitioners
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.assert_admin(); v_row app.practitioners; v_f uuid;
begin
  update app.profiles set role = p_type where id = p_user;
  insert into app.practitioners (id, practitioner_type, license_number, license_authority, license_expires_at, specialty_code)
  values (p_user, p_type, p_license_number, coalesce(p_license_authority, 'EG-MOH'), p_license_expires_at, p_specialty_code)
  returning * into v_row;
  foreach v_f in array coalesce(p_facility_ids, '{}') loop
    insert into app.practitioner_facilities (practitioner_id, facility_id) values (p_user, v_f);
  end loop;
  return v_row;
end $$;

create or replace function private.admin_set_license_status(
  p_practitioner uuid, p_status app.license_status, p_reason text, p_expires date default null
) returns app.practitioners
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.assert_admin(true); v_row app.practitioners;
begin
  if p_practitioner = v_admin then raise exception 'cannot change own licence' using errcode = '42501'; end if;
  update app.practitioners
     set license_status = p_status, license_status_changed_at = now(),
         license_expires_at = coalesce(p_expires, license_expires_at),
         verified_by = case when p_status = 'verified' then v_admin else verified_by end,
         verified_at = case when p_status = 'verified' then now() else verified_at end
   where id = p_practitioner returning * into v_row;

  if p_status in ('suspended','revoked') then
    update app.profiles set session_epoch = session_epoch + 1 where id = p_practitioner;
  end if;
  if p_status = 'revoked' then          -- E-LIC-02: invalidate open prescriptions
    update app.prescriptions set prescriber_invalid = true
     where doctor_id = p_practitioner and status in ('pending','partially_dispensed');
  end if;
  perform private.log_event('LICENSE_STATUS_CHANGED', 'practitioner', p_practitioner, null, 'success', p_reason,
                            jsonb_build_object('license_status', p_status));
  return v_row;
end $$;

create or replace function private.admin_activate_staff(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.assert_admin();
begin
  update app.profiles set status = 'active' where id = p_user and role <> 'patient';
end $$;

create or replace function private.admin_review_emergency_session(p_session uuid, p_outcome text, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.assert_admin();
begin
  update app.emergency_sessions
     set review_status = p_outcome, reviewed_by = v_admin, reviewed_at = now(), review_note = left(p_note, 1000)
   where id = p_session;
end $$;

create or replace function private.admin_search_audit(
  p_actor uuid default null, p_action text default null, p_patient uuid default null,
  p_outcome audit.outcome default null, p_from timestamptz default null, p_to timestamptz default null,
  p_limit int default 50, p_before_seq bigint default null
) returns setof audit.system_logs
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return query
    select * from audit.system_logs l
     where (p_actor is null or l.actor_id = p_actor)
       and (p_action is null or l.action = p_action)
       and (p_patient is null or l.patient_id = p_patient)
       and (p_outcome is null or l.outcome = p_outcome)
       and (p_from is null or l.occurred_at >= p_from)
       and (p_to is null or l.occurred_at < p_to)
       and (p_before_seq is null or l.chain_seq < p_before_seq)
     order by l.chain_seq desc
     limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function private.admin_verify_audit_chain()
returns table (ok boolean, checked bigint, broken_at_seq bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return query select * from private.verify_audit_chain();
end $$;

-- ===== Grants =====
grant execute on function
  private.onboard_patient(text, text, bytea, date, app.sex, app.blood_type, text),
  private.redeem_share_code(text, bytea),
  private.find_prescription_for_pharmacy(text),
  private.open_pharmacy_context(uuid, uuid, app.verification_method, text),
  private.open_emergency_session(uuid, app.emergency_id_method, real, real, boolean, boolean, text, text, numeric, numeric, uuid),
  private.get_emergency_profile(uuid),
  private.get_emergency_contacts(uuid),
  private.extend_emergency_session(uuid, text),
  private.match_face(extensions.vector, text, int, int),
  private.face_duplicate_exists(extensions.vector, text, int, real),
  private.verify_face(uuid, extensions.vector, text, int),
  private.enroll_face_template(extensions.vector, text, int, real, real, text),
  private.delete_my_face_templates(),
  private.record_biometric_attempt(text, text, real, real, real, text),
  private.recent_liveness_failures(int),
  private.bump_my_session_epoch(),
  private.patient_access_log(int, timestamptz),
  private.admin_set_user_status(uuid, app.account_status, text),
  private.admin_create_practitioner(uuid, app.app_role, text, text, date, text, uuid[]),
  private.admin_set_license_status(uuid, app.license_status, text, date),
  private.admin_activate_staff(uuid),
  private.admin_review_emergency_session(uuid, text, text),
  private.admin_search_audit(uuid, text, uuid, audit.outcome, timestamptz, timestamptz, int, bigint),
  private.admin_verify_audit_chain()
to authenticated;
