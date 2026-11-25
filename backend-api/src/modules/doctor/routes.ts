import { randomUUID } from 'node:crypto';
import {
  CreateAddendumRequestSchema,
  CreateAllergyRequestSchema,
  CreateConditionRequestSchema,
  CreateDiagnosisRequestSchema,
  CreateEncounterRequestSchema,
  DoctorPatientsQuerySchema,
  DoctorUpdateBloodTypeRequestSchema,
  EncounterIdParamSchema,
  EnteredInErrorRequestSchema,
  MedicalHistoryQuerySchema,
  PatchConditionRequestSchema,
  PatchEncounterRequestSchema,
  PatientAllergyParamSchema,
  PatientConditionParamSchema,
  PatientIdParamSchema,
  RedeemShareCodeRequestSchema,
  VerifyAllergyRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { decodeCursor, encodeCursor } from '../../shared/pagination.js';
import { computeShareCodeHmac } from '../access/routes.js';
import { fetchAllergyDtoById, loadCriticalInfo } from '../patients/shared.js';

export function doctorRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.post(
    '/doctor/access/redeem',
    requirePermission('patient_record:read:granted'),
    validate({ body: RedeemShareCodeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as { patient_mrn: string; code: string };
        const pools = requirePools();
        const hmac = computeShareCodeHmac(deps.keyring.blindIndexKey, body.patient_mrn, body.code);

        const grant = await withUserTx(pools, auth, async (tx) => {
          const resRow = await sql<{
            id: string | null;
            patient_id: string | null;
            scope: 'read_only' | 'read_write' | null;
            expires_at: string | null;
          }>`
            select id, patient_id, scope, expires_at::text
              from private.redeem_share_code(${body.patient_mrn}, ${hmac})
          `.execute(tx);

          const g = resRow.rows[0];
          if (!g?.id || !g.patient_id || !g.scope || !g.expires_at) {
            return null;
          }

          await writeAuditLog(tx, auth, {
            action: 'ACCESS_GRANTED',
            resourceType: 'access_grant',
            resourceId: g.id,
            patientId: g.patient_id,
            metadata: { scope: g.scope },
          });

          return {
            grant_id: g.id,
            patient_id: g.patient_id,
            scope: g.scope,
            expires_at: new Date(g.expires_at).toISOString(),
          };
        });

        if (!grant) {
          await deps.rateLimit.consume('share_code_fail', auth.userId, 1);
          throw new AppError('VALIDATION_FAILED', { detail: 'invalid_or_expired_code' });
        }

        res.status(201).json(grant);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/doctor/patients',
    requirePermission('patient_record:read:granted'),
    validate({ query: DoctorPatientsQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          query?: string;
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const qTrim = query.query?.trim() ?? '';
        const isNationalId = /^\d{14}$/.test(qTrim);
        const nidBidx = isNationalId
          ? deps.fieldCipher.blindIndex(`national_id:${qTrim}`, 'id_document')
          : null;
        const mrnUpper = qTrim.length > 0 ? qTrim.toUpperCase() : null;

        const result = await withUserTx(pools, auth, async (tx) => {
          const rows = (
            await sql<{
              patient_id: string;
              mrn: string;
              full_name: string;
              date_of_birth: string;
              sex: 'male' | 'female';
              grant_id: string;
              grant_expires_at: string;
              granted_at: string;
            }>`
              select
                p.id as patient_id,
                p.mrn,
                pr.full_name,
                p.date_of_birth::text,
                p.sex,
                ag.id as grant_id,
                ag.expires_at::text as grant_expires_at,
                ag.granted_at::text as granted_at
              from app.patients p
              join app.profiles pr on pr.id = p.id
              join app.access_grants ag
                on ag.patient_id = p.id
               and ag.practitioner_id = ${auth.userId}::uuid
               and ag.status = 'active'
               and ag.expires_at > now()
              where (
                ${qTrim.length === 0}::boolean
                or (${isNationalId}::boolean and p.id_document_bidx = ${nidBidx})
                or (${!isNationalId && mrnUpper !== null}::boolean and (p.mrn = ${mrnUpper} or pr.full_name ilike ${`%${qTrim}%`}))
              )
              and (
                ${cursor === null}::boolean
                or (ag.granted_at, p.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
              )
              order by ag.granted_at desc, p.id desc
              limit ${query.limit + 1}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => ({
              patient_id: r.patient_id,
              mrn: r.mrn,
              full_name: r.full_name,
              age: calculateAge(r.date_of_birth),
              sex: r.sex,
              grant: {
                id: r.grant_id,
                expires_at: new Date(r.grant_expires_at).toISOString(),
              },
            })),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.granted_at, id: last.patient_id }, deps.keyring.blindIndexKey)
                  : null,
              has_more: hasMore,
            },
          };
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/doctor/patients/:patientId/summary',
    requirePermission('patient_record:read:granted'),
    validate({ params: PatientIdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const pools = requirePools();

        const summary = await withUserTx(pools, auth, async (tx) => {
          const patRes = await sql<{
            id: string;
            mrn: string;
            full_name: string;
            date_of_birth: string;
            sex: 'male' | 'female';
            grant_id: string;
            grant_scope: 'read_only' | 'read_write';
            grant_expires_at: string;
          }>`
            select
              p.id, p.mrn, pr.full_name, p.date_of_birth::text, p.sex,
              ag.id as grant_id, ag.scope as grant_scope, ag.expires_at::text as grant_expires_at
            from app.patients p
            join app.profiles pr on pr.id = p.id
            join app.access_grants ag
              on ag.patient_id = p.id
             and ag.practitioner_id = ${auth.userId}::uuid
             and ag.status = 'active'
             and ag.expires_at > now()
            where p.id = ${patientId}::uuid
            order by ag.granted_at desc
            limit 1
          `.execute(tx);

          const pat = patRes.rows[0];
          if (!pat) {
            throw new AppError('ACCESS_GRANT_REQUIRED');
          }

          const critical = await loadCriticalInfo(tx, patientId);

          const encRes = await sql<{
            id: string;
            started_at: string;
            doctor_name: string;
            primary_diagnosis: string | null;
          }>`
            select
              e.id,
              e.started_at::text,
              pr.full_name as doctor_name,
              (
                select ic.title_en
                  from app.diagnoses d
                  join ref.icd10_codes ic on ic.code = d.icd10_code
                 where d.encounter_id = e.id and d.is_primary
                 limit 1
              ) as primary_diagnosis
            from app.encounters e
            join app.profiles pr on pr.id = e.doctor_id
            where e.patient_id = ${patientId}::uuid
              and e.status <> 'entered_in_error'
              and (e.visibility = 'normal' or e.doctor_id = ${auth.userId}::uuid)
            order by e.started_at desc
            limit 5
          `.execute(tx);

          const restrictedCountRes = await sql<{ count: string }>`
            select count(*)::text as count
              from app.encounters e
             where e.patient_id = ${patientId}::uuid
               and e.visibility = 'restricted'
               and e.doctor_id <> ${auth.userId}::uuid
               and e.status <> 'entered_in_error'
          `.execute(tx);

          const rxRes = await sql<{
            id: string;
            rx_number: string;
            status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
          }>`
            select id, rx_number, status
              from app.prescriptions
             where patient_id = ${patientId}::uuid
               and status in ('pending', 'partially_dispensed')
             order by issued_at desc
             limit 10
          `.execute(tx);

          await writeAuditLog(tx, auth, {
            action: 'PATIENT_RECORD_READ',
            resourceType: 'patient_summary',
            resourceId: patientId,
            patientId,
          });

          return {
            patient: {
              id: pat.id,
              mrn: pat.mrn,
              full_name: pat.full_name,
              age: calculateAge(pat.date_of_birth),
              sex: pat.sex,
            },
            critical,
            recent_encounters: encRes.rows.map((e) => ({
              id: e.id,
              started_at: new Date(e.started_at).toISOString(),
              doctor: e.doctor_name,
              primary_diagnosis: e.primary_diagnosis,
            })),
            active_prescriptions: rxRes.rows,
            restricted_record_count: Number.parseInt(
              restrictedCountRes.rows[0]?.count ?? '0',
              10,
            ),
            grant: {
              id: pat.grant_id,
              scope: pat.grant_scope,
              expires_at: new Date(pat.grant_expires_at).toISOString(),
            },
          };
        });

        res.status(200).json(summary);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/doctor/patients/:patientId/history',
    requirePermission('patient_record:read:granted'),
    validate({ params: PatientIdParamSchema, query: MedicalHistoryQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const query = res.locals.validated!.query as {
          type: 'all' | 'visits' | 'diagnoses' | 'medications';
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const pageData = await withUserTx(pools, auth, async (tx) => {
          const hasGrantRes = await sql<{ granted: boolean }>`
            select private.has_grant(${patientId}::uuid, 'read_only') as granted
          `.execute(tx);
          if (!hasGrantRes.rows[0]?.granted) {
            throw new AppError('ACCESS_GRANT_REQUIRED');
          }

          const rows = (
            await sql<{
              id: string;
              started_at: string;
              encounter_type: 'outpatient' | 'inpatient' | 'emergency' | 'teleconsult';
              facility_id: string;
              facility_name: string;
              doctor_id: string;
              doctor_name: string;
              specialty_code: string | null;
              specialty_en: string | null;
              specialty_ar: string | null;
              visibility: 'normal' | 'restricted';
              notes_internal_enc: string | null;
            }>`
              select
                e.id,
                e.started_at::text,
                e.encounter_type,
                f.id as facility_id,
                f.name as facility_name,
                pr.id as doctor_id,
                p.full_name as doctor_name,
                sp.code as specialty_code,
                sp.name_en as specialty_en,
                sp.name_ar as specialty_ar,
                e.visibility,
                e.notes_internal_enc
              from app.encounters e
              join app.facilities f on f.id = e.facility_id
              join app.practitioners pr on pr.id = e.doctor_id
              join app.profiles p on p.id = pr.id
              left join ref.specialties sp on sp.code = pr.specialty_code
              where e.patient_id = ${patientId}::uuid
                and e.status <> 'entered_in_error'
                and (
                  ${cursor === null}::boolean
                  or (e.started_at, e.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              order by e.started_at desc, e.id desc
              limit ${query.limit + 1}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const visibleIds = sliced
            .filter((r) => !(r.visibility === 'restricted' && r.doctor_id !== auth.userId))
            .map((r) => r.id);

          const diagMap = new Map<
            string,
            Array<{ icd10_code: string; name: { en: string; ar: string }; is_primary: boolean }>
          >();
          const rxMap = new Map<string, string[]>();

          if (visibleIds.length > 0) {
            const dxRows = await sql<{
              encounter_id: string;
              icd10_code: string;
              title_en: string;
              title_ar: string | null;
              is_primary: boolean;
            }>`
              select d.encounter_id, d.icd10_code, ic.title_en, ic.title_ar, d.is_primary
                from app.diagnoses d
                join ref.icd10_codes ic on ic.code = d.icd10_code
               where d.encounter_id = any(${visibleIds}::uuid[])
               order by d.is_primary desc, d.created_at asc
            `.execute(tx);

            for (const dx of dxRows.rows) {
              const list = diagMap.get(dx.encounter_id) ?? [];
              list.push({
                icd10_code: dx.icd10_code,
                name: { en: dx.title_en, ar: dx.title_ar ?? dx.title_en },
                is_primary: dx.is_primary,
              });
              diagMap.set(dx.encounter_id, list);
            }

            const rxRows = await sql<{ encounter_id: string; id: string }>`
              select encounter_id, id
                from app.prescriptions
               where encounter_id = any(${visibleIds}::uuid[])
            `.execute(tx);
            for (const rx of rxRows.rows) {
              const list = rxMap.get(rx.encounter_id) ?? [];
              list.push(rx.id);
              rxMap.set(rx.encounter_id, list);
            }
          }

          await writeAuditLog(tx, auth, {
            action: 'PATIENT_HISTORY_READ',
            resourceType: 'medical_history',
            patientId,
          });

          const last = sliced.at(-1);
          return {
            data: sliced.map((row) => {
              if (row.visibility === 'restricted' && row.doctor_id !== auth.userId) {
                const dt = new Date(row.started_at);
                const monthTruncated = new Date(
                  Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 0, 0, 0),
                ).toISOString();
                return {
                  kind: 'restricted_placeholder' as const,
                  id: null,
                  started_at: monthTruncated,
                };
              }

              const canSeeNotes = auth.facilityIds.includes(row.facility_id);
              return {
                kind: 'encounter' as const,
                id: row.id,
                started_at: new Date(row.started_at).toISOString(),
                encounter_type: row.encounter_type,
                facility: { id: row.facility_id, name: row.facility_name },
                doctor: {
                  id: row.doctor_id,
                  name: row.doctor_name,
                  specialty: row.specialty_code
                    ? {
                        code: row.specialty_code,
                        name: {
                          en: row.specialty_en ?? row.specialty_code,
                          ar: row.specialty_ar ?? row.specialty_en ?? row.specialty_code,
                        },
                      }
                    : null,
                },
                diagnoses: diagMap.get(row.id) ?? [],
                prescription_ids: rxMap.get(row.id) ?? [],
                visibility: row.visibility,
                ...(canSeeNotes && row.notes_internal_enc
                  ? {
                      notes_internal: deps.fieldCipher.decrypt(
                        row.notes_internal_enc,
                        aad('encounters', 'notes_internal_enc', row.id),
                      ),
                    }
                  : {}),
              };
            }),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.started_at, id: last.id }, deps.keyring.blindIndexKey)
                  : null,
              has_more: hasMore,
            },
          };
        });

        res.status(200).json(pageData);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/doctor/patients/:patientId/encounters',
    requirePermission('patient_record:write:granted'),
    validate({ params: PatientIdParamSchema, body: CreateEncounterRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const body = res.locals.validated!.body as {
          encounter_type: 'outpatient' | 'inpatient' | 'emergency' | 'teleconsult';
          facility_id: string;
          chief_complaint?: string;
        };

        if (!auth.facilityIds.includes(body.facility_id)) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'doctor_not_member_of_facility' });
        }

        const pools = requirePools();
        const created = await withUserTx(pools, auth, async (tx) => {
          const encId = randomUUID();
          const inserted = await tx
            .insertInto('app.encounters')
            .values({
              id: encId,
              patient_id: patientId,
              doctor_id: auth.userId,
              facility_id: body.facility_id,
              encounter_type: body.encounter_type,
              status: 'open',
              chief_complaint_enc: body.chief_complaint
                ? deps.fieldCipher.encrypt(
                    body.chief_complaint,
                    aad('encounters', 'chief_complaint_enc', encId),
                  )
                : null,
              visibility: 'normal',
            })
            .returning(['id', 'status', 'started_at', 'version'])
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'ENCOUNTER_CREATED',
            resourceType: 'encounter',
            resourceId: encId,
            patientId,
          });

          return inserted;
        });

        res.status(201).json({
          id: created.id,
          status: created.status,
          started_at: new Date(created.started_at).toISOString(),
          version: created.version,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/doctor/encounters/:encounterId',
    requirePermission('patient_record:write:granted'),
    validate({ params: EncounterIdParamSchema, body: PatchEncounterRequestSchema }),
    async (req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { encounterId } = res.locals.validated!.params as { encounterId: string };
        const body = res.locals.validated!.body as {
          chief_complaint?: string;
          notes_internal?: string;
          patient_summary?: string;
          end?: boolean;
        };
        const ifMatchRaw = req.header('if-match');
        const expectedVersion = ifMatchRaw ? Number.parseInt(ifMatchRaw, 10) : null;
        const pools = requirePools();

        const updated = await withUserTx(pools, auth, async (tx) => {
          const existing = await tx
            .selectFrom('app.encounters')
            .select(['id', 'patient_id', 'doctor_id', 'status', 'ended_at', 'version'])
            .where('id', '=', encounterId)
            .executeTakeFirst();

          if (!existing || existing.doctor_id !== auth.userId) {
            throw new AppError('RESOURCE_NOT_FOUND');
          }

          if (expectedVersion !== null && existing.version !== expectedVersion) {
            throw new AppError('CONFLICT_VERSION');
          }

          if (
            existing.status === 'closed' &&
            existing.ended_at &&
            Date.now() - new Date(existing.ended_at).getTime() > 24 * 3600 * 1000
          ) {
            throw new AppError('VALIDATION_FAILED', {
              statusOverride: 409,
              detail: 'edit_window_closed',
            });
          }

          const updates: Record<string, unknown> = {
            version: existing.version + 1,
          };
          if (body.chief_complaint !== undefined) {
            updates.chief_complaint_enc = deps.fieldCipher.encrypt(
              body.chief_complaint,
              aad('encounters', 'chief_complaint_enc', encounterId),
            );
          }
          if (body.notes_internal !== undefined) {
            updates.notes_internal_enc = deps.fieldCipher.encrypt(
              body.notes_internal,
              aad('encounters', 'notes_internal_enc', encounterId),
            );
          }
          if (body.patient_summary !== undefined) {
            updates.patient_summary_enc = deps.fieldCipher.encrypt(
              body.patient_summary,
              aad('encounters', 'patient_summary_enc', encounterId),
            );
          }
          if (body.end) {
            updates.status = 'closed';
            updates.ended_at = sql`now()`;
          }

          const row = await tx
            .updateTable('app.encounters')
            .set(updates)
            .where('id', '=', encounterId)
            .where('version', '=', existing.version)
            .returning(['id', 'status', 'ended_at', 'version'])
            .executeTakeFirst();

          if (!row) {
            throw new AppError('CONFLICT_VERSION');
          }

          await writeAuditLog(tx, auth, {
            action: 'ENCOUNTER_UPDATED',
            resourceType: 'encounter',
            resourceId: encounterId,
            patientId: existing.patient_id,
          });

          return row;
        });

        res.status(200).json({
          id: updated.id,
          status: updated.status,
          ended_at: updated.ended_at ? new Date(updated.ended_at).toISOString() : null,
          version: updated.version,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/doctor/encounters/:encounterId/addenda',
    requirePermission('patient_record:write:granted'),
    validate({ params: EncounterIdParamSchema, body: CreateAddendumRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { encounterId } = res.locals.validated!.params as { encounterId: string };
        const { text } = res.locals.validated!.body as { text: string };
        const pools = requirePools();

        const created = await withUserTx(pools, auth, async (tx) => {
          const enc = await tx
            .selectFrom('app.encounters')
            .select(['id', 'patient_id', 'doctor_id'])
            .where('id', '=', encounterId)
            .executeTakeFirst();
          if (!enc || enc.doctor_id !== auth.userId) {
            throw new AppError('RESOURCE_NOT_FOUND');
          }

          const id = randomUUID();
          const row = await tx
            .insertInto('app.encounter_addenda')
            .values({
              id,
              encounter_id: encounterId,
              patient_id: enc.patient_id,
              author_id: auth.userId,
              text_enc: deps.fieldCipher.encrypt(text, aad('encounter_addenda', 'text_enc', id)),
            })
            .returning(['id', 'created_at'])
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'ENCOUNTER_ADDENDUM_CREATED',
            resourceType: 'encounter_addendum',
            resourceId: id,
            patientId: enc.patient_id,
          });

          return row;
        });

        res.status(201).json({
          id: created.id,
          created_at: new Date(created.created_at).toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/doctor/encounters/:encounterId/entered-in-error',
    requirePermission('patient_record:write:granted'),
    validate({ params: EncounterIdParamSchema, body: EnteredInErrorRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { encounterId } = res.locals.validated!.params as { encounterId: string };
        const { reason } = res.locals.validated!.body as { reason: string };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const enc = await tx
            .updateTable('app.encounters')
            .set({ status: 'entered_in_error', entered_in_error_reason: reason })
            .where('id', '=', encounterId)
            .where('doctor_id', '=', auth.userId)
            .returning(['id', 'patient_id'])
            .executeTakeFirst();

          if (!enc) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'ENCOUNTER_ENTERED_IN_ERROR',
            resourceType: 'encounter',
            resourceId: encounterId,
            patientId: enc.patient_id,
            reason,
          });
        });

        res.status(200).json({ id: encounterId, status: 'entered_in_error' });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/doctor/encounters/:encounterId/diagnoses',
    requirePermission('patient_record:write:granted'),
    validate({ params: EncounterIdParamSchema, body: CreateDiagnosisRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { encounterId } = res.locals.validated!.params as { encounterId: string };
        const body = res.locals.validated!.body as {
          icd10_code: string;
          is_primary: boolean;
          clinical_notes?: string;
          add_to_problem_list: boolean;
          is_chronic: boolean;
        };
        const pools = requirePools();

        const created = await withUserTx(pools, auth, async (tx) => {
          const enc = await tx
            .selectFrom('app.encounters')
            .select(['id', 'patient_id', 'doctor_id'])
            .where('id', '=', encounterId)
            .executeTakeFirst();
          if (!enc || enc.doctor_id !== auth.userId) {
            throw new AppError('RESOURCE_NOT_FOUND');
          }

          let conditionId: string | null = null;
          if (body.add_to_problem_list) {
            const cond = await tx
              .insertInto('app.conditions')
              .values({
                patient_id: enc.patient_id,
                icd10_code: body.icd10_code,
                is_chronic: body.is_chronic,
                status: 'active',
                source: 'clinician_confirmed',
                recorded_by: auth.userId,
              })
              .returning('id')
              .executeTakeFirstOrThrow();
            conditionId = cond.id;
          }

          const dxId = randomUUID();
          await tx
            .insertInto('app.diagnoses')
            .values({
              id: dxId,
              encounter_id: encounterId,
              patient_id: enc.patient_id,
              icd10_code: body.icd10_code,
              is_primary: body.is_primary,
              clinical_notes_enc: body.clinical_notes
                ? deps.fieldCipher.encrypt(
                    body.clinical_notes,
                    aad('diagnoses', 'clinical_notes_enc', dxId),
                  )
                : null,
              condition_id: conditionId,
              recorded_by: auth.userId,
            })
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'DIAGNOSIS_RECORDED',
            resourceType: 'diagnosis',
            resourceId: dxId,
            patientId: enc.patient_id,
          });

          return {
            id: dxId,
            icd10_code: body.icd10_code,
            is_primary: body.is_primary,
            condition_id: conditionId,
          };
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/doctor/patients/:patientId/conditions',
    requirePermission('patient_record:write:granted'),
    validate({ params: PatientIdParamSchema, body: CreateConditionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const body = res.locals.validated!.body as {
          icd10_code: string;
          is_chronic: boolean;
          status: 'active' | 'resolved' | 'inactive';
          onset_year?: number | null;
        };
        const pools = requirePools();

        const created = await withUserTx(pools, auth, async (tx) => {
          const inserted = await tx
            .insertInto('app.conditions')
            .values({
              patient_id: patientId,
              icd10_code: body.icd10_code,
              is_chronic: body.is_chronic,
              status: body.status,
              source: 'clinician_confirmed',
              onset_year: body.onset_year ?? null,
              recorded_by: auth.userId,
            })
            .returning(['id', 'icd10_code', 'is_chronic', 'status', 'source', 'onset_year'])
            .executeTakeFirstOrThrow();

          const icd = await tx
            .selectFrom('ref.icd10_codes')
            .select(['title_en', 'title_ar'])
            .where('code', '=', body.icd10_code)
            .executeTakeFirst();

          await writeAuditLog(tx, auth, {
            action: 'CONDITION_RECORDED',
            resourceType: 'condition',
            resourceId: inserted.id,
            patientId,
          });

          return {
            id: inserted.id,
            icd10_code: inserted.icd10_code,
            name: {
              en: icd?.title_en ?? body.icd10_code,
              ar: icd?.title_ar ?? icd?.title_en ?? body.icd10_code,
            },
            is_chronic: inserted.is_chronic,
            status: inserted.status,
            source: inserted.source,
            onset_year: inserted.onset_year,
          };
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/doctor/patients/:patientId/conditions/:id',
    requirePermission('patient_record:write:granted'),
    validate({ params: PatientConditionParamSchema, body: PatchConditionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId, id } = res.locals.validated!.params as {
          patientId: string;
          id: string;
        };
        const body = res.locals.validated!.body as {
          status?: 'active' | 'resolved' | 'inactive';
          is_chronic?: boolean;
        };
        const pools = requirePools();

        const updated = await withUserTx(pools, auth, async (tx) => {
          const updates: Record<string, unknown> = {};
          if (body.status !== undefined) updates.status = body.status;
          if (body.is_chronic !== undefined) updates.is_chronic = body.is_chronic;

          const row = await tx
            .updateTable('app.conditions')
            .set(updates)
            .where('id', '=', id)
            .where('patient_id', '=', patientId)
            .returning(['id', 'icd10_code', 'free_text', 'is_chronic', 'status', 'source', 'onset_year'])
            .executeTakeFirst();

          if (!row) throw new AppError('RESOURCE_NOT_FOUND');

          const icd = row.icd10_code
            ? await tx
                .selectFrom('ref.icd10_codes')
                .select(['title_en', 'title_ar'])
                .where('code', '=', row.icd10_code)
                .executeTakeFirst()
            : null;

          await writeAuditLog(tx, auth, {
            action: 'CONDITION_UPDATED',
            resourceType: 'condition',
            resourceId: id,
            patientId,
          });

          const en = icd?.title_en ?? row.free_text ?? '';
          return {
            id: row.id,
            icd10_code: row.icd10_code,
            name: { en, ar: icd?.title_ar ?? en },
            is_chronic: row.is_chronic,
            status: row.status,
            source: row.source,
            onset_year: row.onset_year,
          };
        });

        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/doctor/patients/:patientId/allergies',
    requirePermission('patient_record:write:granted'),
    validate({ params: PatientIdParamSchema, body: CreateAllergyRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const body = res.locals.validated!.body as {
          allergen_type: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
          allergen_code: string | null;
          free_text: string | null;
          severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
          reaction?: string | null;
        };
        const pools = requirePools();

        const created = await withUserTx(pools, auth, async (tx) => {
          const allergyId = randomUUID();
          await tx
            .insertInto('app.allergies')
            .values({
              id: allergyId,
              patient_id: patientId,
              allergen_type: body.allergen_type,
              ingredient_code: body.allergen_type === 'ingredient' ? body.allergen_code : null,
              drug_class_code: body.allergen_type === 'drug_class' ? body.allergen_code : null,
              free_text:
                body.allergen_type === 'food' ||
                body.allergen_type === 'environmental' ||
                body.allergen_type === 'other'
                  ? body.free_text
                  : null,
              severity: body.severity,
              reaction: body.reaction ?? null,
              source: 'clinician_confirmed',
              verification: 'confirmed',
              recorded_by: auth.userId,
            })
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'ALLERGY_RECORDED',
            resourceType: 'allergy',
            resourceId: allergyId,
            patientId,
          });

          return fetchAllergyDtoById(tx, allergyId);
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/doctor/patients/:patientId/allergies/:id',
    requirePermission('patient_record:write:granted'),
    validate({ params: PatientAllergyParamSchema, body: VerifyAllergyRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId, id } = res.locals.validated!.params as {
          patientId: string;
          id: string;
        };
        const body = res.locals.validated!.body as {
          verification: 'confirmed' | 'refuted';
          allergen_type?: 'ingredient' | 'drug_class' | 'food' | 'environmental' | 'other';
          allergen_code?: string | null;
          severity?: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
        };
        const pools = requirePools();

        const updated = await withUserTx(pools, auth, async (tx) => {
          const updates: Record<string, unknown> = {
            verification: body.verification,
            source: 'clinician_confirmed',
          };
          if (body.severity !== undefined) updates.severity = body.severity;
          if (body.allergen_type !== undefined) {
            updates.allergen_type = body.allergen_type;
            updates.ingredient_code =
              body.allergen_type === 'ingredient' ? (body.allergen_code ?? null) : null;
            updates.drug_class_code =
              body.allergen_type === 'drug_class' ? (body.allergen_code ?? null) : null;
          }

          const row = await tx
            .updateTable('app.allergies')
            .set(updates)
            .where('id', '=', id)
            .where('patient_id', '=', patientId)
            .returning('id')
            .executeTakeFirst();

          if (!row) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'ALLERGY_VERIFIED',
            resourceType: 'allergy',
            resourceId: id,
            patientId,
            metadata: { verification: body.verification },
          });

          return fetchAllergyDtoById(tx, id);
        });

        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/doctor/patients/:patientId/blood-type',
    requirePermission('patient_record:write:granted'),
    validate({ params: PatientIdParamSchema, body: DoctorUpdateBloodTypeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const body = res.locals.validated!.body as {
          value: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
          verified_by_lab: boolean;
        };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const row = await tx
            .updateTable('app.patients')
            .set({
              blood_type: body.value,
              blood_type_source: 'clinician_confirmed',
              blood_type_confirmed_by: auth.userId,
              blood_type_confirmed_at: sql`now()`,
            })
            .where('id', '=', patientId)
            .returning('id')
            .executeTakeFirst();

          if (!row) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'BLOOD_TYPE_CONFIRMED',
            resourceType: 'patient',
            resourceId: patientId,
            patientId,
            metadata: { verified_by_lab: body.verified_by_lab },
          });
        });

        res.status(200).json({ value: body.value, source: 'clinician_confirmed' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
