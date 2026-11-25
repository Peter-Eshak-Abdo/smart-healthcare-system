import { randomInt, randomUUID } from 'node:crypto';
import {
  CancelPrescriptionRequestSchema,
  CheckPrescriptionsRequestSchema,
  IdParamSchema,
  IssuePrescriptionRequestSchema,
} from '@smarthealth/contracts';
import argon2 from 'argon2';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type DrugReferenceDoc,
  type EncounterDoc,
  type PatientDoc,
  type PrescriptionDoc,
  type PrescriptionItemDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission, requireRecentAuth } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { getRequestLocale } from '../../shared/request-context.js';
import { loadPrescriptionDetail } from './detail.js';
import { runClinicalSafetyCheck } from './safety.js';
import { buildCanonicalRxPayload, generatePaperCode } from './signing.js';

export function prescriptionRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/prescriptions/check',
    requirePermission('prescription:check'),
    deps.rateLimit.middleware('rx_check'),
    validate({ body: CheckPrescriptionsRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          patient_id: string;
          items: Array<{ client_key: string; drug_id: string }>;
        };
        const db = requireDb(deps);
        const locale = getRequestLocale();
        const safety = await runClinicalSafetyCheck(db, deps, {
          patientId: body.patient_id,
          doctorId: auth.userId,
          items: body.items,
          locale,
        });

        res.status(200).json({
          checks_status: safety.checks_status,
          engine_version: safety.engine_version,
          dataset_version: safety.dataset_version,
          alerts: safety.alerts.map((a) => ({
            alert_key: a.alert_key,
            type: a.type,
            severity: a.severity,
            item_keys: a.item_keys,
            title: a.title,
            message: a.message,
            management: a.management,
            source: a.source,
            requires_override: a.requires_override,
            ...(a.involves_current_medication
              ? { involves_current_medication: a.involves_current_medication }
              : {}),
            previously_reviewed: a.previously_reviewed,
          })),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/prescriptions',
    requirePermission('prescription:create'),
    requireRecentAuth(900),
    idempotencyMiddleware(deps.redis, { required: true }),
    validate({ body: IssuePrescriptionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          patient_id: string;
          encounter_id: string;
          items: Array<{
            client_key: string;
            drug_id: string;
            dose: string;
            route: string;
            frequency: PrescriptionItemDoc['frequency'];
            frequency_interval_hours?: number | null;
            duration_days: number;
            quantity: number;
            quantity_unit: string;
            instructions?: string;
            substitution_allowed: boolean;
          }>;
          overrides: Array<{
            alert_key: string;
            reason_code: 'benefit_outweighs_risk' | 'allergy_disputed' | 'desensitisation_protocol' | 'monitored_setting' | 'other';
            justification: string;
          }>;
          manual_review_attested: boolean;
          notes_to_pharmacist?: string;
        };
        const db = requireDb(deps);
        const locale = getRequestLocale();

        const encSnap = await db.collection(COLLECTIONS.encounters).doc(body.encounter_id).get();
        if (!encSnap.exists) throw new AppError('ACCESS_GRANT_REQUIRED');
        const enc = encSnap.data() as EncounterDoc;
        if (enc.patient_id !== body.patient_id || enc.doctor_id !== auth.userId) {
          throw new AppError('ACCESS_GRANT_REQUIRED');
        }
        if (enc.status === 'entered_in_error') {
          throw new AppError('VALIDATION_FAILED', { detail: 'encounter_entered_in_error' });
        }
        if (
          enc.status === 'closed' &&
          enc.ended_at &&
          Date.now() - new Date(enc.ended_at).getTime() > 24 * 3600 * 1000
        ) {
          throw new AppError('VALIDATION_FAILED', {
            statusOverride: 409,
            detail: 'edit_window_closed',
          });
        }

        const drugIds = [...new Set(body.items.map((i) => i.drug_id))];
        const drugMap = new Map<string, DrugReferenceDoc>();
        for (const dId of drugIds) {
          const dSnap = await db.collection(COLLECTIONS.drugReference).doc(dId).get();
          if (dSnap.exists) {
            drugMap.set(dId, dSnap.data() as DrugReferenceDoc);
          }
        }

        for (const item of body.items) {
          const drug = drugMap.get(item.drug_id);
          if (!drug || !drug.is_active) {
            throw new AppError('VALIDATION_FAILED', { detail: 'inactive_or_unknown_drug' });
          }
          if (drug.base_unit !== item.quantity_unit) {
            throw new AppError('VALIDATION_FAILED', {
              detail: `unit_mismatch_expected_${drug.base_unit}`,
            });
          }
        }

        const safety = await runClinicalSafetyCheck(db, deps, {
          patientId: body.patient_id,
          doctorId: auth.userId,
          items: body.items.map((i) => ({ client_key: i.client_key, drug_id: i.drug_id })),
          locale,
        });

        if (safety.checks_status === 'unavailable' && !body.manual_review_attested) {
          throw new AppError('RX_ALERT_OVERRIDE_REQUIRED', {
            detail: 'manual_review_attestation_required',
          });
        }

        const overrideMap = new Map(body.overrides.map((o) => [o.alert_key, o]));
        const missing = safety.alerts.filter(
          (a) => a.requires_override && !overrideMap.has(a.alert_key),
        );
        if (missing.length > 0) {
          throw new AppError('RX_ALERT_OVERRIDE_REQUIRED', {
            errors: missing.map((a) => ({
              path: 'overrides',
              code: 'missing',
              message: a.alert_key,
              alert_key: a.alert_key,
            })),
          });
        }

        const patSnap = await db.collection(COLLECTIONS.patients).doc(body.patient_id).get();
        const patUserSnap = await db.collection(COLLECTIONS.users).doc(body.patient_id).get();
        if (!patSnap.exists || !patUserSnap.exists) {
          throw new AppError('RESOURCE_NOT_FOUND', { detail: 'patient_not_found' });
        }
        const patientDoc = patSnap.data() as PatientDoc;
        const patientUser = patUserSnap.data() as UserDoc;

        const rxId = randomUUID();
        const rxNumber = `RX-${new Date().getFullYear()}-${String(randomInt(100_000, 999_999))}`;
        const hasControlled = body.items.some((i) => drugMap.get(i.drug_id)?.is_controlled);
        const issuedAt = new Date();
        const expiresAt = new Date(
          issuedAt.getTime() + (hasControlled ? 7 : 30) * 86_400 * 1000,
        );

        const paperCode = generatePaperCode();
        const paperCodeHash = await argon2.hash(paperCode, {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        });

        const itemDocs: PrescriptionItemDoc[] = body.items.map((item) => {
          const drug = drugMap.get(item.drug_id)!;
          const itemId = randomUUID();
          return {
            id: itemId,
            prescription_id: rxId,
            patient_id: body.patient_id,
            drug_id: item.drug_id,
            drug_brand_name: drug.brand_name,
            drug_generic_name: drug.generic_name,
            drug_strength: drug.strength,
            drug_dosage_form: drug.dosage_form,
            drug_is_controlled: drug.is_controlled,
            dose: item.dose,
            route: item.route,
            frequency: item.frequency,
            frequency_interval_hours: item.frequency_interval_hours ?? null,
            duration_days: item.duration_days,
            quantity_prescribed: item.quantity,
            quantity_dispensed: 0,
            quantity_unit: item.quantity_unit,
            instructions_enc: item.instructions
              ? deps.fieldCipher.encrypt(
                  item.instructions,
                  aad('prescription_items', 'instructions_enc', itemId),
                )
              : null,
            substitution_allowed: drug.is_controlled ? false : item.substitution_allowed,
            status: 'pending',
          };
        });

        const canonical = buildCanonicalRxPayload(
          {
            id: rxId,
            rx_number: rxNumber,
            patient_id: body.patient_id,
            doctor_id: auth.userId,
            facility_id: enc.facility_id,
            issued_at: issuedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          },
          itemDocs.map((i) => ({
            id: i.id,
            drug_id: i.drug_id,
            dose: i.dose,
            route: i.route,
            frequency: i.frequency,
            frequency_interval_hours: i.frequency_interval_hours,
            duration_days: i.duration_days,
            quantity: i.quantity_prescribed,
            quantity_unit: i.quantity_unit,
            substitution_allowed: i.substitution_allowed,
          })),
          auth.licenseNumber ?? '',
        );

        const { signature, kid } = deps.signer.signRx(canonical);

        const rxDoc: PrescriptionDoc = {
          id: rxId,
          rx_number: rxNumber,
          patient_id: body.patient_id,
          patient_mrn: patientDoc.mrn,
          patient_name: patientUser.full_name,
          patient_age: calculateAge(patientDoc.date_of_birth),
          patient_sex: patientDoc.sex,
          doctor_id: auth.userId,
          prescriber_name: auth.fullName,
          prescriber_license: auth.licenseNumber ?? '',
          prescriber_specialty: auth.specialtyCode,
          facility_id: enc.facility_id,
          facility_name: enc.facility_name,
          encounter_id: enc.id,
          status: 'pending',
          issued_at: issuedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          paper_code_hash: paperCodeHash,
          signature_alg: 'EdDSA',
          signature_kid: kid,
          signature_b64: signature.toString('base64'),
          safety_check_bypassed: safety.checks_status === 'unavailable',
          alerts_summary: safety.alerts.map((a) => {
            const ov = overrideMap.get(a.alert_key);
            return {
              alert_key: a.alert_key,
              type: a.type,
              severity: a.severity,
              overridden: Boolean(ov),
              reason_code: ov ? ov.reason_code : null,
              justification_enc: ov
                ? deps.fieldCipher.encrypt(
                    ov.justification,
                    aad('prescriptions', `alert_just_${a.alert_key}`, rxId),
                  )
                : null,
            };
          }),
          notes_to_pharmacist_enc: body.notes_to_pharmacist
            ? deps.fieldCipher.encrypt(
                body.notes_to_pharmacist,
                aad('prescriptions', 'notes_to_pharmacist_enc', rxId),
              )
            : null,
          version: 1,
          cancelled_reason_code: null,
          cancelled_at: null,
        };

        const batch = db.batch();
        batch.set(db.collection(COLLECTIONS.prescriptions).doc(rxId), rxDoc);
        for (const itemDoc of itemDocs) {
          batch.set(db.collection(COLLECTIONS.prescriptionItems).doc(itemDoc.id), itemDoc);
        }
        batch.update(db.collection(COLLECTIONS.encounters).doc(enc.id), {
          prescription_ids: [...(enc.prescription_ids ?? []), rxId],
        });
        await batch.commit();

        await writeAuditLog(db, auth, {
          action: 'RX_ISSUED',
          resourceType: 'prescription',
          resourceId: rxId,
          patientId: body.patient_id,
          patientMrnLast4: patientDoc.mrn_last4,
          metadata: { rx_number: rxNumber, item_count: itemDocs.length },
        });

        const detail = await loadPrescriptionDetail(db, deps, rxId, 'doctor');
        res.status(201).json({
          ...detail,
          verification_code_hint: `Show this code if you have no phone: ${paperCode}`,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/prescriptions/:id/cancel',
    requirePermission('prescription:cancel:own'),
    validate({ params: IdParamSchema, body: CancelPrescriptionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as {
          reason_code: string;
          item_ids: string[] | null;
        };
        const db = requireDb(deps);

        await db.runTransaction(async (tx) => {
          const rxRef = db.collection(COLLECTIONS.prescriptions).doc(id);
          const rxSnap = await tx.get(rxRef);
          if (!rxSnap.exists) throw new AppError('RX_NOT_FOUND');
          const rx = rxSnap.data() as PrescriptionDoc;
          if (rx.doctor_id !== auth.userId) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'not_prescriber' });
          }
          if (rx.status === 'dispensed') {
            throw new AppError('RX_ALREADY_DISPENSED');
          }

          const itemsSnap = await tx.get(
            db.collection(COLLECTIONS.prescriptionItems).where('prescription_id', '==', id),
          );
          const targetSet = body.item_ids ? new Set(body.item_ids) : null;
          let remainingActive = 0;

          for (const doc of itemsSnap.docs) {
            const item = doc.data() as PrescriptionItemDoc;
            if ((!targetSet || targetSet.has(item.id)) && item.status !== 'dispensed') {
              tx.update(doc.ref, { status: 'cancelled' });
            } else if (item.status !== 'dispensed' && item.status !== 'cancelled') {
              remainingActive += 1;
            }
          }

          tx.update(rxRef, {
            status: remainingActive === 0 ? 'cancelled' : rx.status,
            cancelled_reason_code: body.reason_code,
            cancelled_at: new Date().toISOString(),
            version: rx.version + 1,
          });
        });

        await writeAuditLog(db, auth, {
          action: 'RX_CANCELLED',
          resourceType: 'prescription',
          resourceId: id,
          metadata: { reason_code: body.reason_code },
        });

        const detail = await loadPrescriptionDetail(db, deps, id, 'doctor');
        res.status(200).json(detail);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/prescriptions/:id',
    requirePermission('prescription:create'),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const db = requireDb(deps);
        const detail = await loadPrescriptionDetail(db, deps, id, auth.role);
        if (detail.prescriber.id !== auth.userId && auth.role !== 'admin') {
          throw new AppError('RX_NOT_FOUND');
        }
        res.status(200).json(detail);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/doctor/prescriptions', requirePermission('prescription:create'), async (_req, res, next) => {
    try {
      const auth = res.locals.auth!;
      const db = requireDb(deps);
      const snap = await db
        .collection(COLLECTIONS.prescriptions)
        .where('doctor_id', '==', auth.userId)
        .orderBy('issued_at', 'desc')
        .limit(50)
        .get();

      const data = await Promise.all(
        snap.docs.map(async (d) => {
          const rx = d.data() as PrescriptionDoc;
          const itemsSnap = await db
            .collection(COLLECTIONS.prescriptionItems)
            .where('prescription_id', '==', rx.id)
            .get();
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
            },
            item_count: itemsSnap.size,
          };
        }),
      );
      res.status(200).json({ data, next_cursor: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
