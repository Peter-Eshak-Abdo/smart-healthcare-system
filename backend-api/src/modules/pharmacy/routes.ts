import { randomInt, randomUUID } from 'node:crypto';
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
import { sql } from 'kysely';
import multer from 'multer';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { mapFaceAnalysisFailure } from '../../integrations/ai-client.js';
import { requirePermission } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { decodeCursor, encodeCursor } from '../../shared/pagination.js';
import { loadPrescriptionDetail } from '../prescriptions/detail.js';
import { buildCanonicalRxPayload, verifyPickupToken } from '../prescriptions/signing.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024, files: 5 },
});

function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return `${phone.slice(0, 6)}*****${phone.slice(-2)}`;
}

export function pharmacyRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.post(
    '/pharmacy/prescriptions/verify',
    requirePermission('prescription:verify'),
    validate({ body: VerifyPrescriptionRequestSchema }),
    async (_req, res, next) => {
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

        if (!auth.facilityIds.includes(body.pharmacy_id)) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'not_member_of_pharmacy' });
        }
        const pools = requirePools();

        let rxId: string;
        let method: 'pickup_token' | 'face_1to1' | 'sms_otp';
        let pickupJti: string | null = null;

        if (body.mode === 'pickup_token') {
          const claims = verifyPickupToken(body.pickup_token, deps.keyring.rxPublicKeys);
          if (!claims) {
            await deps.rateLimit.consume('rx_verify_fail', body.pharmacy_id, 1);
            throw new AppError('PICKUP_TOKEN_INVALID');
          }
          rxId = claims.rx;
          method = 'pickup_token';
          pickupJti = claims.jti;
        } else {
          const lookup = await withUserTx(pools, auth, async (tx) => {
            const resRows = await sql<{
              prescription_id: string;
              patient_id: string;
              verification_code_hash: string;
            }>`
              select prescription_id, patient_id, verification_code_hash
                from private.find_prescription_for_pharmacy(${body.rx_number})
            `.execute(tx);
            return resRows.rows[0] ?? null;
          });

          if (!lookup) {
            throw new AppError('RX_NOT_FOUND');
          }

          const codeOk = await argon2
            .verify(lookup.verification_code_hash, body.verification_code.toUpperCase())
            .catch(() => false);
          if (!codeOk) {
            await deps.rateLimit.consume('rx_verify_fail', body.pharmacy_id, 1);
            throw new AppError('VALIDATION_FAILED', { detail: 'invalid_verification_code' });
          }

          rxId = lookup.prescription_id;
          if (body.presence.method === 'sms_otp') {
            method = 'sms_otp';
            if (!body.presence.otp_request_id) {
              await deps.rateLimit.consume('otp_send', rxId, 1);
              const otpReqId = randomUUID();
              const otpCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
              await deps.redis.set(
                `rx:otp:${otpReqId}`,
                JSON.stringify({ rxId, code: otpCode }),
                'EX',
                300,
              );
              const phoneRow = await withUserTx(pools, auth, async (tx) => {
                const p = await sql<{ phone_enc: string | null }>`
                  select phone_enc from app.profiles where id = ${lookup.patient_id}::uuid
                `.execute(tx);
                return p.rows[0]?.phone_enc ?? null;
              });
              const plainPhone = phoneRow
                ? deps.fieldCipher.decrypt(
                    phoneRow,
                    aad('profiles', 'phone_enc', lookup.patient_id),
                  )
                : '+201000000000';
              res.status(202).json({
                otp_request_id: otpReqId,
                sent_to: maskPhone(plainPhone),
              });
              return;
            }

            const storedOtp = await deps.redis.get(`rx:otp:${body.presence.otp_request_id}`);
            if (!storedOtp) {
              throw new AppError('VALIDATION_FAILED', { detail: 'otp_expired_or_invalid' });
            }
            const parsedOtp = JSON.parse(storedOtp) as { rxId: string; code: string };
            if (parsedOtp.rxId !== rxId || parsedOtp.code !== body.presence.otp_code) {
              throw new AppError('VALIDATION_FAILED', { detail: 'otp_code_mismatch' });
            }
            await deps.redis.del(`rx:otp:${body.presence.otp_request_id}`);
          } else {
            method = 'face_1to1';
            const fvRaw = await deps.redis.get(`rx:fv:${body.presence.face_verification_id}`);
            if (!fvRaw) {
              throw new AppError('VALIDATION_FAILED', { detail: 'face_verification_expired' });
            }
            const fv = JSON.parse(fvRaw) as { patientId: string; matched: boolean };
            if (fv.patientId !== lookup.patient_id || !fv.matched) {
              throw new AppError('RBAC_FORBIDDEN', { detail: 'face_verification_mismatch' });
            }
          }
        }

        const verification = await withUserTx(pools, auth, async (tx) => {
          const ctxRes = await sql<{
            id: string;
            result: 'valid' | 'already_dispensed' | 'expired' | 'cancelled' | 'prescriber_invalid';
            expires_at: string;
          }>`
            select id, result, expires_at::text
              from private.open_pharmacy_context(
                ${rxId}::uuid,
                ${body.pharmacy_id}::uuid,
                ${method}::app.verification_method,
                ${pickupJti}
              )
          `.execute(tx);

          const verRow = ctxRes.rows[0]!;
          const rxMeta = await sql<{
            id: string;
            rx_number: string;
            patient_id: string;
            doctor_id: string;
            facility_id: string;
            issued_at: string;
            expires_at: string;
            signature: Buffer | null;
            signature_kid: string | null;
            license_number: string;
            license_status: 'pending' | 'verified' | 'suspended' | 'revoked' | 'expired';
          }>`
            select
              rx.id, rx.rx_number, rx.patient_id, rx.doctor_id, rx.facility_id,
              rx.issued_at::text, rx.expires_at::text, rx.signature, rx.signature_kid,
              dr.license_number, dr.license_status
            from app.prescriptions rx
            join app.practitioners dr on dr.id = rx.doctor_id
            where rx.id = ${rxId}::uuid
          `.execute(tx);

          const hdr = rxMeta.rows[0]!;
          const detail = await loadPrescriptionDetail(tx, deps, rxId, 'pharmacist');

          const canonical = buildCanonicalRxPayload(
            hdr,
            detail.items.map((it) => ({
              id: it.id,
              drug_id: it.drug.id,
              dose: it.dose,
              route: it.route,
              frequency: it.frequency,
              frequency_interval_hours: null,
              duration_days: it.duration_days,
              quantity: it.quantity_prescribed,
              quantity_unit: it.quantity_unit,
              substitution_allowed: it.substitution_allowed,
            })),
            hdr.license_number,
          );

          const sigOk =
            Boolean(hdr.signature) &&
            Boolean(hdr.signature_kid) &&
            deps.signer.verifyRx(canonical, Buffer.from(hdr.signature!), hdr.signature_kid!);

          if (!sigOk) {
            await writeAuditLog(tx, auth, {
              action: 'RX_FORGED_SIGNATURE_DETECTED',
              resourceType: 'prescription',
              resourceId: rxId,
              outcome: 'denied',
            });
            throw new AppError('RX_SIGNATURE_INVALID');
          }

          const patInfo = await sql<{
            full_name: string;
            date_of_birth: string;
            sex: 'male' | 'female';
          }>`
            select prof.full_name, pt.date_of_birth::text, pt.sex
              from app.patients pt
              join app.profiles prof on prof.id = pt.id
             where pt.id = ${hdr.patient_id}::uuid
          `.execute(tx);
          const pRow = patInfo.rows[0]!;

          const algRows = await sql<{
            name: string;
            severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
          }>`
            select coalesce(i.name_en, c.name_en, a.free_text, 'Allergy') as name, a.severity
              from app.allergies a
              left join ref.ingredients i on i.code = a.ingredient_code
              left join ref.drug_classes c on c.code = a.drug_class_code
             where a.patient_id = ${hdr.patient_id}::uuid
               and a.is_active
               and a.verification <> 'refuted'
          `.execute(tx);

          await writeAuditLog(tx, auth, {
            action: 'RX_VERIFIED',
            resourceType: 'prescription',
            resourceId: rxId,
            patientId: hdr.patient_id,
            metadata: { method, result: verRow.result },
          });

          return {
            verification_id: verRow.id,
            result: verRow.result,
            valid_until: new Date(verRow.expires_at).toISOString(),
            prescription: {
              ...detail,
              dispensations: detail.dispensations.map((d) => ({
                ...d,
                pharmacy: { id: d.pharmacy.id, name: d.pharmacy.name },
              })),
            },
            patient_for_pharmacy: {
              full_name: pRow.full_name,
              age: calculateAge(pRow.date_of_birth),
              sex: pRow.sex,
              allergies: algRows.rows,
            },
            prescriber_status: {
              license_status: hdr.license_status,
              note: hdr.license_status === 'verified' ? null : 'Prescriber licence requires review',
            },
            checks: {
              signature: 'ok' as const,
              payload_integrity: 'ok' as const,
              expiry: verRow.result === 'expired' ? ('expired' as const) : ('ok' as const),
              status:
                verRow.result === 'already_dispensed'
                  ? ('already_dispensed' as const)
                  : verRow.result === 'cancelled'
                    ? ('cancelled' as const)
                    : ('ok' as const),
              prescriber: verRow.result === 'prescriber_invalid' ? ('invalid' as const) : ('ok' as const),
            },
          };
        });

        res.status(200).json(verification);
      } catch (err) {
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
        const pools = requirePools();

        const data = await withUserTx(pools, auth, async (tx) => {
          const ctx = await tx
            .selectFrom('app.rx_verifications')
            .select(['id', 'prescription_id', 'pharmacist_id', 'expires_at'])
            .where('id', '=', verification_id)
            .where('prescription_id', '=', id)
            .where('pharmacist_id', '=', auth.userId)
            .executeTakeFirst();

          if (!ctx || new Date(ctx.expires_at).getTime() <= Date.now()) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'verification_context_expired' });
          }

          const detail = await loadPrescriptionDetail(tx, deps, id, 'pharmacist');
          const pRow = await sql<{
            full_name: string;
            date_of_birth: string;
            sex: 'male' | 'female';
          }>`
            select prof.full_name, pt.date_of_birth::text, pt.sex
              from app.patients pt
              join app.profiles prof on prof.id = pt.id
             where pt.id = ${detail.patient.id}::uuid
          `.execute(tx);
          const pat = pRow.rows[0]!;

          const algRows = await sql<{
            name: string;
            severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
          }>`
            select coalesce(i.name_en, c.name_en, a.free_text, 'Allergy') as name, a.severity
              from app.allergies a
              left join ref.ingredients i on i.code = a.ingredient_code
              left join ref.drug_classes c on c.code = a.drug_class_code
             where a.patient_id = ${detail.patient.id}::uuid
               and a.is_active
               and a.verification <> 'refuted'
          `.execute(tx);

          return {
            prescription: detail,
            patient_for_pharmacy: {
              full_name: pat.full_name,
              age: calculateAge(pat.date_of_birth),
              sex: pat.sex,
              allergies: algRows.rows,
            },
          };
        });

        res.status(200).json(data);
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
        const pools = requirePools();

        const lease = await withUserTx(pools, auth, async (tx) => {
          const ctx = await tx
            .selectFrom('app.rx_verifications')
            .select(['pharmacy_id', 'expires_at'])
            .where('id', '=', body.verification_id)
            .where('prescription_id', '=', id)
            .where('pharmacist_id', '=', auth.userId)
            .executeTakeFirst();

          if (!ctx || new Date(ctx.expires_at).getTime() <= Date.now()) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'verification_context_expired' });
          }

          const existing = await sql<{
            pharmacy_id: string;
            pharmacy_name: string;
            expires_at: string;
          }>`
            select l.pharmacy_id, f.name as pharmacy_name, l.expires_at::text
              from app.dispense_leases l
              join app.facilities f on f.id = l.pharmacy_id
             where l.prescription_id = ${id}::uuid
             for update
          `.execute(tx);

          const cur = existing.rows[0];
          if (
            cur &&
            new Date(cur.expires_at).getTime() > Date.now() &&
            cur.pharmacy_id !== ctx.pharmacy_id &&
            !body.force
          ) {
            throw new AppError('RX_LEASE_HELD', {
              extra: {
                held_by_pharmacy: cur.pharmacy_name,
                expires_at: new Date(cur.expires_at).toISOString(),
              },
            });
          }

          if (cur && body.force) {
            await writeAuditLog(tx, auth, {
              action: 'RX_LEASE_FORCED',
              resourceType: 'prescription',
              resourceId: id,
            });
          }

          const leaseExp = new Date(Date.now() + 5 * 60_000).toISOString();
          await sql`
            insert into app.dispense_leases (prescription_id, pharmacy_id, pharmacist_id, expires_at)
            values (${id}::uuid, ${ctx.pharmacy_id}::uuid, ${auth.userId}::uuid, ${leaseExp}::timestamptz)
            on conflict (prescription_id) do update
              set pharmacy_id = excluded.pharmacy_id,
                  pharmacist_id = excluded.pharmacist_id,
                  created_at = now(),
                  expires_at = excluded.expires_at
          `.execute(tx);

          return { lease_id: id, expires_at: leaseExp };
        });

        res.status(201).json(lease);
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
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const pools = requirePools();
        await withUserTx(pools, auth, async (tx) => {
          await tx
            .deleteFrom('app.dispense_leases')
            .where('prescription_id', '=', id)
            .where('pharmacist_id', '=', auth.userId)
            .execute();
        });
        res.status(204).send();
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
        const idemKey = res.locals.idempotencyKey ?? randomUUID();
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as {
          verification_id: string;
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
        const pools = requirePools();

        const result = await withUserTx(pools, auth, async (tx) => {
          const ctx = await tx
            .selectFrom('app.rx_verifications')
            .select(['id', 'prescription_id', 'pharmacy_id', 'method', 'pickup_jti', 'expires_at'])
            .where('id', '=', body.verification_id)
            .where('prescription_id', '=', id)
            .where('pharmacist_id', '=', auth.userId)
            .executeTakeFirst();

          if (!ctx || new Date(ctx.expires_at).getTime() <= Date.now()) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'verification_context_expired' });
          }

          // Lock prescription header FOR UPDATE to serialize concurrent dispensations (E-RX-02)
          const rxRes = await sql<{
            id: string;
            patient_id: string;
            status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
            expires_at: string;
            prescriber_invalid: boolean;
            version: number;
          }>`
            select id, patient_id, status, expires_at::text, prescriber_invalid, version
              from app.prescriptions
             where id = ${id}::uuid
             for update
          `.execute(tx);

          const rx = rxRes.rows[0];
          if (!rx) throw new AppError('RX_NOT_FOUND');
          if (rx.prescriber_invalid) throw new AppError('RX_PRESCRIBER_INVALID');
          if (rx.status === 'cancelled') throw new AppError('RX_CANCELLED');
          if (rx.status === 'expired' || new Date(rx.expires_at).getTime() <= Date.now()) {
            throw new AppError('RX_EXPIRED');
          }
          if (rx.status === 'dispensed') throw new AppError('RX_ALREADY_DISPENSED');

          const rxItemsRes = await sql<{
            id: string;
            drug_id: string;
            quantity_prescribed: string;
            quantity_dispensed: string;
            substitution_allowed: boolean;
            status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
          }>`
            select id, drug_id, quantity_prescribed::text, quantity_dispensed::text, substitution_allowed, status
              from app.prescription_items
             where prescription_id = ${id}::uuid
             for update
          `.execute(tx);

          const itemMap = new Map(rxItemsRes.rows.map((r) => [r.id, r]));

          // Validate each item + substitution equivalence before insert
          const qtyErrors: Array<{ path: string; code: string; message: string }> = [];
          for (const [idx, reqItem] of body.items.entries()) {
            const dbItem = itemMap.get(reqItem.prescription_item_id);
            if (!dbItem) {
              throw new AppError('VALIDATION_FAILED', { detail: 'unknown_prescription_item' });
            }
            if (dbItem.status === 'cancelled') {
              throw new AppError('RX_CANCELLED');
            }
            const remaining =
              Number.parseFloat(dbItem.quantity_prescribed) -
              Number.parseFloat(dbItem.quantity_dispensed);
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
              const equiv = await sql<{ same: boolean }>`
                with orig as (
                  select array_agg((ingredient_code || ':' || coalesce(strength_value::text,'') || ':' || coalesce(strength_unit,'')) order by ingredient_code) as sig
                    from ref.drug_ingredients where drug_id = ${dbItem.drug_id}::uuid
                ), sub as (
                  select array_agg((ingredient_code || ':' || coalesce(strength_value::text,'') || ':' || coalesce(strength_unit,'')) order by ingredient_code) as sig
                    from ref.drug_ingredients where drug_id = ${reqItem.substituted_drug_id}::uuid
                )
                select (select sig from orig) = (select sig from sub) as same
              `.execute(tx);
              if (!equiv.rows[0]?.same) {
                throw new AppError('VALIDATION_FAILED', { detail: 'substitution_not_bioequivalent' });
              }
            }
          }

          if (qtyErrors.length > 0) {
            throw new AppError('RX_QUANTITY_EXCEEDED', { errors: qtyErrors });
          }

          const dispId = randomUUID();
          const insertedDisp = await tx
            .insertInto('app.dispensations')
            .values({
              id: dispId,
              prescription_id: id,
              pharmacy_id: ctx.pharmacy_id,
              pharmacist_id: auth.userId,
              verification_id: ctx.id,
              verification_method: ctx.method,
              idempotency_key: idemKey,
              pickup_jti: ctx.pickup_jti,
              counselling_given: body.counselling_given,
              notes_enc: body.notes
                ? deps.fieldCipher.encrypt(body.notes, aad('dispensations', 'notes_enc', dispId))
                : null,
            })
            .returning('dispensed_at')
            .executeTakeFirstOrThrow();

          const dispensedItemsOut = [];
          for (const reqItem of body.items) {
            await tx
              .insertInto('app.dispensation_items')
              .values({
                dispensation_id: dispId,
                prescription_item_id: reqItem.prescription_item_id,
                quantity: String(reqItem.quantity),
                substituted_drug_id: reqItem.substituted_drug_id ?? null,
                batch_number: reqItem.batch_number ?? null,
                expiry_date: reqItem.expiry_date ?? null,
              })
              .execute();

            const afterItem = await tx
              .selectFrom('app.prescription_items')
              .select(['quantity_prescribed', 'quantity_dispensed', 'status'])
              .where('id', '=', reqItem.prescription_item_id)
              .executeTakeFirstOrThrow();

            dispensedItemsOut.push({
              prescription_item_id: reqItem.prescription_item_id,
              quantity_dispensed_now: reqItem.quantity,
              quantity_remaining: Math.max(
                0,
                Number(
                  (
                    Number.parseFloat(afterItem.quantity_prescribed) -
                    Number.parseFloat(afterItem.quantity_dispensed)
                  ).toFixed(2),
                ),
              ),
              status: afterItem.status,
            });
          }

          const afterRx = await tx
            .updateTable('app.prescriptions')
            .set({ version: rx.version + 1 })
            .where('id', '=', id)
            .returning(['status', 'version'])
            .executeTakeFirstOrThrow();

          await tx.deleteFrom('app.dispense_leases').where('prescription_id', '=', id).execute();

          await writeAuditLog(tx, auth, {
            action: 'RX_DISPENSED',
            resourceType: 'dispensation',
            resourceId: dispId,
            patientId: rx.patient_id,
            metadata: { prescription_id: id, status: afterRx.status },
          });

          return {
            dispensation_id: dispId,
            prescription_status: afterRx.status,
            items: dispensedItemsOut,
            dispensed_at: new Date(insertedDisp.dispensed_at).toISOString(),
            version: afterRx.version,
          };
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/pharmacy/face-verifications',
    requirePermission('prescription:verify'),
    upload.array('frames', 5),
    async (req, res, next) => {
      const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
      try {
        const auth = res.locals.auth!;
        const { challenge_id, rx_number, pharmacy_id } = req.body as {
          challenge_id?: string;
          rx_number?: string;
          pharmacy_id?: string;
        };
        if (!challenge_id || !rx_number || !pharmacy_id || files.length === 0) {
          throw new AppError('VALIDATION_FAILED', { detail: 'missing_face_verification_fields' });
        }
        if (!auth.facilityIds.includes(pharmacy_id)) {
          throw new AppError('RBAC_FORBIDDEN');
        }
        const pools = requirePools();

        const lookup = await withUserTx(pools, auth, async (tx) => {
          const r = await sql<{ prescription_id: string; patient_id: string }>`
            select prescription_id, patient_id
              from private.find_prescription_for_pharmacy(${rx_number})
          `.execute(tx);
          return r.rows[0] ?? null;
        });
        if (!lookup) throw new AppError('RX_NOT_FOUND');

        const chRaw = await deps.redis.get(`bio:ch:${challenge_id}`);
        if (!chRaw) throw new AppError('BIO_LIVENESS_FAILED');
        await deps.redis.del(`bio:ch:${challenge_id}`);
        const ch = JSON.parse(chRaw) as { sequence: string[] };

        const analysis = await deps.aiClient.analyzeFace({
          mode: 'verify',
          livenessMode: 'active',
          challenge: { challenge_id, sequence: ch.sequence },
          frames: files.map((f) => f.buffer),
          priority: 'general',
        });

        if (!analysis.face_detected || analysis.face_count !== 1 || !analysis.quality.passed || !analysis.liveness.passed || !analysis.template) {
          throw mapFaceAnalysisFailure(analysis);
        }

        const vecLiteral = `[${analysis.template.vector.join(',')}]`;
        const matched = await withUserTx(pools, auth, async (tx) => {
          const rows = await sql<{ patient_id: string; similarity: number }>`
            select patient_id, similarity
              from private.match_face(
                ${vecLiteral}::extensions.vector,
                ${analysis.model_version},
                ${analysis.transform_key_version},
                5
              )
          `.execute(tx);
          const hit = rows.rows.find((r) => r.patient_id === lookup.patient_id);
          return Boolean(hit && hit.similarity >= deps.env.FACE_MATCH_ACCEPT);
        });

        const fvId = randomUUID();
        await deps.redis.set(
          `rx:fv:${fvId}`,
          JSON.stringify({ patientId: lookup.patient_id, matched }),
          'EX',
          300,
        );

        res.status(200).json({
          face_verification_id: fvId,
          result: matched ? 'match' : 'no_match',
          valid_for_seconds: 300,
        });
      } catch (err) {
        next(err);
      } finally {
        for (const f of files) {
          f.buffer.fill(0);
        }
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
        const query = res.locals.validated!.query as {
          from?: string;
          to?: string;
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const page = await withUserTx(pools, auth, async (tx) => {
          const rows = (
            await sql<{
              dispensation_id: string;
              prescription_id: string;
              rx_number: string;
              dispensed_at: string;
              pharmacy_id: string;
              item_count: string;
            }>`
              select
                d.id as dispensation_id,
                d.prescription_id,
                rx.rx_number,
                d.dispensed_at::text,
                d.pharmacy_id,
                count(di.id)::text as item_count
              from app.dispensations d
              join app.prescriptions rx on rx.id = d.prescription_id
              left join app.dispensation_items di on di.dispensation_id = d.id
              where d.pharmacy_id = any(${auth.facilityIds}::uuid[])
                and (${query.from ?? null}::timestamptz is null or d.dispensed_at >= ${query.from ?? null}::timestamptz)
                and (${query.to ?? null}::timestamptz is null or d.dispensed_at < ${query.to ?? null}::timestamptz)
                and (
                  ${cursor === null}::boolean
                  or (d.dispensed_at, d.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              group by d.id, rx.rx_number
              order by d.dispensed_at desc, d.id desc
              limit ${query.limit + 1}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => ({
              dispensation_id: r.dispensation_id,
              prescription_id: r.prescription_id,
              rx_number: r.rx_number,
              dispensed_at: new Date(r.dispensed_at).toISOString(),
              pharmacy_id: r.pharmacy_id,
              item_count: Number.parseInt(r.item_count, 10),
            })),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.dispensed_at, id: last.dispensation_id }, deps.keyring.blindIndexKey)
                  : null,
              has_more: hasMore,
            },
          };
        });

        res.status(200).json(page);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
