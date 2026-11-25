\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(p uuid, p_role text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p,'app_role',p_role,'aal','aal2',
     'auth_time', extract(epoch from now())::bigint)::text, true); $$;

create or replace function pg_temp.rand_unit_vec(seed float) returns extensions.vector language plpgsql as $$
declare a float8[]; n float8 := 0; i int; begin perform setseed(seed);
 for i in 1..512 loop a[i] := random()-0.5; n := n + a[i]*a[i]; end loop;
 for i in 1..512 loop a[i] := a[i]/sqrt(n); end loop; return a::extensions.vector; end $$;

-- Mona enrolls a face template
begin;
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000001','patient') \gset
do $$
declare
  v_dup boolean;
  v_tid uuid;
begin
  v_dup := private.face_duplicate_exists(pg_temp.rand_unit_vec(0.11), 'buffalo_l-arcface-r50@1', 1, 0.5);
  if v_dup then
    raise exception 'T17 FAILED: unexpected duplicate before enrollment';
  end if;
  v_tid := private.enroll_face_template(pg_temp.rand_unit_vec(0.11), 'buffalo_l-arcface-r50@1', 1, 0.8, 0.95);
  if v_tid is null then
    raise exception 'T17 FAILED: enroll_face_template returned null';
  end if;
end $$;
commit;

-- T17 & T18: Duplicate face detected; Hany lacks consent (P0005); patient cannot match_face; biometric.* inaccessible
begin;
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000002','patient') \gset
do $$
declare v_dup boolean;
begin
  v_dup := private.face_duplicate_exists(pg_temp.rand_unit_vec(0.11), 'buffalo_l-arcface-r50@1', 1, 0.5);
  if not v_dup then
    raise exception 'T17 FAILED: duplicate face not detected for Hany';
  end if;
end $$;

do $$
begin
  perform private.enroll_face_template(pg_temp.rand_unit_vec(0.22), 'buffalo_l-arcface-r50@1', 1, 0.8, 0.95);
  raise exception 'T17 FAILED: missing consent not rejected';
exception when sqlstate 'P0005' then
  raise notice 'T17 OK: consent required for enrolment';
end $$;

do $$
begin
  perform * from private.match_face(pg_temp.rand_unit_vec(0.11), 'buffalo_l-arcface-r50@1', 1, 5);
  raise exception 'T18 FAILED: patient ran 1:N search';
exception when insufficient_privilege then
  raise notice 'T18 OK: patient cannot 1:N search';
end $$;

do $$
begin
  perform count(*) from biometric.face_templates;
  raise exception 'T18 FAILED: biometric schema readable';
exception when insufficient_privilege then
  raise notice 'T18 OK: biometric schema not readable';
end $$;
commit;

-- T19 & T20: Paramedic identifies Mona; 0 direct rows on patients/diagnoses; closed emergency JSON shape
begin;
set local role authenticated;
select pg_temp.as_user('e0000000-0000-4000-8000-000000000001','paramedic') \gset
do $$
declare
  v_pid uuid;
  v_sim float;
  v_p_cnt int;
  v_d_cnt int;
begin
  select patient_id, similarity into v_pid, v_sim
    from private.match_face(pg_temp.rand_unit_vec(0.11), 'buffalo_l-arcface-r50@1', 1, 5)
   limit 1;
  if v_pid <> 'b0000000-0000-4000-8000-000000000001' or round(v_sim::numeric, 3) < 0.999 then
    raise exception 'T19 FAILED: pid=% sim=%', v_pid, v_sim;
  end if;
  select count(*) into v_p_cnt from app.patients;
  select count(*) into v_d_cnt from app.diagnoses;
  if v_p_cnt <> 0 or v_d_cnt <> 0 then
    raise exception 'T19 FAILED: paramedic saw direct rows patients=% diagnoses=%', v_p_cnt, v_d_cnt;
  end if;
end $$;

select id as sid from private.open_emergency_session('b0000000-0000-4000-8000-000000000001','face',0.99,0.5,false,false,'unconscious','AMB-1',30.59,32.27,'12345678-0000-4000-8000-000000000001') \gset

do $$
declare
  v_prof jsonb;
  v_keys text[];
  v_expected text[] := array[
    'allergies',
    'blood_type',
    'chronic_conditions',
    'current_medications',
    'generated_at',
    'has_shared_contacts',
    'patient',
    'session'
  ];
  v_contact_cnt int;
begin
  v_prof := private.get_emergency_profile(:'sid');
  select array_agg(k order by k) into v_keys from jsonb_object_keys(v_prof) as k;
  if v_keys <> v_expected then
    raise exception 'T20 FAILED: emergency profile keys=% expected=%', v_keys, v_expected;
  end if;
  select count(*) into v_contact_cnt from private.get_emergency_contacts(:'sid');
  if v_contact_cnt < 1 then
    raise exception 'T20 FAILED: expected emergency contacts';
  end if;
end $$;
commit;

do $$
declare v_notif int;
begin
  select count(*) into v_notif from app.notifications where template='emergency_profile_accessed';
  if v_notif < 1 then
    raise exception 'T20 FAILED: patient not notified of emergency access';
  end if;
end $$;

-- T21: Expired session rejected (P0003)
update app.emergency_sessions set expires_at = now() - interval '1 minute';
begin;
set local role authenticated;
select pg_temp.as_user('e0000000-0000-4000-8000-000000000001','paramedic') \gset
do $$
begin
  perform private.get_emergency_profile((select id from app.emergency_sessions limit 1));
  raise exception 'T21 FAILED: expired emergency session allowed';
exception when sqlstate 'P0003' then
  raise notice 'T21 OK: expired session rejected';
end $$;
commit;

-- T22: Patient revokes doctor grant -> doctor sees 0 patient rows immediately
begin;
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000001','patient') \gset
update app.access_grants set status='revoked', revoked_at=now(), revoked_by=auth.uid() where patient_id=auth.uid();
do $$
declare v_cnt int;
begin
  select count(*) into v_cnt from private.patient_access_log(50, null);
  if v_cnt < 1 then
    raise exception 'T22 FAILED: expected access log entries for patient';
  end if;
end $$;
commit;

begin;
set local role authenticated;
select pg_temp.as_user('d0000000-0000-4000-8000-000000000001','doctor') \gset
do $$
declare
  v_pat int;
  v_rx int;
begin
  select count(*) into v_pat from app.patients;
  select count(*) into v_rx from app.prescriptions;
  if v_pat <> 0 or v_rx < 1 then
    raise exception 'T22 FAILED: doctor patients=% own_rx=%', v_pat, v_rx;
  end if;
end $$;
commit;

-- T23: Licence revoke -> is_verified_practitioner() false & session_epoch bumped
begin;
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002','admin') \gset
do $$
declare v_status app.license_status;
begin
  select license_status into v_status from private.admin_set_license_status('d0000000-0000-4000-8000-000000000001','revoked','fraud investigation');
  if v_status <> 'revoked' then
    raise exception 'T23 FAILED: license_status=%', v_status;
  end if;
end $$;
commit;

do $$
declare v_epoch int;
begin
  select session_epoch into v_epoch from app.profiles where id='d0000000-0000-4000-8000-000000000001';
  if v_epoch < 2 then
    raise exception 'T23 FAILED: session_epoch expected >=2, got %', v_epoch;
  end if;
end $$;

begin;
set local role authenticated;
select pg_temp.as_user('d0000000-0000-4000-8000-000000000001','doctor') \gset
do $$
begin
  if private.is_verified_practitioner() then
    raise exception 'T23 FAILED: revoked doctor still verified';
  end if;
end $$;
commit;

-- T24 & T25: Audit chain intact, update blocked (42501), superuser tamper detected at seq 5
do $$
declare
  v_ok boolean;
  v_checked bigint;
begin
  select ok, checked into v_ok, v_checked from private.verify_audit_chain();
  if not v_ok or v_checked <= 20 then
    raise exception 'T24/T25 FAILED: initial audit chain ok=% checked=%', v_ok, v_checked;
  end if;
end $$;

do $$
begin
  update audit.system_logs set reason='x' where chain_seq=1;
  raise exception 'T24 FAILED: audit update succeeded';
exception when insufficient_privilege then
  raise notice 'T24 OK: audit update blocked';
end $$;

alter table audit.system_logs disable trigger no_update_delete;   -- simulate a superuser attacker
update audit.system_logs set reason='tampered' where chain_seq=5;
alter table audit.system_logs enable trigger no_update_delete;

do $$
declare
  v_ok boolean;
  v_broken bigint;
begin
  select ok, broken_at_seq into v_ok, v_broken from private.verify_audit_chain();
  if v_ok or v_broken <> 5 then
    raise exception 'T25 FAILED: tamper detection expected ok=false broken_at_seq=5, got ok=% seq=%', v_ok, v_broken;
  end if;
end $$;
