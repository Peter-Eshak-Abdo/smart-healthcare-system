import type { AppRole } from '@smarthealth/contracts';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import type { Tx } from '../../db/with-user-tx.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';

export async function loadPrescriptionDetail(
  tx: Tx,
  deps: Pick<AppDeps, 'fieldCipher'>,
  rxId: string,
  viewerRole: AppRole,
) {
  const rxRes = await sql<{
    id: string;
    rx_number: string;
    status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
    issued_at: string;
    expires_at: string;
    notes_to_pharmacist_enc: string | null;
    safety_check_bypassed: boolean;
    signature: Buffer | null;
    signature_kid: string | null;
    version: number;
    patient_id: string;
    patient_mrn: string;
    patient_name: string;
    patient_dob: string;
    patient_sex: 'male' | 'female';
    doctor_id: string;
    doctor_name: string;
    doctor_license: string;
    specialty_name: string | null;
    facility_name: string;
  }>`
    select
      rx.id, rx.rx_number, rx.status, rx.issued_at::text, rx.expires_at::text,
      rx.notes_to_pharmacist_enc, rx.safety_check_bypassed, rx.signature, rx.signature_kid, rx.version,
      pt.id as patient_id, pt.mrn as patient_mrn, pt_prof.full_name as patient_name,
      pt.date_of_birth::text as patient_dob, pt.sex as patient_sex,
      dr.id as doctor_id, dr_prof.full_name as doctor_name, dr.license_number as doctor_license,
      sp.name_en as specialty_name,
      fac.name as facility_name
    from app.prescriptions rx
    join app.patients pt on pt.id = rx.patient_id
    join app.profiles pt_prof on pt_prof.id = pt.id
    join app.practitioners dr on dr.id = rx.doctor_id
    join app.profiles dr_prof on dr_prof.id = dr.id
    join app.facilities fac on fac.id = rx.facility_id
    left join ref.specialties sp on sp.code = dr.specialty_code
    where rx.id = ${rxId}::uuid
  `.execute(tx);

  const rx = rxRes.rows[0];
  if (!rx) throw new AppError('RX_NOT_FOUND');

  const itemsRes = await sql<{
    id: string;
    drug_id: string;
    brand_name: string;
    generic_name: string;
    strength: string;
    dosage_form: string;
    is_controlled: boolean;
    dose: string;
    route: string;
    frequency: 'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'every_x_hours' | 'at_bedtime' | 'as_needed' | 'once' | 'weekly';
    duration_days: number;
    quantity_prescribed: string;
    quantity_dispensed: string;
    quantity_unit: string;
    instructions: string | null;
    substitution_allowed: boolean;
    status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
  }>`
    select
      pi.id, pi.drug_id, d.brand_name, d.generic_name, d.strength, d.dosage_form, d.is_controlled,
      pi.dose, pi.route, pi.frequency, pi.duration_days,
      pi.quantity_prescribed::text, pi.quantity_dispensed::text, pi.quantity_unit,
      pi.instructions, pi.substitution_allowed, pi.status
    from app.prescription_items pi
    join ref.drugs d on d.id = pi.drug_id
    where pi.prescription_id = ${rxId}::uuid
    order by pi.created_at asc, pi.id asc
  `.execute(tx);

  const alertsRes = await sql<{
    id: string;
    alert_key: string;
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    overridden: boolean;
    override_reason_code: 'benefit_outweighs_risk' | 'allergy_disputed' | 'desensitisation_protocol' | 'monitored_setting' | 'other' | null;
    override_justification_enc: string | null;
  }>`
    select id, alert_key, severity, overridden, override_reason_code, override_justification_enc
      from app.clinical_alerts
     where prescription_id = ${rxId}::uuid
     order by created_at asc
  `.execute(tx);

  const dispRes = await sql<{
    id: string;
    dispensed_at: string;
    pharmacy_id: string;
    pharmacy_name: string;
  }>`
    select d.id, d.dispensed_at::text, d.pharmacy_id, f.name as pharmacy_name
      from app.dispensations d
      join app.facilities f on f.id = d.pharmacy_id
     where d.prescription_id = ${rxId}::uuid
     order by d.dispensed_at asc
  `.execute(tx);

  const dispIds = dispRes.rows.map((d) => d.id);
  const dispItemsMap = new Map<string, Array<{ prescription_item_id: string; quantity: number }>>();
  if (dispIds.length > 0) {
    const diRes = await sql<{
      dispensation_id: string;
      prescription_item_id: string;
      quantity: string;
    }>`
      select dispensation_id, prescription_item_id, quantity::text
        from app.dispensation_items
       where dispensation_id = any(${dispIds}::uuid[])
    `.execute(tx);
    for (const di of diRes.rows) {
      const list = dispItemsMap.get(di.dispensation_id) ?? [];
      list.push({
        prescription_item_id: di.prescription_item_id,
        quantity: Number.parseFloat(di.quantity),
      });
      dispItemsMap.set(di.dispensation_id, list);
    }
  }

  const canSeeJustification = viewerRole === 'doctor' || viewerRole === 'pharmacist';

  return {
    id: rx.id,
    rx_number: rx.rx_number,
    status: rx.status,
    issued_at: new Date(rx.issued_at).toISOString(),
    expires_at: new Date(rx.expires_at).toISOString(),
    patient: {
      id: rx.patient_id,
      mrn: rx.patient_mrn,
      full_name: rx.patient_name,
      age: calculateAge(rx.patient_dob),
      sex: rx.patient_sex,
    },
    prescriber: {
      id: rx.doctor_id,
      name: rx.doctor_name,
      license_number: rx.doctor_license,
      specialty: rx.specialty_name,
      facility: rx.facility_name,
    },
    items: itemsRes.rows.map((item) => {
      const prescribed = Number.parseFloat(item.quantity_prescribed);
      const dispensed = Number.parseFloat(item.quantity_dispensed);
      return {
        id: item.id,
        drug: {
          id: item.drug_id,
          brand_name: item.brand_name,
          generic_name: item.generic_name,
          strength: item.strength,
          dosage_form: item.dosage_form,
          is_controlled: item.is_controlled,
        },
        dose: item.dose,
        route: item.route,
        frequency: item.frequency,
        duration_days: item.duration_days,
        quantity_prescribed: prescribed,
        quantity_dispensed: dispensed,
        quantity_remaining: Math.max(0, Number((prescribed - dispensed).toFixed(2))),
        quantity_unit: item.quantity_unit,
        instructions: item.instructions,
        substitution_allowed: item.substitution_allowed,
        status: item.status,
      };
    }),
    alerts_summary: alertsRes.rows.map((a) => ({
      alert_key: a.alert_key,
      severity: a.severity,
      overridden: a.overridden,
      reason_code: a.override_reason_code,
      ...(canSeeJustification && a.override_justification_enc
        ? {
            justification: deps.fieldCipher.decrypt(
              a.override_justification_enc,
              aad('clinical_alerts', 'override_justification_enc', a.id),
            ),
          }
        : {}),
    })),
    safety_check_bypassed: rx.safety_check_bypassed,
    notes_to_pharmacist: rx.notes_to_pharmacist_enc
      ? deps.fieldCipher.decrypt(
          rx.notes_to_pharmacist_enc,
          aad('prescriptions', 'notes_to_pharmacist_enc', rx.id),
        )
      : null,
    dispensations: dispRes.rows.map((d) => ({
      id: d.id,
      dispensed_at: new Date(d.dispensed_at).toISOString(),
      pharmacy: { id: d.pharmacy_id, name: d.pharmacy_name },
      items: dispItemsMap.get(d.id) ?? [],
    })),
    signature: {
      alg: 'EdDSA' as const,
      kid: rx.signature_kid ?? 'unknown',
      value_b64: rx.signature ? Buffer.from(rx.signature).toString('base64') : '',
    },
    version: rx.version,
  };
}
