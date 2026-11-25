import { randomUUID } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import {
  ConsentRequestSchema,
  CreateAllergyRequestSchema,
  EmergencyContactInputSchema,
  EmergencyContactPatchSchema,
  EncounterIdParamSchema,
  IdParamSchema,
  MedicalHistoryQuerySchema,
  PatientOnboardingRequestSchema,
  PatientPrescriptionsQuerySchema,
  UpdateBloodTypeRequestSchema,
  UpdateEncounterVisibilityRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { requirePermission, requireStepUp } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { isMinorPatient, validateEgyptianNationalId } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { decodeCursor, encodeCursor } from '../../shared/pagination.js';
import { loadPrescriptionDetail } from '../prescriptions/detail.js';
import { issuePickupToken } from '../prescriptions/signing.js';
import { fetchAllergyDtoById, loadCriticalInfo } from './shared.js';

export function patientRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.post(
    '/patients/me/onboarding',
    requirePermission('profile:read:self'),
    validate({ body: PatientOnboardingRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          id_document_type: 'national_id' | 'passport';
          id_document_number: string;
          date_of_birth: string;
          sex: 'male' | 'female';
          blood_type?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
          consents: Array<{ type: string; version: string }>;
        };

        if (auth.role !== 'patient') {
          throw new AppError('RBAC_FORBIDDEN');
        }

        if (body.id_document_type === 'national_id') {
          validateEgyptianNationalId(body.id_document_number, body.date_of_birth);
        }

        const tosConsent = body.consents.find((c) => c.type === 'terms_of_service');
        if (!tosConsent) {
          throw new AppError('VALIDATION_FAILED', { detail: 'terms_of_service_consent_required' });
        }

        const bidx = deps.fieldCipher.blindIndex(
          `${body.id_document_type}:${body.id_document_number}`,
          'id_document',
        );
        const enc = deps.fieldCipher.encrypt(
          body.id_document_number,
          aad('patients', 'id_document_enc', auth.userId),
        );

        const pools = requirePools();
        const patient = await withUserTx(pools, auth, async (tx) => {
          const onboarded = await sql<{
            id: string;
            mrn: string;
            date_of_birth: string;
            sex: 'male' | 'female';
            blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
            blood_type_source: 'patient_reported' | 'clinician_confirmed' | 'imported' | null;
          }>`
            select id, mrn, date_of_birth::text, sex, blood_type, blood_type_source
              from private.onboard_patient(
                ${body.id_document_type},
                ${enc},
                ${bidx},
                ${body.date_of_birth}::date,
                ${body.sex}::app.sex,
                ${body.blood_type ?? 'unknown'}::app.blood_type,
                ${tosConsent.version}
              )
          `.execute(tx);

          const row = onboarded.rows[0]!;
          for (const c of body.consents) {
            if (c.type !== 'terms_of_service') {
              await tx
                .insertInto('app.consents')
                .values({
                  patient_id: auth.userId,
                  consent_type: c.type as
                    | 'biometric_face'
                    | 'emergency_contacts_share'
                    | 'ai_assistant',
                  version: c.version,
                  granted: true,
                })
                .execute();
            }
          }

          await writeAuditLog(tx, auth, {
            action: 'PATIENT_ONBOARDED',
            resourceType: 'patient',
            resourceId: auth.userId,
            patientId: auth.userId,
            metadata: { doc_type: body.id_document_type },
          });

          return row;
        });

        await deps.authContext.invalidate(auth.userId);

        res.status(201).json({
          patient_id: patient.id,
          mrn: patient.mrn,
          date_of_birth: patient.date_of_birth,
          sex: patient.sex,
          blood_type: {
            value: patient.blood_type,
            source: patient.blood_type_source ?? 'patient_reported',
          },
          is_minor: isMinorPatient(patient.date_of_birth),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/patients/me/consents',
    requirePermission('profile:read:self'),
    validate({ body: ConsentRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        if (auth.role !== 'patient') throw new AppError('RBAC_FORBIDDEN');
        const body = res.locals.validated!.body as {
          type: 'biometric_face' | 'emergency_contacts_share' | 'ai_assistant' | 'terms_of_service';
          version: string;
          granted: boolean;
        };
        const pools = requirePools();

        const recordedAt = await withUserTx(pools, auth, async (tx) => {
          const inserted = await tx
            .insertInto('app.consents')
            .values({
              patient_id: auth.userId,
              consent_type: body.type,
              version: body.version,
              granted: body.granted,
            })
            .returning('recorded_at')
            .executeTakeFirstOrThrow();

          if (body.type === 'biometric_face' && !body.granted) {
            await sql`select private.delete_my_face_templates()`.execute(tx);
          }

          await writeAuditLog(tx, auth, {
            action: body.granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
            resourceType: 'consent',
            patientId: auth.userId,
            metadata: { consent_type: body.type, version: body.version },
          });

          return inserted.recorded_at;
        });

        res.status(201).json({
          type: body.type,
          version: body.version,
          granted: body.granted,
          recorded_at: new Date(recordedAt).toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/critical-info',
    requirePermission('critical_info:read:self'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();

        const dto = await withUserTx(pools, auth, async (tx) => {
          const info = await loadCriticalInfo(tx, auth.userId);
          await writeAuditLog(tx, auth, {
            action: 'CRITICAL_INFO_READ',
            resourceType: 'patient',
            resourceId: auth.userId,
            patientId: auth.userId,
          });
          return info;
        });

        res.status(200).json(dto);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/patients/me/blood-type',
    requirePermission('patient_record:read:self'),
    validate({ body: UpdateBloodTypeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          value: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
        };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const current = await tx
            .selectFrom('app.patients')
            .select(['blood_type_source'])
            .where('id', '=', auth.userId)
            .executeTakeFirstOrThrow();

          if (current.blood_type_source === 'clinician_confirmed') {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'clinician_confirmed_blood_type_locked' });
          }

          await tx
            .updateTable('app.patients')
            .set({
              blood_type: body.value,
              blood_type_source: 'patient_reported',
            })
            .where('id', '=', auth.userId)
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'BLOOD_TYPE_UPDATED',
            resourceType: 'patient',
            resourceId: auth.userId,
            patientId: auth.userId,
          });
        });

        res.status(200).json({ value: body.value, source: 'patient_reported' });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/patients/me/allergies',
    requirePermission('patient_record:read:self'),
    validate({ body: CreateAllergyRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
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
              patient_id: auth.userId,
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
              source: 'patient_reported',
              verification: 'unverified',
              recorded_by: auth.userId,
            })
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'ALLERGY_RECORDED',
            resourceType: 'allergy',
            resourceId: allergyId,
            patientId: auth.userId,
          });

          return fetchAllergyDtoById(tx, allergyId);
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/patients/me/allergies/:id',
    requirePermission('patient_record:read:self'),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const existing = await tx
            .selectFrom('app.allergies')
            .select(['id', 'source', 'is_active'])
            .where('id', '=', id)
            .where('patient_id', '=', auth.userId)
            .executeTakeFirst();

          if (!existing || !existing.is_active) {
            throw new AppError('RESOURCE_NOT_FOUND');
          }
          if (existing.source !== 'patient_reported') {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'clinician_confirmed_allergy_cannot_be_deleted' });
          }

          await tx
            .updateTable('app.allergies')
            .set({ is_active: false })
            .where('id', '=', id)
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'ALLERGY_DELETED',
            resourceType: 'allergy',
            resourceId: id,
            patientId: auth.userId,
          });
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/medical-history',
    requirePermission('patient_record:read:self'),
    validate({ query: MedicalHistoryQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
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
          const limitPlus = query.limit + 1;
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
                e.visibility
              from app.encounters e
              join app.facilities f on f.id = e.facility_id
              join app.practitioners pr on pr.id = e.doctor_id
              join app.profiles p on p.id = pr.id
              left join ref.specialties sp on sp.code = pr.specialty_code
              where e.patient_id = ${auth.userId}::uuid
                and e.status <> 'entered_in_error'
                and (
                  ${cursor === null}::boolean
                  or (e.started_at, e.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              order by e.started_at desc, e.id desc
              limit ${limitPlus}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const ids = sliced.map((r) => r.id);

          const diagMap = new Map<
            string,
            Array<{ icd10_code: string; name: { en: string; ar: string }; is_primary: boolean }>
          >();
          const rxMap = new Map<string, string[]>();

          if (ids.length > 0) {
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
               where d.encounter_id = any(${ids}::uuid[])
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
               where encounter_id = any(${ids}::uuid[])
            `.execute(tx);

            for (const rx of rxRows.rows) {
              const list = rxMap.get(rx.encounter_id) ?? [];
              list.push(rx.id);
              rxMap.set(rx.encounter_id, list);
            }
          }

          await writeAuditLog(tx, auth, {
            action: 'PATIENT_RECORD_READ',
            resourceType: 'medical_history',
            patientId: auth.userId,
          });

          const last = sliced.at(-1);
          return {
            data: sliced.map((row) => ({
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
            })),
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

  router.get(
    '/patients/me/encounters/:encounterId',
    requirePermission('patient_record:read:self'),
    validate({ params: EncounterIdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { encounterId } = res.locals.validated!.params as { encounterId: string };
        const pools = requirePools();

        const detail = await withUserTx(pools, auth, async (tx) => {
          const enc = await sql<{
            id: string;
            started_at: string;
            ended_at: string | null;
            encounter_type: 'outpatient' | 'inpatient' | 'emergency' | 'teleconsult';
            facility_id: string;
            facility_name: string;
            doctor_id: string;
            doctor_name: string;
            chief_complaint_enc: string | null;
            patient_summary_enc: string | null;
            visibility: 'normal' | 'restricted';
          }>`
            select
              e.id, e.started_at::text, e.ended_at::text, e.encounter_type,
              f.id as facility_id, f.name as facility_name,
              pr.id as doctor_id, p.full_name as doctor_name,
              e.chief_complaint_enc, e.patient_summary_enc, e.visibility
            from app.encounters e
            join app.facilities f on f.id = e.facility_id
            join app.practitioners pr on pr.id = e.doctor_id
            join app.profiles p on p.id = pr.id
            where e.id = ${encounterId}::uuid
              and e.patient_id = ${auth.userId}::uuid
          `.execute(tx);

          const row = enc.rows[0];
          if (!row) throw new AppError('RESOURCE_NOT_FOUND');

          const dxRows = await sql<{
            icd10_code: string;
            title_en: string;
            title_ar: string | null;
            is_primary: boolean;
          }>`
            select d.icd10_code, ic.title_en, ic.title_ar, d.is_primary
              from app.diagnoses d
              join ref.icd10_codes ic on ic.code = d.icd10_code
             where d.encounter_id = ${encounterId}::uuid
             order by d.is_primary desc, d.created_at asc
          `.execute(tx);

          const rxRows = await sql<{
            id: string;
            rx_number: string;
            status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
          }>`
            select id, rx_number, status
              from app.prescriptions
             where encounter_id = ${encounterId}::uuid
             order by issued_at desc
          `.execute(tx);

          const addRows = await sql<{
            id: string;
            created_at: string;
            author_name: string;
            text_enc: string;
          }>`
            select a.id, a.created_at::text, p.full_name as author_name, a.text_enc
              from app.encounter_addenda a
              join app.profiles p on p.id = a.author_id
             where a.encounter_id = ${encounterId}::uuid
             order by a.created_at asc
          `.execute(tx);

          await writeAuditLog(tx, auth, {
            action: 'PATIENT_ENCOUNTER_READ',
            resourceType: 'encounter',
            resourceId: encounterId,
            patientId: auth.userId,
          });

          return {
            id: row.id,
            started_at: new Date(row.started_at).toISOString(),
            ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
            encounter_type: row.encounter_type,
            facility: { id: row.facility_id, name: row.facility_name },
            doctor: { id: row.doctor_id, name: row.doctor_name },
            chief_complaint: row.chief_complaint_enc
              ? deps.fieldCipher.decrypt(
                  row.chief_complaint_enc,
                  aad('encounters', 'chief_complaint_enc', row.id),
                )
              : null,
            patient_summary: row.patient_summary_enc
              ? deps.fieldCipher.decrypt(
                  row.patient_summary_enc,
                  aad('encounters', 'patient_summary_enc', row.id),
                )
              : null,
            diagnoses: dxRows.rows.map((d) => ({
              icd10_code: d.icd10_code,
              name: { en: d.title_en, ar: d.title_ar ?? d.title_en },
              is_primary: d.is_primary,
            })),
            prescriptions: rxRows.rows,
            addenda: addRows.rows.map((a) => ({
              created_at: new Date(a.created_at).toISOString(),
              author: a.author_name,
              text: deps.fieldCipher.decrypt(
                a.text_enc,
                aad('encounter_addenda', 'text_enc', a.id),
              ),
            })),
            visibility: row.visibility,
          };
        });

        res.status(200).json(detail);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/patients/me/encounters/:encounterId/visibility',
    requirePermission('patient_record:read:self'),
    validate({ params: EncounterIdParamSchema, body: UpdateEncounterVisibilityRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { encounterId } = res.locals.validated!.params as { encounterId: string };
        const { visibility } = res.locals.validated!.body as { visibility: 'normal' | 'restricted' };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const updated = await tx
            .updateTable('app.encounters')
            .set({ visibility })
            .where('id', '=', encounterId)
            .where('patient_id', '=', auth.userId)
            .returning('id')
            .executeTakeFirst();

          if (!updated) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'ENCOUNTER_VISIBILITY_UPDATED',
            resourceType: 'encounter',
            resourceId: encounterId,
            patientId: auth.userId,
            metadata: { visibility },
          });
        });

        res.status(200).json({ id: encounterId, visibility });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/prescriptions',
    requirePermission('prescription:read:self'),
    validate({ query: PatientPrescriptionsQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          status?: 'active' | 'past';
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const result = await withUserTx(pools, auth, async (tx) => {
          const limitPlus = query.limit + 1;
          const activeFilter = query.status === 'active';
          const pastFilter = query.status === 'past';

          const rows = (
            await sql<{
              id: string;
              rx_number: string;
              status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
              issued_at: string;
              expires_at: string;
              doctor_name: string;
              specialty_code: string | null;
              specialty_en: string | null;
              specialty_ar: string | null;
              item_count: string;
              remaining_item_count: string;
            }>`
              select
                rx.id,
                rx.rx_number,
                rx.status,
                rx.issued_at::text,
                rx.expires_at::text,
                p.full_name as doctor_name,
                sp.code as specialty_code,
                sp.name_en as specialty_en,
                sp.name_ar as specialty_ar,
                count(pi.id)::text as item_count,
                count(pi.id) filter (where pi.status in ('pending','partially_dispensed'))::text as remaining_item_count
              from app.prescriptions rx
              join app.practitioners pr on pr.id = rx.doctor_id
              join app.profiles p on p.id = pr.id
              left join ref.specialties sp on sp.code = pr.specialty_code
              left join app.prescription_items pi on pi.prescription_id = rx.id
              where rx.patient_id = ${auth.userId}::uuid
                and (
                  (${!activeFilter && !pastFilter}::boolean)
                  or (${activeFilter}::boolean and rx.status in ('pending','partially_dispensed'))
                  or (${pastFilter}::boolean and rx.status in ('dispensed','cancelled','expired'))
                )
                and (
                  ${cursor === null}::boolean
                  or (rx.issued_at, rx.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              group by rx.id, p.full_name, sp.code, sp.name_en, sp.name_ar
              order by rx.issued_at desc, rx.id desc
              limit ${limitPlus}
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
              doctor: {
                name: r.doctor_name,
                specialty: r.specialty_code
                  ? {
                      code: r.specialty_code,
                      name: {
                        en: r.specialty_en ?? r.specialty_code,
                        ar: r.specialty_ar ?? r.specialty_en ?? r.specialty_code,
                      },
                    }
                  : null,
              },
              item_count: Number.parseInt(r.item_count, 10),
              remaining_item_count: Number.parseInt(r.remaining_item_count, 10),
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

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/prescriptions/:id',
    requirePermission('prescription:read:self'),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const pools = requirePools();

        const detail = await withUserTx(pools, auth, async (tx) => {
          const own = await tx
            .selectFrom('app.prescriptions')
            .select('id')
            .where('id', '=', id)
            .where('patient_id', '=', auth.userId)
            .executeTakeFirst();
          if (!own) throw new AppError('RX_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'PATIENT_PRESCRIPTION_READ',
            resourceType: 'prescription',
            resourceId: id,
            patientId: auth.userId,
          });
          return loadPrescriptionDetail(tx, deps, id, 'patient');
        });

        res.status(200).json(detail);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/patients/me/prescriptions/:id/pickup-tokens',
    requirePermission('prescription:read:self'),
    requireStepUp(deps.stepUp, 'pickup_token'),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const pools = requirePools();

        const tokenPayload = await withUserTx(pools, auth, async (tx) => {
          const rx = await sql<{
            id: string;
            rx_number: string;
            status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled' | 'expired';
            issued_at: string;
            expires_at: string;
            license_number: string;
          }>`
            select rx.id, rx.rx_number, rx.status, rx.issued_at::text, rx.expires_at::text, dr.license_number
              from app.prescriptions rx
              join app.practitioners dr on dr.id = rx.doctor_id
             where rx.id = ${id}::uuid
               and rx.patient_id = ${auth.userId}::uuid
          `.execute(tx);

          const row = rx.rows[0];
          if (!row) throw new AppError('RX_NOT_FOUND');
          if (row.status === 'cancelled') throw new AppError('RX_CANCELLED');
          if (row.status === 'dispensed') throw new AppError('RX_ALREADY_DISPENSED');
          if (row.status === 'expired' || new Date(row.expires_at).getTime() <= Date.now()) {
            throw new AppError('RX_EXPIRED');
          }

          const items = await tx
            .selectFrom('app.prescription_items')
            .select([
              'id',
              'drug_id',
              'dose',
              'route',
              'frequency',
              'frequency_interval_hours',
              'duration_days',
              'quantity_prescribed',
              'quantity_unit',
              'substitution_allowed',
            ])
            .where('prescription_id', '=', id)
            .execute();

          const issued = issuePickupToken(deps.signer, deps.keyring.rxKey, {
            prescriptionId: row.id,
            rxNumber: row.rx_number,
            issuedAt: row.issued_at,
            prescriberLicense: row.license_number,
            items: items.map((it) => ({
              id: it.id,
              drug_id: it.drug_id,
              dose: it.dose,
              route: it.route,
              frequency: it.frequency,
              frequency_interval_hours: it.frequency_interval_hours,
              duration_days: it.duration_days,
              quantity: Number.parseFloat(it.quantity_prescribed),
              quantity_unit: it.quantity_unit,
              substitution_allowed: it.substitution_allowed,
            })),
          });

          await writeAuditLog(tx, auth, {
            action: 'PICKUP_TOKEN_ISSUED',
            resourceType: 'prescription',
            resourceId: id,
            patientId: auth.userId,
          });
          return issued;
        });

        res.status(201).json(tokenPayload);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/emergency-contacts',
    requirePermission('emergency_contact:manage:self'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();

        const data = await withUserTx(pools, auth, async (tx) => {
          const rows = await tx
            .selectFrom('app.emergency_contacts')
            .select([
              'id',
              'full_name_enc',
              'relationship',
              'phone_enc',
              'priority',
              'share_with_emergency',
              'updated_at',
            ])
            .where('patient_id', '=', auth.userId)
            .where('deleted_at', 'is', null)
            .orderBy('priority', 'asc')
            .execute();

          return rows.map((row) => ({
            id: row.id,
            full_name: deps.fieldCipher.decrypt(
              row.full_name_enc,
              aad('emergency_contacts', 'full_name_enc', row.id),
            ),
            relationship: row.relationship,
            phone: deps.fieldCipher.decrypt(
              row.phone_enc,
              aad('emergency_contacts', 'phone_enc', row.id),
            ),
            priority: row.priority,
            share_with_emergency: row.share_with_emergency,
            updated_at: new Date(row.updated_at).toISOString(),
          }));
        });

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/patients/me/emergency-contacts',
    requirePermission('emergency_contact:manage:self'),
    validate({ body: EmergencyContactInputSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          full_name: string;
          relationship:
            | 'parent'
            | 'father'
            | 'mother'
            | 'spouse'
            | 'sibling'
            | 'child'
            | 'relative'
            | 'friend'
            | 'guardian'
            | 'other';
          phone: string;
          priority: number;
          share_with_emergency: boolean;
        };
        const pools = requirePools();

        const contact = await withUserTx(pools, auth, async (tx) => {
          const id = randomUUID();
          const fullNameEnc = deps.fieldCipher.encrypt(
            body.full_name,
            aad('emergency_contacts', 'full_name_enc', id),
          );
          const phoneEnc = deps.fieldCipher.encrypt(
            body.phone,
            aad('emergency_contacts', 'phone_enc', id),
          );

          const inserted = await tx
            .insertInto('app.emergency_contacts')
            .values({
              id,
              patient_id: auth.userId,
              full_name_enc: fullNameEnc,
              relationship: body.relationship,
              phone_enc: phoneEnc,
              priority: body.priority,
              share_with_emergency: body.share_with_emergency,
            })
            .returning('updated_at')
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'EMERGENCY_CONTACT_CREATED',
            resourceType: 'emergency_contact',
            resourceId: id,
            patientId: auth.userId,
          });

          return {
            id,
            full_name: body.full_name,
            relationship: body.relationship,
            phone: body.phone,
            priority: body.priority,
            share_with_emergency: body.share_with_emergency,
            updated_at: new Date(inserted.updated_at).toISOString(),
          };
        });

        res.status(201).json(contact);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/patients/me/emergency-contacts/:id',
    requirePermission('emergency_contact:manage:self'),
    validate({ params: IdParamSchema, body: EmergencyContactPatchSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as Partial<{
          full_name: string;
          relationship:
            | 'parent'
            | 'father'
            | 'mother'
            | 'spouse'
            | 'sibling'
            | 'child'
            | 'relative'
            | 'friend'
            | 'guardian'
            | 'other';
          phone: string;
          priority: number;
          share_with_emergency: boolean;
        }>;
        const pools = requirePools();

        const updated = await withUserTx(pools, auth, async (tx) => {
          const current = await tx
            .selectFrom('app.emergency_contacts')
            .select([
              'id',
              'full_name_enc',
              'relationship',
              'phone_enc',
              'priority',
              'share_with_emergency',
            ])
            .where('id', '=', id)
            .where('patient_id', '=', auth.userId)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

          if (!current) throw new AppError('RESOURCE_NOT_FOUND');

          const updates: Record<string, unknown> = {};
          if (body.full_name !== undefined) {
            updates.full_name_enc = deps.fieldCipher.encrypt(
              body.full_name,
              aad('emergency_contacts', 'full_name_enc', id),
            );
          }
          if (body.phone !== undefined) {
            updates.phone_enc = deps.fieldCipher.encrypt(
              body.phone,
              aad('emergency_contacts', 'phone_enc', id),
            );
          }
          if (body.relationship !== undefined) updates.relationship = body.relationship;
          if (body.priority !== undefined) updates.priority = body.priority;
          if (body.share_with_emergency !== undefined) {
            updates.share_with_emergency = body.share_with_emergency;
          }

          const row = await tx
            .updateTable('app.emergency_contacts')
            .set(updates)
            .where('id', '=', id)
            .returning([
              'id',
              'full_name_enc',
              'relationship',
              'phone_enc',
              'priority',
              'share_with_emergency',
              'updated_at',
            ])
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'EMERGENCY_CONTACT_UPDATED',
            resourceType: 'emergency_contact',
            resourceId: id,
            patientId: auth.userId,
          });

          return {
            id: row.id,
            full_name: deps.fieldCipher.decrypt(
              row.full_name_enc,
              aad('emergency_contacts', 'full_name_enc', row.id),
            ),
            relationship: row.relationship,
            phone: deps.fieldCipher.decrypt(
              row.phone_enc,
              aad('emergency_contacts', 'phone_enc', row.id),
            ),
            priority: row.priority,
            share_with_emergency: row.share_with_emergency,
            updated_at: new Date(row.updated_at).toISOString(),
          };
        });

        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/patients/me/emergency-contacts/:id',
    requirePermission('emergency_contact:manage:self'),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const updated = await tx
            .updateTable('app.emergency_contacts')
            .set({ deleted_at: sql`now()` })
            .where('id', '=', id)
            .where('patient_id', '=', auth.userId)
            .where('deleted_at', 'is', null)
            .returning('id')
            .executeTakeFirst();

          if (!updated) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'EMERGENCY_CONTACT_DELETED',
            resourceType: 'emergency_contact',
            resourceId: id,
            patientId: auth.userId,
          });
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/emergency-card',
    requirePermission('patient_record:read:self'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();

        const card = await withUserTx(pools, auth, async (tx) => {
          const pat = await tx
            .selectFrom('app.patients')
            .select(['mrn', 'date_of_birth', 'sex'])
            .where('id', '=', auth.userId)
            .executeTakeFirstOrThrow();

          const info = await loadCriticalInfo(tx, auth.userId);
          const sharedConsent = await sql<{ granted: boolean }>`
            select private.has_consent(${auth.userId}::uuid, 'emergency_contacts_share') as granted
          `.execute(tx);

          let sharedContacts: Array<{ n: string; r: string; p: string }> = [];
          if (sharedConsent.rows[0]?.granted) {
            const ecs = await tx
              .selectFrom('app.emergency_contacts')
              .select(['id', 'full_name_enc', 'relationship', 'phone_enc'])
              .where('patient_id', '=', auth.userId)
              .where('deleted_at', 'is', null)
              .where('share_with_emergency', '=', true)
              .orderBy('priority', 'asc')
              .execute();

            sharedContacts = ecs.map((c) => ({
              n: deps.fieldCipher.decrypt(
                c.full_name_enc,
                aad('emergency_contacts', 'full_name_enc', c.id),
              ),
              r: c.relationship,
              p: deps.fieldCipher.decrypt(
                c.phone_enc,
                aad('emergency_contacts', 'phone_enc', c.id),
              ),
            }));
          }

          const iat = Math.floor(Date.now() / 1000);
          const exp = iat + 30 * 86_400;
          const payloadObj = {
            typ: 'emergency_card',
            mrn: pat.mrn,
            n: auth.fullName,
            dob: pat.date_of_birth.slice(0, 4),
            sx: pat.sex === 'male' ? 'm' : 'f',
            bt: info.blood_type.value,
            al: info.allergies.map((a) => ({
              a: a.allergen?.name.en ?? a.free_text ?? 'Allergy',
              s: a.severity,
            })),
            cc: info.chronic_conditions.map((c) => c.name.en),
            med: info.current_medications.map((m) => m.drug.display),
            ec: sharedContacts,
            iat,
            exp,
          };

          const jsonBuf = Buffer.from(JSON.stringify(payloadObj), 'utf8');
          const compressed = jsonBuf.length > 1500 ? deflateRawSync(jsonBuf) : jsonBuf;
          const jws = deps.signer.signCompactJws(
            deps.keyring.emergencyCardKey,
            jsonBuf.length > 1500 ? 'emergency_card+deflate' : 'emergency_card',
            compressed,
          );

          await writeAuditLog(tx, auth, {
            action: 'EMERGENCY_CARD_ISSUED',
            resourceType: 'patient',
            resourceId: auth.userId,
            patientId: auth.userId,
          });

          return {
            card_jws: jws,
            expires_at: new Date(exp * 1000).toISOString(),
            qr_payload: `SHEC1.${jws}`,
          };
        });

        res.status(200).json(card);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
