import { randomUUID } from 'node:crypto';
import {
  CancelPrescriptionRequestSchema,
  CheckPrescriptionsRequestSchema,
  DoctorPrescriptionsQuerySchema,
  IdParamSchema,
  IssuePrescriptionRequestSchema,
} from '@smarthealth/contracts';
import argon2 from 'argon2';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { requirePermission, requireRecentAuth } from '../../middleware/authorize.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { AppError } from '../../shared/errors.js';
import { decodeCursor, encodeCursor } from '../../shared/pagination.js';
import { getRequestLocale } from '../../shared/request-context.js';
import { loadPrescriptionDetail } from './detail.js';
import { runClinicalSafetyCheck } from './safety.js';
import { buildCanonicalRxPayload, generatePaperCode } from './signing.js';

export function prescriptionRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

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
        const pools = requirePools();
        const locale = getRequestLocale();

        const check = await withUserTx(pools, auth, async (tx) => {
          const hasGrantRes = await sql<{ granted: boolean }>`
            select private.has_grant(${body.patient_id}::uuid, 'read_only') as granted
          `.execute(tx);
          if (!hasGrantRes.rows[0]?.granted) {
            throw new AppError('ACCESS_GRANT_REQUIRED');
          }

          return runClinicalSafetyCheck(tx, deps, {
            patientId: body.patient_id,
            doctorId: auth.userId,
            items: body.items,
            locale,
          });
        });

        res.status(200).json({
          checks_status: check.checks_status,
          engine_version: check.engine_version,
          dataset_version: check.dataset_version,
          alerts: check.alerts.map((a) => ({
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
            frequency:
              | 'once_daily'
              | 'twice_daily'
              | 'three_times_daily'
              | 'four_times_daily'
              | 'every_x_hours'
              | 'at_bedtime'
              | 'as_needed'
              | 'once'
              | 'weekly';
            frequency_interval_hours?: number | null;
            duration_days: number;
            quantity: number;
            quantity_unit: string;
            instructions?: string;
            substitution_allowed: boolean;
          }>;
          overrides: Array<{
            alert_key: string;
            reason_code: string;
            justification: string;
          }>;
          manual_review_attested: boolean;
          notes_to_pharmacist?: string;
        };
        const pools = requirePools();
        const locale = getRequestLocale();

        const detail = await withUserTx(pools, auth, async (tx) => {
          const enc = await tx
            .selectFrom('app.encounters')
            .select(['id', 'patient_id', 'doctor_id', 'facility_id', 'status', 'ended_at'])
            .where('id', '=', body.encounter_id)
            .where('patient_id', '=', body.patient_id)
            .executeTakeFirst();

          if (!enc || enc.doctor_id !== auth.userId) {
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
          const drugRows = await sql<{
            id: string;
            base_unit: string;
            is_controlled: boolean;
            is_active: boolean;
          }>`
            select id, base_unit, is_controlled, is_active
              from ref.drugs
             where id = any(${drugIds}::uuid[])
          `.execute(tx);

          const drugMap = new Map(drugRows.rows.map((d) => [d.id, d]));
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

          const safety = await runClinicalSafetyCheck(tx, deps, {
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
          const blocking = safety.alerts.filter((a) => a.requires_override);
          const missing = blocking.filter((a) => !overrideMap.has(a.alert_key));
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

          const rxId = randomUUID();
          const hasControlled = body.items.some((i) => drugMap.get(i.drug_id)?.is_controlled);
          const validDays = hasControlled ? 7 : 30;
          const issuedAt = new Date();
          const expiresAt = new Date(issuedAt.getTime() + validDays * 86_400 * 1000);
          const paperCode = generatePaperCode();
          const paperCodeHash = await argon2.hash(paperCode, {
            type: argon2.argon2id,
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          });

          const header = await tx
            .insertInto('app.prescriptions')
            .values({
              id: rxId,
              patient_id: body.patient_id,
              doctor_id: auth.userId,
              facility_id: enc.facility_id,
              encounter_id: enc.id,
              status: 'pending',
              issued_at: issuedAt.toISOString(),
              expires_at: expiresAt.toISOString(),
              notes_to_pharmacist_enc: body.notes_to_pharmacist
                ? deps.fieldCipher.encrypt(
                    body.notes_to_pharmacist,
                    aad('prescriptions', 'notes_to_pharmacist_enc', rxId),
                  )
                : null,
              safety_check_bypassed: safety.checks_status === 'unavailable',
              verification_code_hash: paperCodeHash,
              prescriber_invalid: false,
            })
            .returning(['id', 'rx_number', 'patient_id', 'doctor_id', 'facility_id', 'issued_at', 'expires_at'])
            .executeTakeFirstOrThrow();

          const insertedItems = [];
          for (const item of body.items) {
            const drug = drugMap.get(item.drug_id)!;
            const itemId = randomUUID();
            const subAllowed = drug.is_controlled ? false : item.substitution_allowed;
            await tx
              .insertInto('app.prescription_items')
              .values({
                id: itemId,
                prescription_id: rxId,
                drug_id: item.drug_id,
                dose: item.dose,
                route: item.route,
                frequency: item.frequency,
                frequency_interval_hours: item.frequency_interval_hours ?? null,
                duration_days: item.duration_days,
                quantity_prescribed: String(item.quantity),
                quantity_unit: item.quantity_unit,
                instructions: item.instructions ?? null,
                substitution_allowed: subAllowed,
                status: 'pending',
              })
              .execute();

            insertedItems.push({
              id: itemId,
              drug_id: item.drug_id,
              dose: item.dose,
              route: item.route,
              frequency: item.frequency,
              frequency_interval_hours: item.frequency_interval_hours ?? null,
              duration_days: item.duration_days,
              quantity: item.quantity,
              quantity_unit: item.quantity_unit,
              substitution_allowed: subAllowed,
            });
          }

          for (const alert of safety.alerts) {
            const alertId = randomUUID();
            const ov = overrideMap.get(alert.alert_key);
            await tx
              .insertInto('app.clinical_alerts')
              .values({
                id: alertId,
                prescription_id: rxId,
                patient_id: body.patient_id,
                doctor_id: auth.userId,
                alert_key: alert.alert_key,
                alert_type: alert.type,
                severity: alert.severity,
                rule_id: alert.rule_id,
                source: alert.source,
                engine_version: alert.engine_version,
                dataset_version: alert.dataset_version,
                overridden: Boolean(ov),
                override_reason_code: ov?.reason_code ?? null,
                override_justification_enc: ov
                  ? deps.fieldCipher.encrypt(
                      ov.justification,
                      aad('clinical_alerts', 'override_justification_enc', alertId),
                    )
                  : null,
                overridden_at: ov ? issuedAt.toISOString() : null,
              })
              .execute();

            if (ov) {
              await writeAuditLog(tx, auth, {
                action: 'ALERT_OVERRIDDEN',
                resourceType: 'prescription',
                resourceId: rxId,
                patientId: body.patient_id,
                metadata: { alert_key: ov.alert_key, reason_code: ov.reason_code },
              });
            }
          }

          const canonical = buildCanonicalRxPayload(
            header,
            insertedItems,
            auth.licenseNumber ?? '',
          );
          const { signature, kid, sha256 } = deps.signer.signRx(canonical);

          await tx
            .updateTable('app.prescriptions')
            .set({
              signature,
              signature_kid: kid,
              payload_sha256: sha256,
            })
            .where('id', '=', rxId)
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'RX_ISSUED',
            resourceType: 'prescription',
            resourceId: rxId,
            patientId: body.patient_id,
            metadata: { rx_number: header.rx_number, item_count: insertedItems.length },
          });

          const dto = await loadPrescriptionDetail(tx, deps, rxId, 'doctor');
          return {
            ...dto,
            verification_code_hint: `Show this code if you have no phone: ${paperCode}`,
          };
        });

        res.status(201).json(detail);
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
          reason_code:
            | 'prescribing_error'
            | 'patient_request'
            | 'therapy_changed'
            | 'adverse_reaction'
            | 'other';
          item_ids: string[] | null;
        };
        const pools = requirePools();

        const detail = await withUserTx(pools, auth, async (tx) => {
          const rx = await tx
            .selectFrom('app.prescriptions')
            .select(['id', 'patient_id', 'doctor_id', 'status'])
            .where('id', '=', id)
            .executeTakeFirst();

          if (!rx) throw new AppError('RX_NOT_FOUND');
          if (rx.doctor_id !== auth.userId) {
            throw new AppError('RBAC_FORBIDDEN');
          }
          if (rx.status === 'dispensed') {
            throw new AppError('RX_ALREADY_DISPENSED');
          }
          if (rx.status === 'cancelled') {
            throw new AppError('RX_CANCELLED');
          }

          const targetItemIds = body.item_ids;
          if (targetItemIds && targetItemIds.length > 0) {
            await tx
              .updateTable('app.prescription_items')
              .set({ status: 'cancelled' })
              .where('prescription_id', '=', id)
              .where('id', 'in', targetItemIds)
              .where('status', 'in', ['pending', 'partially_dispensed'])
              .execute();
          } else {
            await tx
              .updateTable('app.prescription_items')
              .set({ status: 'cancelled' })
              .where('prescription_id', '=', id)
              .where('status', 'in', ['pending', 'partially_dispensed'])
              .execute();
            await tx
              .updateTable('app.prescriptions')
              .set({
                status: 'cancelled',
                cancel_reason_code: body.reason_code,
                cancelled_at: sql`now()`,
              })
              .where('id', '=', id)
              .execute();
          }

          await writeAuditLog(tx, auth, {
            action: 'RX_CANCELLED',
            resourceType: 'prescription',
            resourceId: id,
            patientId: rx.patient_id,
            reason: body.reason_code,
          });

          return loadPrescriptionDetail(tx, deps, id, 'doctor');
        });

        res.status(200).json(detail);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/doctor/prescriptions',
    requirePermission('prescription:check'),
    validate({ query: DoctorPrescriptionsQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          status?: string;
          patient_id?: string;
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
              id: string;
              rx_number: string;
              status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
              issued_at: string;
              expires_at: string;
              patient_id: string;
              patient_mrn: string;
              patient_name: string;
              item_count: string;
            }>`
              select
                rx.id, rx.rx_number, rx.status, rx.issued_at::text, rx.expires_at::text,
                pt.id as patient_id, pt.mrn as patient_mrn, prof.full_name as patient_name,
                count(pi.id)::text as item_count
              from app.prescriptions rx
              join app.patients pt on pt.id = rx.patient_id
              join app.profiles prof on prof.id = pt.id
              left join app.prescription_items pi on pi.prescription_id = rx.id
              where rx.doctor_id = ${auth.userId}::uuid
                and (${query.status ?? null}::text is null or rx.status::text = ${query.status ?? null})
                and (${query.patient_id ?? null}::uuid is null or rx.patient_id = ${query.patient_id ?? null}::uuid)
                and (
                  ${cursor === null}::boolean
                  or (rx.issued_at, rx.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              group by rx.id, pt.id, prof.full_name
              order by rx.issued_at desc, rx.id desc
              limit ${query.limit + 1}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => ({
              id: r.id,
              rx_number: r.rx_number,
              status: r.status,
              issued_at: new Date(r.issued_at).toISOString(),
              expires_at: new Date(r.expires_at).toISOString(),
              patient: {
                id: r.patient_id,
                mrn: r.patient_mrn,
                full_name: r.patient_name,
              },
              item_count: Number.parseInt(r.item_count, 10),
            })),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.issued_at, id: last.id }, deps.keyring.blindIndexKey)
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
