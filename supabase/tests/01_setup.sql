\set ON_ERROR_STOP 1

-- Bootstrap (as postgres / service role)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001','admin@sh.test','{"invited_role":"admin"}','{}'),
 ('a0000000-0000-4000-8000-000000000002','admin2@sh.test','{"invited_role":"admin"}','{}'),
 ('d0000000-0000-4000-8000-000000000001','karim@sh.test','{"invited_role":"doctor"}','{"full_name":"Dr. Karim Nabil"}'),
 ('d0000000-0000-4000-8000-000000000002','other@sh.test','{"invited_role":"doctor"}','{"full_name":"Dr. Other"}'),
 ('c0000000-0000-4000-8000-000000000001','salma@sh.test','{"invited_role":"pharmacist"}','{"full_name":"Dr. Salma"}'),
 ('c0000000-0000-4000-8000-000000000002','nour@sh.test','{"invited_role":"pharmacist"}','{"full_name":"Dr. Nour"}'),
 ('e0000000-0000-4000-8000-000000000001','ahmed@sh.test','{"invited_role":"paramedic"}','{"full_name":"Ahmed Paramedic"}'),
 ('b0000000-0000-4000-8000-000000000001','mona@sh.test','{}','{"full_name":"Mona Adel","role":"doctor"}'),
 ('b0000000-0000-4000-8000-000000000002','hany@sh.test','{}','{"full_name":"Hany Samir"}');

update app.profiles set status='active' where role='admin';

-- T01: role in user metadata is ignored; escalation attempt logged
do $$
declare
  v_role app.app_role;
  v_log_cnt int;
begin
  select role into v_role from app.profiles where id = 'b0000000-0000-4000-8000-000000000001';
  if v_role <> 'patient' then
    raise exception 'T01 FAILED: expected patient role, got %', v_role;
  end if;
  select count(*) into v_log_cnt
    from audit.system_logs
   where action = 'ROLE_ESCALATION_ATTEMPT'
     and actor_id = 'b0000000-0000-4000-8000-000000000001';
  if v_log_cnt < 1 then
    raise exception 'T01 FAILED: ROLE_ESCALATION_ATTEMPT not logged';
  end if;
end $$;

create or replace function pg_temp.as_user(p uuid, p_role text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p,'app_role',p_role,'aal','aal2',
     'auth_time', extract(epoch from now())::bigint)::text, true); $$;

begin;
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001','admin');

-- T02: Admin cannot suspend self (42501)
do $$
begin
  perform private.admin_set_user_status('a0000000-0000-4000-8000-000000000001', 'suspended', 'self test');
  raise exception 'T02 FAILED: admin suspended self';
exception when insufficient_privilege then
  raise notice 'T02 OK: admin cannot suspend self (%)', sqlerrm;
end $$;

select private.admin_create_practitioner('d0000000-0000-4000-8000-000000000001','doctor','EG-MD-123456',null,'2028-01-01','internal_medicine',array['00000000-0000-4000-8000-00000000f002'::uuid]);
select private.admin_create_practitioner('d0000000-0000-4000-8000-000000000002','doctor','EG-MD-999999',null,'2028-01-01','cardiology',array['00000000-0000-4000-8000-00000000f001'::uuid]);
select private.admin_create_practitioner('c0000000-0000-4000-8000-000000000001','pharmacist','EG-PH-111',null,'2028-01-01',null,array['00000000-0000-4000-8000-00000000f003'::uuid]);
select private.admin_create_practitioner('c0000000-0000-4000-8000-000000000002','pharmacist','EG-PH-222',null,'2028-01-01',null,array['00000000-0000-4000-8000-00000000f004'::uuid]);
select private.admin_create_practitioner('e0000000-0000-4000-8000-000000000001','paramedic','EG-PM-333',null,'2028-01-01',null,array['00000000-0000-4000-8000-00000000f005'::uuid]);
select private.admin_set_license_status(id,'verified','docs checked') from app.practitioners;
select private.admin_activate_staff(id) from app.practitioners;
commit;
