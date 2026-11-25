\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(p uuid, p_role text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p,'app_role',p_role,'aal','aal2','auth_time', extract(epoch from now())::bigint)::text, true); $$;

begin;
set local role authenticated;
select pg_temp.as_user(:'who','pharmacist');
select id as vid from app.rx_verifications where pharmacist_id = auth.uid() order by created_at desc limit 1 \gset
-- deliberately NO "FOR UPDATE" here: proves the trigger + CHECK alone prevent over-dispensing
insert into app.dispensations(prescription_id, pharmacy_id, pharmacist_id, verification_id, verification_method, idempotency_key)
 values ('99999999-0000-4000-8000-000000000001', :'pharmacy', auth.uid(), :'vid', 'sms_otp', gen_random_uuid());
select pg_sleep(1);
insert into app.dispensation_items(dispensation_id, prescription_item_id, quantity)
 select id, '11111111-0000-4000-8000-000000000002', 30 from app.dispensations where pharmacist_id=auth.uid() order by dispensed_at desc limit 1;
select pg_sleep(1);
commit;
\echo DISPENSE_SUCCESS
