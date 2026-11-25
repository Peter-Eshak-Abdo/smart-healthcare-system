import { createHash, randomInt, randomUUID } from 'node:crypto';
import {
  AcquireLeaseRequestSchema,
  DispenseRequestSchema,
  IdParamSchema,
  PharmacyHistoryQuerySchema,
  PharmacyPrescriptionQuerySchema,
  VerifyPrescriptionRequestSchema,
} from '@smarthealth/contracts';
import argon2 from 'argon2';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { enqueueOutboxNotification, requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type DispensationDoc,
  type DrugReferenceDoc,
  type FacilityDoc,
  type MedicalRecordDoc,
  type PractitionerDoc,
  type PrescriptionDoc,
  type PrescriptionItemDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { toCanonicalJson } from '../../security/crypto/jcs.js';
import { AppError } from '../../shared/errors.js';
import { loadPrescriptionDetail } from '../prescriptions/detail.js';
import { buildCanonicalRxPayload, verifyPickupToken } from '../prescriptions/signing.js';

interface VerifyContextDoc {
  id: string;
  prescription_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacist_id: string;
  method: 'pickup_token' | 'rx_code';
  pickup_jti: string | null;
  expires_at: string;
}

export function pharmacyRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/pharmacy/prescriptions/verify',
    requirePermission('prescription:verify'),
    validate({ body: VerifyPrescriptionRequestSchema }),
    async (req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as
          | { mode: 'pickup_token'; pickup_token: string; pharmacy_id: string }
          | {
              mode: 'rx_code';
              rx_number: string;
              verification_code: string;
              pharmacy_id: string;
              presence:
                | { method: 'sms_otp'; otp_request_id: string | null; otp_code?: string }
                | { method: 'face_1to1'; face_verification_id: string };
            };
        const db = requireDb(deps);

        const facSnap = await db.collection(COLLECTIONS.facilities).doc(body.pharmacy_id).get();
        const pharmacyName = facSnap.exists
          ? (facSnap.data() as FacilityDoc).name
          : 'Pharmacy';

        let rxDoc: PrescriptionDoc | null = null;
        let pickupJti: string | null = null;
        let claimsItemsHash: string | null = null;

        if (body.mode === 'pickup_token') {
          const claims = verifyPickupToken(body.pickup_token, deps.keyring.rxPublicKeys);
          if (!claims) {
            throw new AppError('PICKUP_TOKEN_INVALID');
          }
          pickupJti = claims.jti;
          claimsItemsHash = claims.items_hash;

          const rxSnap = await db.collection(COLLECTIONS.prescriptions).doc(claims.rx).get();
          if (!rxSnap.exists) throw new AppError('RX_NOT_FOUND');
          rxDoc = rxSnap.data() as PrescriptionDoc;
        } else {
          const rxSnap = await db
            .collection(COLLECTIONS.prescriptions)
            .where('rx_number', '==', body.rx_number)
            .limit(1)
            .get();
          if (rxSnap.empty) throw new AppError('RX_NOT_FOUND');
          rxDoc = rxSnap.docs[0]!.data() as PrescriptionDoc;

          const codeOk = await argon2.verify(rxDoc.paper_code_hash, body.verification_code);
          if (!codeOk) {
            await deps.rateLimit
              .consume('rx_verify_fail', auth.userId, 1)
              .catch(() => undefined);
            throw new AppError('PICKUP_TOKEN_INVALID', { detail: 'paper_code_mismatch' });
          }

          if (body.presence.method === 'sms_otp') {
            if (!body.presence.otp_request_id) {
              const otpReqId = randomUUID();
              const otp = String(randomInt(100_000, 999_999));
              await deps.redis.set(
                `rx:otp:${otpReqId}`,
                JSON.stringify({ otp, rxId: rxDoc.id }),
                'EX',
                300,
              );
              await enqueueOutboxNotification(db, {
                user_id: rxDoc.patient_id,
                channel: 'sms',
                template: 'rx_dispense_otp',
                payload: { rx_number: rxDoc.rx_number },
              });
              res.status(202).json({ otp_request_id: otpReqId, sent_to: '••• ••••' });
              return;
            }
            const stored = await deps.redis.get(`rx:otp:${body.presence.otp_request_id}`);
            const parsed = stored ? (JSON.parse(stored) as { otp: string; rxId: string }) : null;
            if (!parsed || parsed.rxId !== rxDoc.id || parsed.otp !== body.presence.otp_code) {
              throw new AppError('PICKUP_TOKEN_INVALID', { detail: 'sms_otp_invalid' });
            }
            await deps.redis.del(`rx:otp:${body.presence.otp_request_id}`);
          }
        }

        const itemsSnap = await db
          .collection(COLLECTIONS.prescriptionItems)
          .where('prescription_id', '==', rxDoc.id)
          .get();
        const items = itemsSnap.docs.map((d) => d.data() as PrescriptionItemDoc);

        const canonical = buildCanonicalRxPayload(
          {
            id: rxDoc.id,
            rx_number: rxDoc.rx_number,
            patient_id: rxDoc.patient_id,
            doctor_id: rxDoc.doctor_id,
            facility_id: rxDoc.facility_id,
            issued_at: rxDoc.issued_at,
            expires_at: rxDoc.expires_at,
          },
          items.map((i) => ({
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
          rxDoc.prescriber_license,
        );

        const sigOk = deps.signer.verifyRx(
          canonical,
          Buffer.from(rxDoc.signature_b64, 'base64'),
          rxDoc.signature_kid,
        );
        if (!sigOk) {
          await writeAuditLog(db, auth, {
            action: 'RX_TAMPER_DETECTED',
            resourceType: 'prescription',
            resourceId: rxDoc.id,
            patientId: rxDoc.patient_id,
            outcome: 'denied',
          });
          throw new AppError('RX_SIGNATURE_INVALID');
        }

        if (claimsItemsHash) {
          const recomputedHash = createHash('sha256')
            .update(
              toCanonicalJson(
                items
                  .map((i) => ({
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
                  }))
                  .sort((a, b) => a.id.localeCompare(b.id)),
              ),
              'utf8',
            )
            .digest('base64url');
          if (recomputedHash !== claimsItemsHash) {
            throw new AppError('RX_SIGNATURE_INVALID');
          }
        }

        const prescriberSnap = await db
          .collection(COLLECTIONS.practitioners)
          .doc(rxDoc.doctor_id)
          .get();
        const prescriberStatus = prescriberSnap.exists
          ? (prescriberSnap.data() as PractitionerDoc).license_status
          : 'verified';

        let result:
          | 'valid'
          | 'already_dispensed'
          | 'expired'
          | 'cancelled'
          | 'prescriber_invalid' = 'valid';
        if (prescriberStatus === 'revoked') result = 'prescriber_invalid';
        else if (rxDoc.status === 'cancelled') result = 'cancelled';
        else if (rxDoc.status === 'dispensed') result = 'already_dispensed';
        else if (rxDoc.status === 'expired' || new Date(rxDoc.expires_at).getTime() <= Date.now()) {
          result = 'expired';
        }

        const recSnap = await db
          .collection(COLLECTIONS.medicalRecords)
          .where('patient_id', '==', rxDoc.patient_id)
          .where('kind', '==', 'allergy')
          .get();
        const allergies = recSnap.docs
          .map((d) => d.data() as MedicalRecordDoc)
          .filter((a) => a.status !== 'refuted')
          .map((a) => ({
            name: a.allergen_code ?? 'Recorded allergy',
            severity: a.severity ?? ('moderate' as const),
          }));

        const verificationId = randomUUID();
        const validUntil = new Date(Date.now() + 15 * 60_000).toISOString();
        const verifyCtx: VerifyContextDoc = {
          id: verificationId,
          prescription_id: rxDoc.id,
          pharmacy_id: body.pharmacy_id,
          pharmacy_name: pharmacyName,
          pharmacist_id: auth.userId,
          method: body.mode,
          pickup_jti: pickupJti,
          expires_at: validUntil,
        };
        await db.collection(COLLECTIONS.verifySessions).doc(verificationId).set(verifyCtx);

        const detail = await loadPrescriptionDetail(db, deps, rxDoc.id, 'pharmacist');
        await writeAuditLog(db, auth, {
          action: 'RX_VERIFIED',
          resourceType: 'prescription',
          resourceId: rxDoc.id,
          patientId: rxDoc.patient_id,
          metadata: { result, mode: body.mode },
        });

        res.status(200).json({
          verification_id: verificationId,
          result,
          valid_until: validUntil,
          prescription: detail,
          patient_for_pharmacy: {
            full_name: rxDoc.patient_name,
            age: rxDoc.patient_age,
            sex: rxDoc.patient_sex,
            allergies,
          },
          prescriber_status: {
            license_status: prescriberStatus,
            note: prescriberStatus === 'suspended' ? 'Prescriber temporarily suspended' : null,
          },
          checks: {
            signature: 'ok',
            payload_integrity: 'ok',
            expiry: result === 'expired' ? 'expired' : 'ok',
            status:
              result === 'already_dispensed'
                ? 'already_dispensed'
                : result === 'cancelled'
                  ? 'cancelled'
                  : 'ok',
            prescriber: prescriberStatus === 'revoked' ? 'invalid' : 'ok',
          },
        });
      } catch (err) {
        if (err instanceof AppError && err.code === 'PICKUP_TOKEN_INVALID') {
          await deps.rateLimit
            .consume('rx_verify_fail', res.locals.auth?.userId ?? req.ip ?? 'anon', 1)
            .catch(() => undefined);
        }
        next(err);
      }
    },
  );

  router.get(
    '/pharmacy/prescriptions/:id',
    requirePermission('prescription:verify'),
    validate({ params: IdParamSchema, query: PharmacyPrescriptionQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const { verification_id } = res.locals.validated!.query as { verification_id: string };
        const db = requireDb(deps);

        const ctxSnap = await db.collection(COLLECTIONS.verifySessions).doc(verification_id).get();
        if (!ctxSnap.exists) throw new AppError('RBAC_FORBIDDEN');
        const ctx = ctxSnap.data() as VerifyContextDoc;
        if (ctx.prescription_id !== id || ctx.pharmacist_id !== auth.userId) {
          throw new AppError('RBAC_FORBIDDEN');
        }

        const detail = await loadPrescriptionDetail(db, deps, id, 'pharmacist');
        res.status(200).json({
          prescription: detail,
          patient_for_pharmacy: {
            full_name: detail.patient.full_name,
            age: detail.patient.age,
            sex: detail.patient.sex,
            allergies: [],
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/pharmacy/prescriptions/:id/lease',
    requirePermission('prescription:dispense'),
    validate({ params: IdParamSchema, body: AcquireLeaseRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as { verification_id: string; force: boolean };
        const db = requireDb(deps);

        const ctxSnap = await db.collection(COLLECTIONS.verifySessions).doc(body.verification_id).get();
        if (!ctxSnap.exists) throw new AppError('RBAC_FORBIDDEN');
        const ctx = ctxSnap.data() as VerifyContextDoc;

        const leaseRef = db.collection(COLLECTIONS.dispenseLeases).doc(id);
        const now = Date.now();
        const expiresAt = new Date(now + 10 * 60_000).toISOString();
        const leaseId = randomUUID();

        await db.runTransaction(async (tx) => {
          const leaseSnap = await tx.get(leaseRef);
          if (leaseSnap.exists && !body.force) {
            const existing = leaseSnap.data() as { pharmacy_id: string; expires_at: string };
            if (
              existing.pharmacy_id !== ctx.pharmacy_id &&
              new Date(existing.expires_at).getTime() > now
            ) {
              throw new AppError('RX_LEASE_HELD');
            }
          }
          tx.set(leaseRef, {
            lease_id: leaseId,
            prescription_id: id,
            pharmacy_id: ctx.pharmacy_id,
            pharmacist_id: auth.userId,
            expires_at: expiresAt,
          });
        });

        res.status(200).json({ lease_id: leaseId, expires_at: expiresAt });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/pharmacy/prescriptions/:id/lease',
    requirePermission('prescription:dispense'),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const { id } = res.locals.validated!.params as { id: string };
        const db = requireDb(deps);
        await db.collection(COLLECTIONS.dispenseLeases).doc(id).delete();
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/pharmacy/prescriptions/:id/dispensations',
    requirePermission('prescription:dispense'),
    idempotencyMiddleware(deps.redis, { required: true }),
    validate({ params: IdParamSchema, body: DispenseRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as {
          verification_id: string;
          expected_version?: number;
          items: Array<{
            prescription_item_id: string;
            quantity: number;
            substituted_drug_id?: string | null;
            batch_number?: string;
            expiry_date?: string;
          }>;
          counselling_given: boolean;
          notes?: string | null;
        };
        const db = requireDb(deps);

        const ctxSnap = await db.collection(COLLECTIONS.verifySessions).doc(body.verification_id).get();
        if (!ctxSnap.exists) throw new AppError('RBAC_FORBIDDEN', { detail: 'verification_context_expired' });
        const ctx = ctxSnap.data() as VerifyContextDoc;
        if (
          ctx.prescription_id !== id ||
          ctx.pharmacist_id !== auth.userId ||
          new Date(ctx.expires_at).getTime() <= Date.now()
        ) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'verification_context_expired' });
        }

        const subDrugIds = body.items
          .map((i) => i.substituted_drug_id)
          .filter((v): v is string => Boolean(v));
        const subDrugs = new Map<string, DrugReferenceDoc>();
        for (const sId of subDrugIds) {
          const sSnap = await db.collection(COLLECTIONS.drugReference).doc(sId).get();
          if (sSnap.exists) subDrugs.set(sId, sSnap.data() as DrugReferenceDoc);
        }

        const dispenseResult = await db.runTransaction(async (tx) => {
          const rxRef = db.collection(COLLECTIONS.prescriptions).doc(id);
          const rxSnap = await tx.get(rxRef);
          if (!rxSnap.exists) throw new AppError('RX_NOT_FOUND');
          const rx = rxSnap.data() as PrescriptionDoc;

          if (body.expected_version !== undefined && rx.version !== body.expected_version) {
            throw new AppError('CONFLICT_VERSION');
          }
          if (rx.status === 'cancelled') throw new AppError('RX_CANCELLED');
          if (rx.status === 'expired' || new Date(rx.expires_at).getTime() <= Date.now()) {
            throw new AppError('RX_EXPIRED');
          }
          if (rx.status === 'dispensed') throw new AppError('RX_ALREADY_DISPENSED');

          const itemsSnap = await tx.get(
            db.collection(COLLECTIONS.prescriptionItems).where('prescription_id', '==', id),
          );
          const itemMap = new Map(
            itemsSnap.docs.map((d) => [d.id, { ref: d.ref, data: d.data() as PrescriptionItemDoc }]),
          );

          const qtyErrors: Array<{ path: string; code: string; message: string }> = [];
          for (const [idx, reqItem] of body.items.entries()) {
            const found = itemMap.get(reqItem.prescription_item_id);
            if (!found) throw new AppError('VALIDATION_FAILED', { detail: 'unknown_prescription_item' });
            const dbItem = found.data;
            if (dbItem.status === 'cancelled') throw new AppError('RX_CANCELLED');
            const remaining = dbItem.quantity_prescribed - dbItem.quantity_dispensed;
            if (remaining <= 0 || dbItem.status === 'dispensed') {
              throw new AppError('RX_ALREADY_DISPENSED');
            }
            if (reqItem.quantity > remaining) {
              qtyErrors.push({
                path: `items[${idx}].quantity`,
                code: 'too_big',
                message: `Max ${remaining}`,
              });
            }
            if (reqItem.substituted_drug_id && reqItem.substituted_drug_id !== dbItem.drug_id) {
              if (!dbItem.substitution_allowed) {
                throw new AppError('VALIDATION_FAILED', { detail: 'substitution_not_allowed' });
              }
              const alt = subDrugs.get(reqItem.substituted_drug_id);
              if (
                !alt ||
                alt.generic_name.toLowerCase() !== dbItem.drug_generic_name.toLowerCase() ||
                alt.strength.toLowerCase() !== dbItem.drug_strength.toLowerCase()
              ) {
                throw new AppError('VALIDATION_FAILED', { detail: 'substitution_not_bioequivalent' });
              }
            }
          }
          if (qtyErrors.length > 0) {
            throw new AppError('RX_QUANTITY_EXCEEDED', { errors: qtyErrors });
          }

          const dispId = randomUUID();
          const dispensedAt = new Date().toISOString();
          const outItems: Array<{
            prescription_item_id: string;
            quantity_dispensed_now: number;
            quantity_remaining: number;
            status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
          }> = [];

          for (const reqItem of body.items) {
            const entry = itemMap.get(reqItem.prescription_item_id)!;
            const newDispensed = Number(
              (entry.data.quantity_dispensed + reqItem.quantity).toFixed(2),
            );
            const remaining = Math.max(
              0,
              Number((entry.data.quantity_prescribed - newDispensed).toFixed(2)),
            );
            const itemStatus: 'partially_dispensed' | 'dispensed' =
              remaining === 0 ? 'dispensed' : 'partially_dispensed';

            tx.update(entry.ref, {
              quantity_dispensed: newDispensed,
              status: itemStatus,
            });
            entry.data.quantity_dispensed = newDispensed;
            entry.data.status = itemStatus;

            outItems.push({
              prescription_item_id: reqItem.prescription_item_id,
              quantity_dispensed_now: reqItem.quantity,
              quantity_remaining: remaining,
              status: itemStatus,
            });
          }

          const allDone = [...itemMap.values()].every(
            ({ data }) => data.status === 'dispensed' || data.status === 'cancelled',
          );
          const nextRxStatus: PrescriptionDoc['status'] = allDone
            ? 'dispensed'
            : 'partially_dispensed';
          const nextVersion = rx.version + 1;

          const dispDoc: DispensationDoc = {
            id: dispId,
            prescription_id: id,
            rx_number: rx.rx_number,
            patient_id: rx.patient_id,
            pharmacy_id: ctx.pharmacy_id,
            pharmacy_name: ctx.pharmacy_name,
            pharmacist_id: auth.userId,
            dispensed_at: dispensedAt,
            counselling_given: body.counselling_given,
            notes_enc: body.notes
              ? deps.fieldCipher.encrypt(body.notes, aad('dispensations', 'notes_enc', dispId))
              : null,
            items: body.items.map((it) => ({
              prescription_item_id: it.prescription_item_id,
              quantity: it.quantity,
              substituted_drug_id: it.substituted_drug_id ?? null,
              batch_number: it.batch_number ?? null,
              expiry_date: it.expiry_date ?? null,
            })),
          };

          tx.create(db.collection(COLLECTIONS.dispensations).doc(dispId), dispDoc);
          tx.update(rxRef, { status: nextRxStatus, version: nextVersion });
          tx.delete(db.collection(COLLECTIONS.dispenseLeases).doc(id));

          return {
            dispensation_id: dispId,
            prescription_status: nextRxStatus,
            patient_id: rx.patient_id,
            rx_number: rx.rx_number,
            items: outItems,
            dispensed_at: dispensedAt,
            version: nextVersion,
          };
        });

        await writeAuditLog(db, auth, {
          action: 'RX_DISPENSED',
          resourceType: 'dispensation',
          resourceId: dispenseResult.dispensation_id,
          patientId: dispenseResult.patient_id,
          metadata: {
            prescription_id: id,
            status: dispenseResult.prescription_status,
          },
        });

        await enqueueOutboxNotification(db, {
          user_id: dispenseResult.patient_id,
          channel: 'push',
          template: 'rx_dispensed',
          payload: {
            rx_number: dispenseResult.rx_number,
            status: dispenseResult.prescription_status,
          },
        });

        res.status(201).json({
          dispensation_id: dispenseResult.dispensation_id,
          prescription_status: dispenseResult.prescription_status,
          items: dispenseResult.items,
          dispensed_at: dispenseResult.dispensed_at,
          version: dispenseResult.version,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/pharmacy/dispensations',
    requirePermission('prescription:dispense'),
    validate({ query: PharmacyHistoryQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as { limit: number };
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.dispensations)
          .where('pharmacist_id', '==', auth.userId)
          .orderBy('dispensed_at', 'desc')
          .limit(query.limit)
          .get();

        res.status(200).json({
          data: snap.docs.map((d) => {
            const row = d.data() as DispensationDoc;
            return {
              dispensation_id: row.id,
              prescription_id: row.prescription_id,
              rx_number: row.rx_number,
              dispensed_at: row.dispensed_at,
              pharmacy_id: row.pharmacy_id,
              item_count: row.items.length,
            };
          }),
          next_cursor: null,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
