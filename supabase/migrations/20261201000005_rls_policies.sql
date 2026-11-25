-- 0005_rls_policies.sql
-- Every table in `app` has RLS enabled. Default = deny. Policies use `(select …)` wrappers so
-- Postgres evaluates helper functions once per statement (initPlan), not once per row.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
  end loop;
end $$;
alter table biometric.face_templates enable row level security;
alter table biometric.attempts       enable row level security;
alter table audit.system_logs        enable row level security;
-- biometric/audit: no policies for authenticated → always empty even if a grant slips in.

-- Table-level privileges (RLS then filters rows). Column-level UPDATE grants restrict what can change.
grant select on all tables in schema app to authenticated;
grant usage on sequence app.rx_number_seq to authenticated;

grant insert on app.consents, app.devices, app.share_codes, app.encounters, app.encounter_addenda,
               app.diagnoses, app.conditions, app.allergies, app.medication_statements,
               app.emergency_contacts, app.prescriptions, app.prescription_items, app.clinical_alerts,
               app.dispense_leases, app.dispensations, app.dispensation_items, app.emergency_sessions,
               app.assistant_sessions, app.assistant_messages, app.notifications, app.drug_requests
  to authenticated;

grant update (full_name, phone_enc, phone_bidx, preferred_locale) on app.profiles to authenticated;
grant update (blood_type, blood_type_source, blood_type_confirmed_by, blood_type_confirmed_at) on app.patients to authenticated;
grant update (last_used_at, revoked_at) on app.devices to authenticated;
grant update (status, revoked_at, revoked_by) on app.access_grants to authenticated;
grant update (chief_complaint_enc, notes_internal_enc, patient_summary_enc, visibility, status, ended_at,
              entered_in_error_reason) on app.encounters to authenticated;
grant update (status, is_chronic, free_text, icd10_code) on app.conditions to authenticated;
grant update (severity, reaction, verification, is_active, allergen_type, ingredient_code, drug_class_code, free_text)
  on app.allergies to authenticated;
grant update (status, effective_until) on app.medication_statements to authenticated;
grant update (full_name_enc, relationship, phone_enc, priority, share_with_emergency, deleted_at)
  on app.emergency_contacts to authenticated;
-- NOTE: `status` is NOT client-updatable; it is derived from item quantities/status by trigger.
grant update (signature, signature_kid, payload_sha256, cancel_reason_code, cancelled_at)
  on app.prescriptions to authenticated;
grant update (status) on app.prescription_items to authenticated;   -- quantity changes only via trigger
grant update (overridden, override_reason_code, override_justification_enc, overridden_at) on app.clinical_alerts to authenticated;
grant delete on app.dispense_leases to authenticated;
grant update (status, closed_at) on app.emergency_sessions to authenticated;
grant update (status, closed_reason, last_message_at) on app.assistant_sessions to authenticated;
grant delete on app.assistant_sessions to authenticated;

-- ============================ profiles ============================
create policy profiles_self_select on app.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_staff_directory on app.profiles for select to authenticated
  using (role in ('doctor','pharmacist','paramedic'));                     -- professional identity is public within the platform
create policy profiles_granted_patient on app.profiles for select to authenticated
  using (role = 'patient' and (private.has_grant(id) or private.pharmacy_context_patient(id)));
create policy profiles_admin_select on app.profiles for select to authenticated
  using ((select private.current_app_role()) = 'admin');
create policy profiles_self_update on app.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ============================ facilities / practitioners ============================
create policy facilities_read on app.facilities for select to authenticated using (true);
create policy practitioners_read on app.practitioners for select to authenticated using (true);
create policy practitioner_facilities_read on app.practitioner_facilities for select to authenticated using (true);
-- writes: admin SECURITY DEFINER functions only (0006)

-- ============================ patients ============================
create policy patients_self on app.patients for select to authenticated
  using (id = (select auth.uid()));
create policy patients_doctor on app.patients for select to authenticated
  using (private.has_grant(id));
create policy patients_pharmacy on app.patients for select to authenticated
  using (private.pharmacy_context_patient(id));
create policy patients_admin on app.patients for select to authenticated
  using ((select private.current_app_role()) = 'admin');
create policy patients_self_update on app.patients for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy patients_doctor_update on app.patients for update to authenticated
  using (private.has_grant(id, true)) with check (private.has_grant(id, true));
-- insert: onboarding SECURITY DEFINER function (0006)

-- ============================ consents / devices ============================
create policy consents_self on app.consents for select to authenticated using (patient_id = (select auth.uid()));
create policy consents_self_insert on app.consents for insert to authenticated with check (patient_id = (select auth.uid()));

create policy devices_self on app.devices for select to authenticated using (user_id = (select auth.uid()));
create policy devices_self_insert on app.devices for insert to authenticated with check (user_id = (select auth.uid()));
create policy devices_self_update on app.devices for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ============================ share codes / grants ============================
create policy share_codes_self on app.share_codes for select to authenticated using (patient_id = (select auth.uid()));
create policy share_codes_self_insert on app.share_codes for insert to authenticated
  with check (patient_id = (select auth.uid()) and (select private.current_app_role()) = 'patient');

create policy grants_patient on app.access_grants for select to authenticated using (patient_id = (select auth.uid()));
create policy grants_practitioner on app.access_grants for select to authenticated using (practitioner_id = (select auth.uid()));
create policy grants_admin on app.access_grants for select to authenticated using ((select private.current_app_role()) = 'admin');
create policy grants_patient_revoke on app.access_grants for update to authenticated
  using (patient_id = (select auth.uid()) and status = 'active')
  with check (patient_id = (select auth.uid()) and status = 'revoked' and revoked_by = (select auth.uid()));
-- insert: private.redeem_share_code() (0006)

-- ============================ encounters & addenda ============================
create policy encounters_patient on app.encounters for select to authenticated
  using (patient_id = (select auth.uid()));
create policy encounters_doctor on app.encounters for select to authenticated
  using (private.has_grant(patient_id)
         and (visibility = 'normal' or doctor_id = (select auth.uid())));
create policy encounters_doctor_insert on app.encounters for insert to authenticated
  with check (doctor_id = (select auth.uid())
              and private.has_grant(patient_id, true)
              and (private.is_member_of(facility_id, 'clinic') or private.is_member_of(facility_id, 'hospital')));
create policy encounters_doctor_update on app.encounters for update to authenticated
  using (doctor_id = (select auth.uid()) and private.has_grant(patient_id, true))
  with check (doctor_id = (select auth.uid()));
create policy encounters_patient_visibility on app.encounters for update to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));

create policy addenda_read on app.encounter_addenda for select to authenticated
  using (patient_id = (select auth.uid())
         or exists (select 1 from app.encounters e where e.id = encounter_id));   -- inherits encounter RLS
create policy addenda_insert on app.encounter_addenda for insert to authenticated
  with check (author_id = (select auth.uid()) and private.has_grant(patient_id, true));

-- ============================ diagnoses / conditions / allergies / meds ============================
create policy diagnoses_read on app.diagnoses for select to authenticated
  using (patient_id = (select auth.uid())
         or exists (select 1 from app.encounters e where e.id = encounter_id));   -- respects visibility
create policy diagnoses_insert on app.diagnoses for insert to authenticated
  with check (recorded_by = (select auth.uid()) and private.has_grant(patient_id, true)
              and exists (select 1 from app.encounters e
                          where e.id = encounter_id and e.patient_id = diagnoses.patient_id
                            and e.doctor_id = (select auth.uid()) and e.status <> 'entered_in_error'));

create policy conditions_read on app.conditions for select to authenticated
  using (patient_id = (select auth.uid()) or private.has_grant(patient_id));
create policy conditions_insert on app.conditions for insert to authenticated
  with check (patient_id = (select auth.uid()) or private.has_grant(patient_id, true));
create policy conditions_update on app.conditions for update to authenticated
  using ((patient_id = (select auth.uid()) and source = 'patient_reported') or private.has_grant(patient_id, true));

create policy allergies_read on app.allergies for select to authenticated
  using (patient_id = (select auth.uid()) or private.has_grant(patient_id) or private.pharmacy_context_patient(patient_id));
create policy allergies_insert on app.allergies for insert to authenticated
  with check (patient_id = (select auth.uid()) or private.has_grant(patient_id, true));
create policy allergies_update on app.allergies for update to authenticated
  using ((patient_id = (select auth.uid()) and source = 'patient_reported') or private.has_grant(patient_id, true));

create policy meds_read on app.medication_statements for select to authenticated
  using (patient_id = (select auth.uid()) or private.has_grant(patient_id));
create policy meds_insert on app.medication_statements for insert to authenticated
  with check ((patient_id = (select auth.uid()) and source = 'patient_reported')
              or (private.has_grant(patient_id, true) and source = 'patient_reported'));
create policy meds_update on app.medication_statements for update to authenticated
  using ((patient_id = (select auth.uid()) and source = 'patient_reported') or private.has_grant(patient_id, true));

-- ============================ emergency contacts (patient only; paramedics via 0006 functions) ============================
create policy ec_self on app.emergency_contacts for select to authenticated using (patient_id = (select auth.uid()));
create policy ec_self_insert on app.emergency_contacts for insert to authenticated with check (patient_id = (select auth.uid()));
create policy ec_self_update on app.emergency_contacts for update to authenticated
  using (patient_id = (select auth.uid()) and deleted_at is null) with check (patient_id = (select auth.uid()));

-- ============================ prescriptions ============================
create policy rx_patient on app.prescriptions for select to authenticated
  using (patient_id = (select auth.uid()));
create policy rx_doctor on app.prescriptions for select to authenticated
  using (doctor_id = (select auth.uid()) or private.has_grant(patient_id));
create policy rx_pharmacist on app.prescriptions for select to authenticated
  using (private.has_pharmacy_context(id));
create policy rx_doctor_insert on app.prescriptions for insert to authenticated
  with check (doctor_id = (select auth.uid())
              and private.has_grant(patient_id, true)
              and exists (select 1 from app.encounters e
                          where e.id = encounter_id and e.patient_id = prescriptions.patient_id
                            and e.doctor_id = (select auth.uid())
                            and (e.status = 'open' or e.ended_at > now() - interval '24 hours')));
create policy rx_doctor_update on app.prescriptions for update to authenticated
  using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()));
create policy rx_pharmacist_lock on app.prescriptions for update to authenticated
  using (private.has_pharmacy_context(id)) with check (false);               -- enables SELECT … FOR UPDATE only

create policy rx_items_read on app.prescription_items for select to authenticated
  using (exists (select 1 from app.prescriptions rx where rx.id = prescription_id));   -- inherits rx policies
create policy rx_items_insert on app.prescription_items for insert to authenticated
  with check (exists (select 1 from app.prescriptions rx
                      where rx.id = prescription_id and rx.doctor_id = (select auth.uid()) and rx.signature is null));
create policy rx_items_doctor_cancel on app.prescription_items for update to authenticated
  using (exists (select 1 from app.prescriptions rx where rx.id = prescription_id and rx.doctor_id = (select auth.uid())))
  with check (status = 'cancelled');
create policy rx_items_pharmacist_lock on app.prescription_items for update to authenticated
  using (private.has_pharmacy_context(prescription_id)) with check (false);   -- enables SELECT … FOR UPDATE only

create policy alerts_read on app.clinical_alerts for select to authenticated
  using (doctor_id = (select auth.uid()) or private.has_grant(patient_id) or private.has_pharmacy_context(prescription_id));
create policy alerts_insert on app.clinical_alerts for insert to authenticated
  with check (doctor_id = (select auth.uid())
              and exists (select 1 from app.prescriptions rx
                          where rx.id = prescription_id and rx.doctor_id = (select auth.uid()) and rx.signature is null));

-- ============================ pharmacy ============================
create policy verifications_self on app.rx_verifications for select to authenticated
  using (pharmacist_id = (select auth.uid()));
-- insert: private.open_pharmacy_context() (0006)

create policy leases_read on app.dispense_leases for select to authenticated
  using (private.has_pharmacy_context(prescription_id));
create policy leases_insert on app.dispense_leases for insert to authenticated
  with check (pharmacist_id = (select auth.uid()) and private.has_pharmacy_context(prescription_id)
              and private.is_member_of(pharmacy_id, 'pharmacy'));
create policy leases_delete on app.dispense_leases for delete to authenticated
  using (private.has_pharmacy_context(prescription_id));

create policy dispensations_read on app.dispensations for select to authenticated
  using (pharmacist_id = (select auth.uid())
         or private.is_member_of(pharmacy_id, 'pharmacy')
         or exists (select 1 from app.prescriptions rx where rx.id = prescription_id));   -- patient/doctor via rx policies
create policy dispensations_insert on app.dispensations for insert to authenticated
  with check (pharmacist_id = (select auth.uid())
              and private.has_pharmacy_context(prescription_id)
              and private.is_member_of(pharmacy_id, 'pharmacy')
              and exists (select 1 from app.rx_verifications v
                          where v.id = verification_id and v.pharmacist_id = (select auth.uid())
                            and v.prescription_id = dispensations.prescription_id
                            and v.result = 'valid' and v.expires_at > now()));

create policy dispensation_items_read on app.dispensation_items for select to authenticated
  using (exists (select 1 from app.dispensations d where d.id = dispensation_id));
create policy dispensation_items_insert on app.dispensation_items for insert to authenticated
  with check (exists (select 1 from app.dispensations d
                      where d.id = dispensation_id and d.pharmacist_id = (select auth.uid())
                        and d.dispensed_at > now() - interval '1 minute'));

-- ============================ emergency ============================
create policy es_paramedic on app.emergency_sessions for select to authenticated
  using (paramedic_id = (select auth.uid()));
create policy es_patient on app.emergency_sessions for select to authenticated
  using (patient_id = (select auth.uid()));
create policy es_admin on app.emergency_sessions for select to authenticated
  using ((select private.current_app_role()) = 'admin');
create policy es_paramedic_close on app.emergency_sessions for update to authenticated
  using (paramedic_id = (select auth.uid()) and status = 'active')
  with check (paramedic_id = (select auth.uid()));
-- insert & extend & review: SECURITY DEFINER functions (0006)

-- ============================ assistant ============================
create policy as_self on app.assistant_sessions for select to authenticated using (patient_id = (select auth.uid()));
create policy as_self_insert on app.assistant_sessions for insert to authenticated
  with check (patient_id = (select auth.uid()) and (select private.current_app_role()) = 'patient');
create policy as_self_update on app.assistant_sessions for update to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));
create policy as_self_delete on app.assistant_sessions for delete to authenticated using (patient_id = (select auth.uid()));
create policy am_self on app.assistant_messages for select to authenticated using (patient_id = (select auth.uid()));
create policy am_self_insert on app.assistant_messages for insert to authenticated
  with check (patient_id = (select auth.uid())
              and exists (select 1 from app.assistant_sessions s where s.id = session_id and s.patient_id = (select auth.uid())));

-- ============================ ops ============================
create policy notifications_self on app.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_insert on app.notifications for insert to authenticated with check (true);  -- outbox; no PHI by contract
create policy approvals_admin on app.admin_approvals for select to authenticated
  using ((select private.current_app_role()) = 'admin');
create policy drug_requests_read on app.drug_requests for select to authenticated
  using (requested_by = (select auth.uid()) or (select private.current_app_role()) = 'admin');
create policy drug_requests_insert on app.drug_requests for insert to authenticated
  with check (requested_by = (select auth.uid()) and (select private.current_app_role()) in ('doctor','pharmacist'));

-- supabase_auth_admin needs to read profiles for the access-token hook
create policy profiles_auth_hook on app.profiles for select to supabase_auth_admin using (true);
