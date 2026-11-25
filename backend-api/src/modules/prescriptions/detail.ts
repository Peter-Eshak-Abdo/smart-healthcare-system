import type { AppRole } from '@smarthealth/contracts';
import type { Firestore } from 'firebase-admin/firestore';
import type { AppDeps } from '../../app-deps.js';
import {
  COLLECTIONS,
  type DispensationDoc,
  type PrescriptionDoc,
  type PrescriptionItemDoc,
} from '../../firebase/firestore-types.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { AppError } from '../../shared/errors.js';

export async function loadPrescriptionDetail(
  db: Firestore,
  deps: Pick<AppDeps, 'fieldCipher'>,
  rxId: string,
  viewerRole: AppRole,
) {
  const rxSnap = await db.collection(COLLECTIONS.prescriptions).doc(rxId).get();
  if (!rxSnap.exists) throw new AppError('RX_NOT_FOUND');
  const rx = rxSnap.data() as PrescriptionDoc;

  const itemsSnap = await db
    .collection(COLLECTIONS.prescriptionItems)
    .where('prescription_id', '==', rxId)
    .get();
  const itemDocs = itemsSnap.docs
    .map((d) => d.data() as PrescriptionItemDoc)
    .sort((a, b) => a.id.localeCompare(b.id));

  const dispSnap = await db
    .collection(COLLECTIONS.dispensations)
    .where('prescription_id', '==', rxId)
    .get();
  const dispDocs = dispSnap.docs
    .map((d) => d.data() as DispensationDoc)
    .sort((a, b) => a.dispensed_at.localeCompare(b.dispensed_at));

  const canSeeJustification = viewerRole === 'doctor' || viewerRole === 'pharmacist';

  return {
    id: rx.id,
    rx_number: rx.rx_number,
    status: rx.status,
    issued_at: rx.issued_at,
    expires_at: rx.expires_at,
    patient: {
      id: rx.patient_id,
      mrn: rx.patient_mrn,
      full_name: rx.patient_name,
      age: rx.patient_age,
      sex: rx.patient_sex,
    },
    prescriber: {
      id: rx.doctor_id,
      name: rx.prescriber_name,
      license_number: rx.prescriber_license,
      specialty: rx.prescriber_specialty,
      facility: rx.facility_name,
    },
    items: itemDocs.map((item) => ({
      id: item.id,
      drug: {
        id: item.drug_id,
        brand_name: item.drug_brand_name,
        generic_name: item.drug_generic_name,
        strength: item.drug_strength,
        dosage_form: item.drug_dosage_form,
        is_controlled: item.drug_is_controlled,
      },
      dose: item.dose,
      route: item.route,
      frequency: item.frequency,
      duration_days: item.duration_days,
      quantity_prescribed: item.quantity_prescribed,
      quantity_dispensed: item.quantity_dispensed,
      quantity_remaining: Math.max(0, item.quantity_prescribed - item.quantity_dispensed),
      quantity_unit: item.quantity_unit,
      instructions: item.instructions_enc
        ? deps.fieldCipher.decrypt(
            item.instructions_enc,
            aad('prescription_items', 'instructions_enc', item.id),
          )
        : null,
      substitution_allowed: item.substitution_allowed,
      status: item.status,
    })),
    alerts_summary: (rx.alerts_summary ?? []).map((a) => ({
      alert_key: a.alert_key,
      severity: a.severity,
      overridden: a.overridden,
      reason_code: a.reason_code,
      ...(canSeeJustification
        ? {
            justification: a.justification_enc
              ? deps.fieldCipher.decrypt(
                  a.justification_enc,
                  aad('prescriptions', `alert_just_${a.alert_key}`, rx.id),
                )
              : null,
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
    dispensations: dispDocs.map((d) => ({
      id: d.id,
      dispensed_at: d.dispensed_at,
      pharmacy: { id: d.pharmacy_id, name: d.pharmacy_name },
      items: d.items.map((it) => ({
        prescription_item_id: it.prescription_item_id,
        quantity: it.quantity,
      })),
    })),
    signature: {
      alg: rx.signature_alg,
      kid: rx.signature_kid,
      value_b64: rx.signature_b64,
    },
    version: rx.version,
  };
}
