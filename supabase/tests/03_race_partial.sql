\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(p uuid, p_role text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',p,'app_role',p_role,'aal','aal2',
     'auth_time', extract(epoch from now())::bigint)::text, true); $$;

-- T15: Pharmacy A dispenses item 1 fully (partial for the prescription)
begin;
set local role authenticated;
select pg_temp.as_user('c0000000-0000-4000-8000-000000000001','pharmacist');
select id as vid from app.rx_verifications where pharmacist_id = auth.uid() order by created_at desc limit 1 \gset
select 1 from app.prescriptions where id='99999999-0000-4000-8000-000000000001' for update;
insert into app.dispensations(id, prescription_id, pharmacy_id, pharmacist_id, verification_id, verification_method, idempotency_key, pickup_jti)
 values ('dddddddd-0000-4000-8000-000000000001','99999999-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000f003',auth.uid(), :'vid','pickup_token', gen_random_uuid(), 'jti-1');
insert into app.dispensation_items(dispensation_id, prescription_item_id, quantity)
 values ('dddddddd-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001',14);
commit;

do $$
declare
  v_rx_status app.rx_status;
  v_i1_status app.rx_item_status;
  v_i2_status app.rx_item_status;
begin
  select status into v_rx_status from app.prescriptions where id = '99999999-0000-4000-8000-000000000001';
  select status into v_i1_status from app.prescription_items where id = '11111111-0000-4000-8000-000000000001';
  select status into v_i2_status from app.prescription_items where id = '11111111-0000-4000-8000-000000000002';
  if v_rx_status <> 'partially_dispensed' or v_i1_status <> 'dispensed' or v_i2_status <> 'pending' then
    raise exception 'T15 FAILED: rx=% item1=% item2=%', v_rx_status, v_i1_status, v_i2_status;
  end if;
end $$;
