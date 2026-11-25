import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  CreateAddendumRequestSchema,
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
import type { AppDeps } from '../../app-deps.js';
import {
  enqueueOutboxNotification,
  requireDb,
  requireDoctorGrant,
} from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type AccessGrantDoc,
  type EncounterDoc,
  type FacilityDoc,
  type MedicalRecordDoc,
  type PatientDoc,
  type PrescriptionDoc,
  type ShareCodeDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { calculateAge } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { computeShareCodeHmac } from '../access/routes.js';
import { loadCriticalInfo } from '../patients/shared.js';

export function doctorRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/doctor/access/redeem',
    requirePermission('patient_record:read:granted'),
    validate({ body: RedeemShareCodeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as { patient_mrn: string; code: string };
        const db = requireDb(deps);
        const normalizedMrn = body.patient_mrn.toUpperCase();
        const expectedHmac = computeShareCodeHmac(
          deps.keyring.blindIndexKey,
          normalizedMrn,
          body.code,
        );

        const snap = await db
          .collection(COLLECTIONS.shareCodes)
          .where('mrn', '==', normalizedMrn)
          .where('redeemed_at', '==', null)
          .get();

        const nowIso = new Date().toISOString();
        let matched: ShareCodeDoc | null = null;
        for (const doc of snap.docs) {
          const candidate = doc.data() as ShareCodeDoc;
          if (candidate.expires_at <= nowIso) continue;
          const buf = Buffer.from(candidate.code_hmac, 'hex');
          if (buf.length === expectedHmac.length && timingSafeEqual(buf, expectedHmac)) {
            matched = candidate;
            break;
          }
        }

        if (!matched) {
          await deps.rateLimit
            .consume('share_code_fail', auth.userId, 1)
            .catch(() => undefined);
          throw new AppError('ACCESS_GRANT_REQUIRED', { detail: 'invalid_or_expired_share_code' });
        }

        const grantId = randomUUID();
        const expiresAt = new Date(
          Date.now() + matched.grant_duration_days * 86_400 * 1000,
        ).toISOString();

        const grantDoc: AccessGrantDoc = {
          id: grantId,
          patient_id: matched.patient_id,
          doctor_id: auth.userId,
          doctor_name: auth.fullName,
          facility_name: null,
          grant_type: 'patient_share',
          scope: matched.scope,
          status: 'active',
          granted_at: nowIso,
          expires_at: expiresAt,
        };

        await db.runTransaction(async (tx) => {
          tx.update(db.collection(COLLECTIONS.shareCodes).doc(matched.id), {
            redeemed_at: nowIso,
            redeemed_by_doctor_id: auth.userId,
          });
          tx.create(db.collection(COLLECTIONS.accessGrants).doc(grantId), grantDoc);
        });

        await writeAuditLog(db, auth, {
          action: 'SHARE_CODE_REDEEMED',
          resourceType: 'access_grant',
          resourceId: grantId,
          patientId: matched.patient_id,
          metadata: { scope: matched.scope },
        });

        await enqueueOutboxNotification(db, {
          user_id: matched.patient_id,
          channel: 'push',
          template: 'doctor_grant_activated',
          payload: { doctor_name: auth.fullName },
        });

        res.status(200).json({
          grant_id: grantId,
          patient_id: matched.patient_id,
          scope: matched.scope,
          expires_at: expiresAt,
        });
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
        const query = res.locals.validated!.query as { query?: string; limit: number };
        const db = requireDb(deps);
        const nowIso = new Date().toISOString();

        const snap = await db
          .collection(COLLECTIONS.accessGrants)
          .where('doctor_id', '==', auth.userId)
          .where('status', '==', 'active')
          .limit(query.limit)
          .get();

        const data = [];
        for (const doc of snap.docs) {
          const g = doc.data() as AccessGrantDoc;
          if (g.expires_at <= nowIso) continue;
          const [pSnap, uSnap] = await Promise.all([
            db.collection(COLLECTIONS.patients).doc(g.patient_id).get(),
            db.collection(COLLECTIONS.users).doc(g.patient_id).get(),
          ]);
          if (!pSnap.exists || !uSnap.exists) continue;
          const pat = pSnap.data() as PatientDoc;
          const user = uSnap.data() as UserDoc;
          if (query.query) {
            const q = query.query.toLowerCase();
            if (!pat.mrn.toLowerCase().includes(q) && !user.full_name.toLowerCase().includes(q)) {
              continue;
            }
          }
          data.push({
            patient_id: pat.id,
            mrn: pat.mrn,
            full_name: user.full_name,
            age: calculateAge(pat.date_of_birth),
            sex: pat.sex,
            grant: { id: g.id, expires_at: g.expires_at },
          });
        }
        res.status(200).json({ data, next_cursor: null });
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
        const db = requireDb(deps);
        const grant = await requireDoctorGrant(db, patientId, auth.userId);

        const [patSnap, userSnap, critical, encSnap, rxSnap] = await Promise.all([
          db.collection(COLLECTIONS.patients).doc(patientId).get(),
          db.collection(COLLECTIONS.users).doc(patientId).get(),
          loadCriticalInfo(db, deps, patientId),
          db
            .collection(COLLECTIONS.encounters)
            .where('patient_id', '==', patientId)
            .orderBy('started_at', 'desc')
            .limit(20)
            .get(),
          db
            .collection(COLLECTIONS.prescriptions)
            .where('patient_id', '==', patientId)
            .orderBy('issued_at', 'desc')
            .limit(10)
            .get(),
        ]);
        if (!patSnap.exists || !userSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const pat = patSnap.data() as PatientDoc;
        const user = userSnap.data() as UserDoc;

        const encounters = encSnap.docs.map((d) => d.data() as EncounterDoc);
        const restrictedCount = encounters.filter((e) => e.visibility === 'restricted').length;
        const recent_encounters = encounters
          .filter((e) => e.visibility === 'normal')
          .slice(0, 5)
          .map((e) => ({
            id: e.id,
            started_at: e.started_at,
            doctor: e.doctor_name,
            primary_diagnosis: e.diagnoses.find((d) => d.is_primary)?.name_en ?? null,
          }));

        await writeAuditLog(db, auth, {
          action: 'PATIENT_RECORD_READ',
          resourceType: 'patient',
          resourceId: patientId,
          patientId,
          patientMrnLast4: pat.mrn_last4,
        });

        res.status(200).json({
          patient: {
            id: pat.id,
            mrn: pat.mrn,
            full_name: user.full_name,
            age: calculateAge(pat.date_of_birth),
            sex: pat.sex,
          },
          critical,
          recent_encounters,
          active_prescriptions: rxSnap.docs
            .map((d) => d.data() as PrescriptionDoc)
            .filter((r) => r.status === 'pending' || r.status === 'partially_dispensed')
            .map((r) => ({ id: r.id, rx_number: r.rx_number, status: r.status })),
          restricted_record_count: restrictedCount,
          grant: { id: grant.id, scope: grant.scope, expires_at: grant.expires_at },
        });
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
        const db = requireDb(deps);
        await requireDoctorGrant(db, patientId, auth.userId);

        const snap = await db
          .collection(COLLECTIONS.encounters)
          .where('patient_id', '==', patientId)
          .orderBy('started_at', 'desc')
          .limit(50)
          .get();

        const data = snap.docs.map((d) => {
          const e = d.data() as EncounterDoc;
          if (e.visibility === 'restricted') {
            return { kind: 'restricted_placeholder' as const, id: null, started_at: e.started_at };
          }
          return {
            kind: 'encounter' as const,
            id: e.id,
            started_at: e.started_at,
            encounter_type: e.encounter_type,
            facility: { id: e.facility_id, name: e.facility_name },
            doctor: { id: e.doctor_id, name: e.doctor_name, specialty: null },
            diagnoses: e.diagnoses.map((dg) => ({
              icd10_code: dg.icd10_code,
              name: { en: dg.name_en, ar: dg.name_ar },
              is_primary: dg.is_primary,
            })),
            prescription_ids: e.prescription_ids ?? [],
            visibility: e.visibility,
            notes_internal: e.notes_internal_enc
              ? deps.fieldCipher.decrypt(
                  e.notes_internal_enc,
                  aad('encounters', 'notes_internal_enc', e.id),
                )
              : null,
          };
        });

        await writeAuditLog(db, auth, {
          action: 'PATIENT_HISTORY_READ',
          resourceType: 'patient',
          resourceId: patientId,
          patientId,
        });

        res.status(200).json({ data, next_cursor: null });
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
          encounter_type: EncounterDoc['encounter_type'];
          facility_id: string;
          chief_complaint?: string;
        };
        const db = requireDb(deps);
        await requireDoctorGrant(db, patientId, auth.userId, 'read_write');

        const facSnap = await db.collection(COLLECTIONS.facilities).doc(body.facility_id).get();
        const facName = facSnap.exists ? (facSnap.data() as FacilityDoc).name : 'Clinic';

        const id = randomUUID();
        const startedAt = new Date().toISOString();
        const doc: EncounterDoc = {
          id,
          patient_id: patientId,
          doctor_id: auth.userId,
          doctor_name: auth.fullName,
          doctor_specialty_code: auth.specialtyCode,
          facility_id: body.facility_id,
          facility_name: facName,
          encounter_type: body.encounter_type,
          status: 'open',
          visibility: 'normal',
          chief_complaint_enc: body.chief_complaint
            ? deps.fieldCipher.encrypt(
                body.chief_complaint,
                aad('encounters', 'chief_complaint_enc', id),
              )
            : null,
          notes_internal_enc: null,
          patient_summary_enc: null,
          diagnoses: [],
          addenda: [],
          prescription_ids: [],
          started_at: startedAt,
          ended_at: null,
          version: 1,
        };
        await db.collection(COLLECTIONS.encounters).doc(id).set(doc);
        res.status(201).json({ id, status: doc.status, started_at: startedAt, version: 1 });
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
        const ifMatch = req.header('if-match');
        const expectedVersion = ifMatch ? Number.parseInt(ifMatch.replace(/"/g, ''), 10) : undefined;
        const db = requireDb(deps);

        const result = await db.runTransaction(async (tx) => {
          const ref = db.collection(COLLECTIONS.encounters).doc(encounterId);
          const snap = await tx.get(ref);
          if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
          const enc = snap.data() as EncounterDoc;
          if (enc.doctor_id !== auth.userId) throw new AppError('RBAC_FORBIDDEN');
          if (expectedVersion !== undefined && !Number.isNaN(expectedVersion) && enc.version !== expectedVersion) {
            throw new AppError('CONFLICT_VERSION');
          }

          const endedAt = body.end ? new Date().toISOString() : enc.ended_at;
          const nextStatus = body.end ? 'closed' : enc.status;
          const nextVersion = enc.version + 1;

          tx.update(ref, {
            ...(body.chief_complaint !== undefined
              ? {
                  chief_complaint_enc: deps.fieldCipher.encrypt(
                    body.chief_complaint,
                    aad('encounters', 'chief_complaint_enc', enc.id),
                  ),
                }
              : {}),
            ...(body.notes_internal !== undefined
              ? {
                  notes_internal_enc: deps.fieldCipher.encrypt(
                    body.notes_internal,
                    aad('encounters', 'notes_internal_enc', enc.id),
                  ),
                }
              : {}),
            ...(body.patient_summary !== undefined
              ? {
                  patient_summary_enc: deps.fieldCipher.encrypt(
                    body.patient_summary,
                    aad('encounters', 'patient_summary_enc', enc.id),
                  ),
                }
              : {}),
            status: nextStatus,
            ended_at: endedAt,
            version: nextVersion,
          });
          return { id: enc.id, status: nextStatus, ended_at: endedAt, version: nextVersion };
        });

        res.status(200).json(result);
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
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.encounters).doc(encounterId);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const enc = snap.data() as EncounterDoc;
        if (enc.doctor_id !== auth.userId) throw new AppError('RBAC_FORBIDDEN');

        const addId = randomUUID();
        const createdAt = new Date().toISOString();
        await ref.update({
          addenda: [
            ...(enc.addenda ?? []),
            {
              id: addId,
              author_id: auth.userId,
              author_name: auth.fullName,
              text_enc: deps.fieldCipher.encrypt(text, aad('encounters', `addendum_${addId}`, enc.id)),
              created_at: createdAt,
            },
          ],
        });
        res.status(201).json({ id: addId, created_at: createdAt });
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
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.encounters).doc(encounterId);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as EncounterDoc).doctor_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({ status: 'entered_in_error' });
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
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.encounters).doc(encounterId);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const enc = snap.data() as EncounterDoc;
        if (enc.doctor_id !== auth.userId) throw new AppError('RBAC_FORBIDDEN');

        const icdSnap = await db.collection(COLLECTIONS.icd10Reference).doc(body.icd10_code).get();
        const icdData = icdSnap.exists
          ? (icdSnap.data() as { title_en: string; title_ar?: string })
          : { title_en: body.icd10_code, title_ar: body.icd10_code };

        const diagId = randomUUID();
        const nowIso = new Date().toISOString();
        let conditionId: string | null = null;
        if (body.add_to_problem_list) {
          conditionId = randomUUID();
          await db.collection(COLLECTIONS.medicalRecords).doc(conditionId).set({
            id: conditionId,
            patient_id: enc.patient_id,
            kind: 'condition',
            icd10_code: body.icd10_code,
            condition_name_en: icdData.title_en,
            condition_name_ar: icdData.title_ar ?? icdData.title_en,
            is_chronic: body.is_chronic,
            status: 'active',
            source: 'clinician_confirmed',
            recorded_at: nowIso,
            updated_at: nowIso,
          } satisfies MedicalRecordDoc);
        }

        await ref.update({
          diagnoses: [
            ...(enc.diagnoses ?? []),
            {
              id: diagId,
              icd10_code: body.icd10_code,
              name_en: icdData.title_en,
              name_ar: icdData.title_ar ?? icdData.title_en,
              is_primary: body.is_primary,
              clinical_notes_enc: body.clinical_notes
                ? deps.fieldCipher.encrypt(
                    body.clinical_notes,
                    aad('encounters', `diag_${diagId}`, enc.id),
                  )
                : null,
              condition_id: conditionId,
              created_at: nowIso,
            },
          ],
        });

        res.status(201).json({
          id: diagId,
          icd10_code: body.icd10_code,
          is_primary: body.is_primary,
          condition_id: conditionId,
        });
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
        const db = requireDb(deps);
        await requireDoctorGrant(db, patientId, auth.userId, 'read_write');
        const id = randomUUID();
        const nowIso = new Date().toISOString();
        await db.collection(COLLECTIONS.medicalRecords).doc(id).set({
          id,
          patient_id: patientId,
          kind: 'condition',
          icd10_code: body.icd10_code,
          condition_name_en: body.icd10_code,
          condition_name_ar: body.icd10_code,
          is_chronic: body.is_chronic,
          status: body.status,
          onset_year: body.onset_year ?? null,
          source: 'clinician_confirmed',
          recorded_at: nowIso,
          updated_at: nowIso,
        } satisfies MedicalRecordDoc);

        res.status(201).json({
          id,
          icd10_code: body.icd10_code,
          name: { en: body.icd10_code, ar: body.icd10_code },
          is_chronic: body.is_chronic,
          status: body.status,
          source: 'clinician_confirmed',
          onset_year: body.onset_year ?? null,
        });
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
        const { patientId, id } = res.locals.validated!.params as { patientId: string; id: string };
        const body = res.locals.validated!.body as { status?: string; is_chronic?: boolean };
        const db = requireDb(deps);
        await requireDoctorGrant(db, patientId, auth.userId, 'read_write');
        const ref = db.collection(COLLECTIONS.medicalRecords).doc(id);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as MedicalRecordDoc).patient_id !== patientId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({ ...body, updated_at: new Date().toISOString() });
        res.status(200).json({ id, updated: true });
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
        const { patientId, id } = res.locals.validated!.params as { patientId: string; id: string };
        const body = res.locals.validated!.body as { verification: 'confirmed' | 'refuted' };
        const db = requireDb(deps);
        await requireDoctorGrant(db, patientId, auth.userId, 'read_write');
        const ref = db.collection(COLLECTIONS.medicalRecords).doc(id);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as MedicalRecordDoc).patient_id !== patientId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({
          source: body.verification === 'confirmed' ? 'clinician_confirmed' : 'patient_reported',
          status: body.verification === 'refuted' ? 'refuted' : 'active',
          updated_at: new Date().toISOString(),
        });
        res.status(200).json({ id, verification: body.verification });
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
          value: PatientDoc['blood_type'];
          verified_by_lab: boolean;
        };
        const db = requireDb(deps);
        await requireDoctorGrant(db, patientId, auth.userId, 'read_write');
        await db.collection(COLLECTIONS.patients).doc(patientId).update({
          blood_type: body.value,
          blood_type_source: 'clinician_confirmed',
          blood_type_confirmed_at: body.verified_by_lab ? new Date().toISOString() : null,
        });
        res.status(200).json({ value: body.value, source: 'clinician_confirmed' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
