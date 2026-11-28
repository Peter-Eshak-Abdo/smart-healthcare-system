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
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type ConsentDoc,
  type EmergencyContactDoc,
  type EncounterDoc,
  type MedicalRecordDoc,
  type PatientDoc,
  type PrescriptionDoc,
  type PrescriptionItemDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission, requireStepUp } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { isMinorPatient } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { issuePickupToken, type CanonicalRxItem } from '../prescriptions/signing.js';
import { loadPrescriptionDetail } from '../prescriptions/detail.js';
import { generateMrn } from '../auth/register.js';
import { loadCriticalInfo } from './shared.js';

export function patientRoutes(deps: AppDeps): Router {
  const router = Router();

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
          blood_type?: PatientDoc['blood_type'];
          consents: Array<{ type: ConsentDoc['type']; version: string }>;
        };
        const db = requireDb(deps);
        const existingSnap = await db.collection(COLLECTIONS.patients).doc(auth.userId).get();
        if (existingSnap.exists) {
          throw new AppError('CONFLICT_VERSION', { statusOverride: 409, detail: 'already_onboarded' });
        }

        const mrn = generateMrn();
        const nowIso = new Date().toISOString();
        const bidx = deps.fieldCipher
          .blindIndex(`${body.id_document_type}:${body.id_document_number}`, 'id_document')
          .toString('hex');

        const dupSnap = await db
          .collection(COLLECTIONS.patients)
          .where('id_document_blind_index', '==', bidx)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          throw new AppError('CONFLICT_VERSION', { statusOverride: 409, detail: 'duplicate_national_id' });
        }

        const patientDoc: PatientDoc = {
          id: auth.userId,
          mrn,
          mrn_last4: mrn.slice(-4),
          id_document_type: body.id_document_type,
          id_document_blind_index: bidx,
          id_document_number_enc: deps.fieldCipher.encrypt(
            body.id_document_number,
            aad('patients', 'id_document_number_enc', auth.userId),
          ),
          date_of_birth: body.date_of_birth,
          sex: body.sex,
          blood_type: body.blood_type ?? 'unknown',
          blood_type_source: 'patient_reported',
          blood_type_confirmed_at: null,
          created_at: nowIso,
        };

        const batch = db.batch();
        batch.set(db.collection(COLLECTIONS.patients).doc(auth.userId), patientDoc);
        batch.update(db.collection(COLLECTIONS.users).doc(auth.userId), {
          status: 'active',
          updated_at: nowIso,
        });
        for (const c of body.consents) {
          const cid = `${auth.userId}_${c.type}`;
          batch.set(db.collection(COLLECTIONS.consents).doc(cid), {
            id: cid,
            patient_id: auth.userId,
            type: c.type,
            version: c.version,
            granted: true,
            recorded_at: nowIso,
          } satisfies ConsentDoc);
        }
        await batch.commit();
        await deps.firebaseAdmin.setCustomClaims(auth.userId, { role: 'patient', status: 'active' });
        await deps.authContext.invalidate(auth.userId);

        await writeAuditLog(db, auth, {
          action: 'PATIENT_ONBOARDED',
          resourceType: 'patient',
          resourceId: auth.userId,
          patientId: auth.userId,
          patientMrnLast4: patientDoc.mrn_last4,
        });

        res.status(201).json({
          patient_id: auth.userId,
          mrn,
          date_of_birth: body.date_of_birth,
          sex: body.sex,
          blood_type: { value: patientDoc.blood_type, source: patientDoc.blood_type_source },
          is_minor: isMinorPatient(body.date_of_birth),
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
        const body = res.locals.validated!.body as {
          type: ConsentDoc['type'];
          version: string;
          granted: boolean;
        };
        const db = requireDb(deps);
        const nowIso = new Date().toISOString();
        const cid = `${auth.userId}_${body.type}`;
        await db.collection(COLLECTIONS.consents).doc(cid).set({
          id: cid,
          patient_id: auth.userId,
          type: body.type,
          version: body.version,
          granted: body.granted,
          recorded_at: nowIso,
        } satisfies ConsentDoc);

        await writeAuditLog(db, auth, {
          action: 'CONSENT_UPDATED',
          resourceType: 'consent',
          resourceId: cid,
          patientId: auth.userId,
          metadata: { type: body.type, granted: body.granted },
        });
        res.status(200).json({ ...body, recorded_at: nowIso });
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
        const dto = await loadCriticalInfo(requireDb(deps), deps, auth.userId);
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
        const { value } = res.locals.validated!.body as { value: PatientDoc['blood_type'] };
        const db = requireDb(deps);
        await db.collection(COLLECTIONS.patients).doc(auth.userId).update({
          blood_type: value,
          blood_type_source: 'patient_reported',
        });
        res.status(200).json({ value, source: 'patient_reported' });
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
          allergen_type: NonNullable<MedicalRecordDoc['allergen_type']>;
          allergen_code: string | null;
          free_text: string | null;
          severity: NonNullable<MedicalRecordDoc['severity']>;
          reaction?: string | null;
        };
        const db = requireDb(deps);
        const id = randomUUID();
        const nowIso = new Date().toISOString();
        const doc: MedicalRecordDoc = {
          id,
          patient_id: auth.userId,
          kind: 'allergy',
          allergen_type: body.allergen_type,
          allergen_code: body.allergen_code,
          allergen_free_text_enc: body.free_text
            ? deps.fieldCipher.encrypt(
                body.free_text,
                aad('medical_records', 'allergen_free_text_enc', id),
              )
            : null,
          severity: body.severity,
          reaction_enc: body.reaction
            ? deps.fieldCipher.encrypt(body.reaction, aad('medical_records', 'reaction_enc', id))
            : null,
          status: 'active',
          source: 'patient_reported',
          recorded_at: nowIso,
          updated_at: nowIso,
        };
        await db.collection(COLLECTIONS.medicalRecords).doc(id).set(doc);
        res.status(201).json({
          id,
          allergen_type: body.allergen_type,
          allergen: body.allergen_code
            ? { code: body.allergen_code, name: { en: body.allergen_code, ar: body.allergen_code } }
            : null,
          free_text: body.free_text,
          severity: body.severity,
          reaction: body.reaction ?? null,
          source: 'patient_reported',
          recorded_at: nowIso,
        });
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
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.medicalRecords).doc(id);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as MedicalRecordDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({ status: 'resolved', updated_at: new Date().toISOString() });
        res.status(204).end();
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
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.encounters)
          .where('patient_id', '==', auth.userId)
          .orderBy('started_at', 'desc')
          .limit(50)
          .get();

        const data = snap.docs.map((d) => {
          const e = d.data() as EncounterDoc;
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
          };
        });
        res.status(200).json({ data, next_cursor: null });
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
        const db = requireDb(deps);
        const snap = await db.collection(COLLECTIONS.encounters).doc(encounterId).get();
        if (!snap.exists || (snap.data() as EncounterDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        const enc = snap.data() as EncounterDoc;
        res.status(200).json({
          id: enc.id,
          started_at: enc.started_at,
          ended_at: enc.ended_at,
          encounter_type: enc.encounter_type,
          facility: { id: enc.facility_id, name: enc.facility_name },
          doctor: { id: enc.doctor_id, name: enc.doctor_name },
          chief_complaint: enc.chief_complaint_enc
            ? deps.fieldCipher.decrypt(
                enc.chief_complaint_enc,
                aad('encounters', 'chief_complaint_enc', enc.id),
              )
            : null,
          patient_summary: enc.patient_summary_enc
            ? deps.fieldCipher.decrypt(
                enc.patient_summary_enc,
                aad('encounters', 'patient_summary_enc', enc.id),
              )
            : null,
          diagnoses: enc.diagnoses.map((d) => ({
            icd10_code: d.icd10_code,
            name: { en: d.name_en, ar: d.name_ar },
            is_primary: d.is_primary,
          })),
          prescriptions: [],
          addenda: enc.addenda.map((a) => ({
            created_at: a.created_at,
            author: a.author_name,
            text: deps.fieldCipher.decrypt(a.text_enc, aad('encounters', `addendum_${a.id}`, enc.id)),
          })),
          visibility: enc.visibility,
        });
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
        const { visibility } = res.locals.validated!.body as {
          visibility: 'normal' | 'restricted';
        };
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.encounters).doc(encounterId);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as EncounterDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({ visibility });
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
        const query = res.locals.validated!.query as { status?: 'active' | 'past'; limit: number };
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.prescriptions)
          .where('patient_id', '==', auth.userId)
          .orderBy('issued_at', 'desc')
          .limit(query.limit)
          .get();

        const rows = snap.docs
          .map((d) => d.data() as PrescriptionDoc)
          .filter((rx) => {
            if (query.status === 'active') {
              return rx.status === 'pending' || rx.status === 'partially_dispensed';
            }
            if (query.status === 'past') {
              return rx.status === 'dispensed' || rx.status === 'cancelled' || rx.status === 'expired';
            }
            return true;
          });

        const data = await Promise.all(
          rows.map(async (rx) => {
            const itemsSnap = await db
              .collection(COLLECTIONS.prescriptionItems)
              .where('prescription_id', '==', rx.id)
              .get();
            const items = itemsSnap.docs.map((i) => i.data() as PrescriptionItemDoc);
            return {
              id: rx.id,
              rx_number: rx.rx_number,
              status: rx.status,
              issued_at: rx.issued_at,
              expires_at: rx.expires_at,
              doctor: { name: rx.prescriber_name, specialty: null },
              item_count: items.length,
              remaining_item_count: items.filter((i) => i.quantity_prescribed > i.quantity_dispensed).length,
            };
          }),
        );

        res.status(200).json({ data, next_cursor: null });
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
        const db = requireDb(deps);
        const detail = await loadPrescriptionDetail(db, deps, id, 'patient');
        if (detail.patient.id !== auth.userId) throw new AppError('RX_NOT_FOUND');
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
        const db = requireDb(deps);
        const rxSnap = await db.collection(COLLECTIONS.prescriptions).doc(id).get();
        if (!rxSnap.exists) throw new AppError('RX_NOT_FOUND');
        const rx = rxSnap.data() as PrescriptionDoc;
        if (rx.patient_id !== auth.userId) throw new AppError('RX_NOT_FOUND');

        const itemsSnap = await db
          .collection(COLLECTIONS.prescriptionItems)
          .where('prescription_id', '==', rx.id)
          .get();
        const canonicalItems: CanonicalRxItem[] = itemsSnap.docs.map((d) => {
          const i = d.data() as PrescriptionItemDoc;
          return {
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
          };
        });

        const token = issuePickupToken(deps.signer, deps.keyring.rxKey, {
          prescriptionId: rx.id,
          rxNumber: rx.rx_number,
          issuedAt: rx.issued_at,
          prescriberLicense: rx.prescriber_license,
          items: canonicalItems,
        });
        res.status(201).json(token);
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
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.emergencyContacts)
          .where('patient_id', '==', auth.userId)
          .get();

        const data = snap.docs
          .map((d) => d.data() as EmergencyContactDoc)
          .sort((a, b) => a.priority - b.priority)
          .map((c) => ({
            id: c.id,
            full_name: deps.fieldCipher.decrypt(
              c.full_name_enc,
              aad('emergency_contacts', 'full_name_enc', c.id),
            ),
            relationship: c.relationship,
            phone: deps.fieldCipher.decrypt(
              c.phone_enc,
              aad('emergency_contacts', 'phone_enc', c.id),
            ),
            priority: c.priority,
            share_with_emergency: c.share_with_emergency,
            updated_at: c.updated_at,
          }));
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
          relationship: EmergencyContactDoc['relationship'];
          phone: string;
          priority: number;
          share_with_emergency: boolean;
        };
        const db = requireDb(deps);
        const id = randomUUID();
        const updatedAt = new Date().toISOString();
        const doc: EmergencyContactDoc = {
          id,
          patient_id: auth.userId,
          full_name_enc: deps.fieldCipher.encrypt(
            body.full_name,
            aad('emergency_contacts', 'full_name_enc', id),
          ),
          relationship: body.relationship,
          phone_enc: deps.fieldCipher.encrypt(body.phone, aad('emergency_contacts', 'phone_enc', id)),
          priority: body.priority,
          share_with_emergency: body.share_with_emergency,
          updated_at: updatedAt,
        };
        await db.collection(COLLECTIONS.emergencyContacts).doc(id).set(doc);
        res.status(201).json({ id, ...body, updated_at: updatedAt });
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
          relationship: EmergencyContactDoc['relationship'];
          phone: string;
          priority: number;
          share_with_emergency: boolean;
        }>;
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.emergencyContacts).doc(id);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as EmergencyContactDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
        await ref.update(updates);
        res.status(200).json({ id, updated: true });
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
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.emergencyContacts).doc(id);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as EmergencyContactDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.delete();
        res.status(204).end();
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
        const db = requireDb(deps);
        const [patSnap, userSnap, crit] = await Promise.all([
          db.collection(COLLECTIONS.patients).doc(auth.userId).get(),
          db.collection(COLLECTIONS.users).doc(auth.userId).get(),
          loadCriticalInfo(db, deps, auth.userId),
        ]);
        if (!patSnap.exists || !userSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const pat = patSnap.data() as PatientDoc;
        const user = userSnap.data() as UserDoc;

        const nowSec = Math.floor(Date.now() / 1000);
        const expSec = nowSec + 30 * 86_400;
        const claimsPayload = deflateRawSync(
          Buffer.from(
            JSON.stringify({
              mrn: pat.mrn,
              name: user.full_name,
              bt: crit.blood_type.value,
              alg: crit.allergies.slice(0, 5).map((a) => a.allergen?.name.en ?? a.free_text ?? ''),
              iat: nowSec,
              exp: expSec,
            }),
            'utf8',
          ),
        );

        const compact = deps.signer.signCompactJws(
          deps.keyring.emergencyCardKey,
          'ecard+deflate',
          claimsPayload,
        );
        const qrPayload = `SHEC1.${compact}`;
        res.status(200).json({
          card_jws: qrPayload,
          expires_at: new Date(expSec * 1000).toISOString(),
          qr_payload: qrPayload,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
