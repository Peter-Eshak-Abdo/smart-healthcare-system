\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(p uuid, p_role text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p,'app_role',p_role,'aal','aal2',
     'auth_time', extract(epoch from now())::bigint)::text, true); $$;

\set mona '''b0000000-0000-4000-8000-000000000001'''
\set hany '''b0000000-0000-4000-8000-000000000002'''
\set karim '''d0000000-0000-4000-8000-000000000001'''
\set other_doc '''d0000000-0000-4000-8000-000000000002'''

-- Patients onboard (Mona)
begin;
set local role authenticated;
select pg_temp.as_user(:mona,'patient') \gset
select 1 from private.onboard_patient('national_id','v1.k1.iv.ct.tag','\x01','1990-01-01','female','O+','2026-10');
insert into app.consents(patient_id, consent_type, version, granted)
  values (auth.uid(),'emergency_contacts_share','2026-10',true),
         (auth.uid(),'biometric_face','2026-10',true);
insert into app.emergency_contacts(patient_id, full_name_enc, relationship, phone_enc, priority)
  values (auth.uid(),'enc-name','father','enc-phone',1);
insert into app.allergies(patient_id, allergen_type, drug_class_code, severity, reaction, source)
  values (auth.uid(),'drug_class','CLS-PENICILLINS','anaphylaxis','Throat swelling','patient_reported');
insert into app.share_codes(patient_id, code_hmac) values (auth.uid(), '\xaabbcc');

-- T04: Patient cannot update own role (column grant)
do $$
begin
  update app.profiles set role='admin' where id = auth.uid();
  raise exception 'T04 FAILED: patient updated own role';
exception when insufficient_privilege then
  raise notice 'T04 OK: patient cannot update role (%)', sqlerrm;
end $$;
commit;

-- T03 & T05: Duplicate national ID blocked (23505) & Patient B sees 0 rows of Patient A
begin;
set local role authenticated;
select pg_temp.as_user(:hany,'patient') \gset
do $$
begin
  perform private.onboard_patient('national_id','x','\x01','1980-01-01','male',null,'2026-10');
  raise exception 'T03 FAILED: duplicate national id allowed';
exception when unique_violation then
  raise notice 'T03 OK: duplicate national id blocked (%)', sqlerrm;
end $$;

do $$
declare v_cnt int;
begin
  select count(*) into v_cnt from app.patients where id = 'b0000000-0000-4000-8000-000000000001';
  if v_cnt <> 0 then
    raise exception 'T05 FAILED: patient B saw patient A rows (%)', v_cnt;
  end if;
end $$;
commit;

select mrn as mona_mrn from app.patients where id=:mona \gset

-- T06 & T07: Doctor sees 0 rows before grant; wrong share code returns NULL and increments counter
begin;
set local role authenticated;
select pg_temp.as_user(:karim,'doctor') \gset
do $$
declare
  v_cnt int;
  v_res record;
begin
  select count(*) into v_cnt from app.patients where id = 'b0000000-0000-4000-8000-000000000001';
  if v_cnt <> 0 then
    raise exception 'T06 FAILED: doctor read patient before grant (%)', v_cnt;
  end if;
end $$;
do $$
declare v_grant app.access_grants;
begin
  v_grant := private.redeem_share_code(:'mona_mrn', '\x000000');
  if v_grant.id is not null then
    raise exception 'T07 FAILED: wrong share code did not return null';
  end if;
end $$;
commit;

do $$
declare v_attempts smallint;
begin
  select failed_attempts into v_attempts from app.share_codes where patient_id = 'b0000000-0000-4000-8000-000000000001';
  if v_attempts <> 1 then
    raise exception 'T07 FAILED: failed_attempts expected 1, got %', v_attempts;
  end if;
end $$;

-- T08 & T09: Right share code creates read_write grant; doctor condition source forced to clinician_confirmed
begin;
set local role authenticated;
select pg_temp.as_user(:karim,'doctor') \gset
do $$
declare
  v_grant app.access_grants;
  v_cnt int;
  v_src app.entry_source;
begin
  v_grant := private.redeem_share_code(:'mona_mrn', '\xaabbcc');
  if v_grant.status <> 'active' or v_grant.scope <> 'read_write' then
    raise exception 'T08 FAILED: unexpected grant status=% scope=%', v_grant.status, v_grant.scope;
  end if;
  select count(*) into v_cnt from app.patients where id = 'b0000000-0000-4000-8000-000000000001';
  if v_cnt <> 1 then
    raise exception 'T08 FAILED: doctor expected 1 patient after grant, got %', v_cnt;
  end if;

  insert into app.encounters(id, patient_id, doctor_id, facility_id)
    values ('eeeeeeee-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', auth.uid(), '00000000-0000-4000-8000-00000000f002');
  insert into app.diagnoses(encounter_id, patient_id, icd10_code, is_primary, recorded_by)
    values ('eeeeeeee-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'J45.909', true, auth.uid());
  insert into app.conditions(patient_id, icd10_code, is_chronic, source)
    values ('b0000000-0000-4000-8000-000000000001','J45.909',true,'patient_reported');

  select source into v_src from app.conditions where patient_id = 'b0000000-0000-4000-8000-000000000001' limit 1;
  if v_src <> 'clinician_confirmed' then
    raise exception 'T09 FAILED: condition source expected clinician_confirmed, got %', v_src;
  end if;
end $$;

-- Prescription (2 items) — signed in same tx
insert into app.prescriptions(id, patient_id, doctor_id, facility_id, encounter_id, expires_at, verification_code_hash)
 values ('99999999-0000-4000-8000-000000000001', :mona, :karim, '00000000-0000-4000-8000-00000000f002', 'eeeeeeee-0000-4000-8000-000000000001', now()+interval '30 days', '$argon2id$dummy');
insert into app.prescription_items(id, prescription_id, drug_id, dose, route, frequency, duration_days, quantity_prescribed, quantity_unit)
 select '11111111-0000-4000-8000-000000000001','99999999-0000-4000-8000-000000000001', id, '1 tablet','oral','twice_daily',7,14,'tablet' from ref.drugs where code='DRG-PANADOL-500';
insert into app.prescription_items(id, prescription_id, drug_id, dose, route, frequency, duration_days, quantity_prescribed, quantity_unit)
 select '11111111-0000-4000-8000-000000000002','99999999-0000-4000-8000-000000000001', id, '1 tablet','oral','once_daily',30,30,'tablet' from ref.drugs where code='DRG-ASPOCID-75';
update app.prescriptions set signature='\x01', signature_kid='rx-2026-11', payload_sha256='\x02' where id='99999999-0000-4000-8000-000000000001';
commit;

do $$
declare v_ms int;
begin
  select count(*) into v_ms from app.medication_statements where prescription_id = '99999999-0000-4000-8000-000000000001';
  if v_ms <> 2 then
    raise exception 'Expected 2 medication_statements, got %', v_ms;
  end if;
end $$;

-- T10: Unsigned prescription fails at COMMIT (deferred constraint rx_must_be_signed = 23514)
begin;
set local role authenticated;
select pg_temp.as_user(:karim,'doctor') \gset
insert into app.prescriptions(id, patient_id, doctor_id, facility_id, encounter_id, expires_at, verification_code_hash)
 values ('99999999-0000-4000-8000-000000000099', :mona, :karim, '00000000-0000-4000-8000-00000000f002', 'eeeeeeee-0000-4000-8000-000000000001', now()+interval '30 days', 'h');
do $$
begin
  set constraints all immediate;
  raise exception 'T10 FAILED: unsigned rx allowed';
exception when check_violation then
  raise notice 'T10 OK: unsigned rx rejected with 23514 (%)', sqlerrm;
end $$;
rollback;

-- T11 & T12: Signature write-once (42501) & Doctor cannot mark item dispensed
begin;
set local role authenticated;
select pg_temp.as_user(:karim,'doctor') \gset
do $$
begin
  update app.prescriptions set signature='\x09' where id='99999999-0000-4000-8000-000000000001';
  raise exception 'T11 FAILED: signature rewrite allowed';
exception when insufficient_privilege then
  raise notice 'T11 OK: signature write-once (%)', sqlerrm;
end $$;

do $$
begin
  update app.prescription_items set status='dispensed' where id='11111111-0000-4000-8000-000000000001';
  raise exception 'T12 FAILED: doctor marked item dispensed';
exception when insufficient_privilege or check_violation then
  raise notice 'T12 OK: doctor cannot mark dispensed (%)', sqlerrm;
end $$;
commit;

-- T13: Other doctor (no grant) cannot see prescription
begin;
set local role authenticated;
select pg_temp.as_user(:other_doc,'doctor') \gset
do $$
declare v_cnt int;
begin
  select count(*) into v_cnt from app.prescriptions;
  if v_cnt <> 0 then
    raise exception 'T13 FAILED: other doctor saw % rx rows', v_cnt;
  end if;
end $$;
commit;

-- T14: Pharmacist without context sees 0 rows; opens context; sees 1 rx + allergies, 0 diagnoses
begin;
set local role authenticated;
select pg_temp.as_user('c0000000-0000-4000-8000-000000000001','pharmacist') \gset
do $$
declare
  v_before int;
  v_after int;
  v_allergies int;
  v_diag int;
  v_ctx jsonb;
begin
  select count(*) into v_before from app.prescriptions;
  if v_before <> 0 then
    raise exception 'T14 FAILED: pharmacist saw % rx before context', v_before;
  end if;
  v_ctx := private.open_pharmacy_context('99999999-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000f003','pickup_token','jti-1');
  if (v_ctx->>'status') <> 'ok' then
    raise exception 'T14 FAILED: open_pharmacy_context failed: %', v_ctx;
  end if;
  select count(*) into v_after from app.prescriptions;
  select count(*) into v_allergies from app.allergies;
  select count(*) into v_diag from app.diagnoses;
  if v_after <> 1 or v_allergies < 1 or v_diag <> 0 then
    raise exception 'T14 FAILED: after=% allergies=% diag=%', v_after, v_allergies, v_diag;
  end if;
end $$;
commit;

begin;
set local role authenticated;
select pg_temp.as_user('c0000000-0000-4000-8000-000000000002','pharmacist') \gset
select result from private.open_pharmacy_context('99999999-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000f004','sms_otp',null);
commit;
