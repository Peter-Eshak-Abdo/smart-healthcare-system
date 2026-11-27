import {
  AiLocaleQuerySchema,
  ChronicAnomaliesRequestSchema,
  PatientAiSummaryParamSchema,
  PrescriptionExplainParamSchema,
  SmartSearchQuerySchema,
  SoapScribeRequestSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import multer from 'multer';
import type { AppDeps } from '../../app-deps.js';
import { explainPrescription } from '../../ai/clinical/prescription-explainer.js';
import { summarizePatientHistory } from '../../ai/clinical/summarizer.js';
import {
  detectChronicAnomalies,
  detectPrescriptionFraud,
  type VitalReadingInput,
} from '../../ai/local-first.js';
import { consumeAiQuota } from '../../ai/quota-guard.js';
import { generateSoapFromTranscript } from '../../ai/scribe/soap-scribe.js';
import { runSmartSearch } from '../../ai/search/smart-search.js';
import { getAiTelemetrySummary } from '../../ai/telemetry.js';
import {
  analyzeLabReportImage,
  digitizePaperPrescription,
  scanMedicineBoxImage,
} from '../../ai/vision/vision-engines.js';
import {
  requireDb,
  requireDoctorGrant,
} from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type DrugReferenceDoc,
  type EncounterDoc,
  type MedicalRecordDoc,
  type PatientDoc,
  type PrescriptionDoc,
  type PrescriptionItemDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { AppError } from '../../shared/errors.js';

const uploadVision = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1_572_864, files: 1 },
});

function ageBandOf(dob: string | null | undefined): string {
  if (!dob) return 'adult';
  const y = Number.parseInt(dob.slice(0, 4), 10);
  if (Number.isNaN(y)) return 'adult';
  const age = new Date().getUTCFullYear() - y;
  if (age < 18) return '<18';
  if (age < 35) return '18-34';
  if (age < 55) return '35-54';
  if (age < 70) return '55-69';
  return '70+';
}

export function aiRoutes(deps: AppDeps): Router {
  const router = Router();

  // 1. Dynamic AI Smart Search & Symptom-to-Specialty Triage Routing (0-token local BM25)
  router.get(
    '/ai/smart-search',
    requirePermission('drug_catalog:read'),
    deps.rateLimit.middleware('assistant_msg'),
    validate({ query: SmartSearchQuerySchema }),
    async (_req, res, next) => {
      try {
        const { q, locale } = res.locals.validated!.query as { q: string; locale: 'ar' | 'en' };
        const result = deps.aiClient.smartSearch
          ? await deps.aiClient.smartSearch({ query: q, locale })
          : await runSmartSearch(deps.env, { query: q, locale });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // 2. AI Patient History Summarizer (Doctor & ER Portals, version-cached)
  router.get(
    '/patients/:patientId/ai-summary',
    requirePermission('patient_record:read:granted'),
    deps.rateLimit.middleware('assistant_msg'),
    validate({ params: PatientAiSummaryParamSchema, query: AiLocaleQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { patientId } = res.locals.validated!.params as { patientId: string };
        const { locale } = res.locals.validated!.query as { locale: 'ar' | 'en' };
        const db = requireDb(deps);

        await requireDoctorGrant(db, auth.userId, patientId);
        await consumeAiQuota({ db, env: deps.env, userId: auth.userId, bucket: 'doctor', locale });

        const patSnap = await db.collection(COLLECTIONS.patients).doc(patientId).get();
        if (!patSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const pat = patSnap.data() as PatientDoc;

        const recSnap = await db
          .collection(COLLECTIONS.medicalRecords)
          .where('patient_id', '==', patientId)
          .get();
        const records = recSnap.docs
          .map((d) => d.data() as MedicalRecordDoc)
          .filter((r) => r.visibility !== 'restricted');

        const allergies = records
          .filter((r) => r.kind === 'allergy' && r.status !== 'refuted')
          .map((r) => ({
            name: r.allergen_code ?? 'Allergy',
            severity: r.severity ?? 'moderate',
          }));

        const conditions = records
          .filter((r) => r.kind === 'condition')
          .map((r) => ({
            name: r.icd10_code ?? 'Condition',
            icd10: r.icd10_code ?? null,
            status: r.status ?? 'active',
          }));

        const medications = records
          .filter((r) => r.kind === 'medication')
          .map((r) => ({
            name: r.drug_id ?? 'Medication',
            dosage: null,
            status: r.status ?? 'active',
          }));

        const encSnap = await db
          .collection(COLLECTIONS.encounters)
          .where('patient_id', '==', patientId)
          .limit(6)
          .get();
        const recentEncounters = encSnap.docs
          .map((d) => d.data() as EncounterDoc)
          .filter((e) => e.visibility !== 'restricted' && e.status !== 'entered_in_error')
          .map((e) => ({
            date: (e.started_at ?? '').slice(0, 10),
            summary: `${e.encounter_type} (${e.status})`,
          }));

        const summaryInput = {
          patientId,
          locale,
          ageBand: ageBandOf(pat.date_of_birth),
          sex: pat.sex,
          bloodType: pat.blood_type,
          allergies,
          conditions,
          medications,
          recentEncounters,
          db,
          role: auth.role,
        };

        const summary = deps.aiClient.summarizeHistory
          ? await deps.aiClient.summarizeHistory(summaryInput)
          : await summarizePatientHistory(deps.env, summaryInput);

        await writeAuditLog(db, auth, {
          action: 'PATIENT_RECORD_READ',
          resourceType: 'patient_ai_summary',
          resourceId: patientId,
        });

        res.status(200).json({
          patient_id: patientId,
          ...summary,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // 3. AI Patient-Friendly E-Prescription Explainer (Permanent cache per prescriptionId)
  router.get(
    '/patients/me/prescriptions/:prescriptionId/explain',
    requirePermission('prescription:read:self'),
    deps.rateLimit.middleware('assistant_msg'),
    validate({ params: PrescriptionExplainParamSchema, query: AiLocaleQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { prescriptionId } = res.locals.validated!.params as { prescriptionId: string };
        const { locale } = res.locals.validated!.query as { locale: 'ar' | 'en' };
        const db = requireDb(deps);

        const rxSnap = await db.collection(COLLECTIONS.prescriptions).doc(prescriptionId).get();
        if (!rxSnap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const rx = rxSnap.data() as PrescriptionDoc;
        if (rx.patient_id !== auth.userId) throw new AppError('RESOURCE_NOT_FOUND');

        const itemsSnap = await db
          .collection(COLLECTIONS.prescriptions)
          .doc(prescriptionId)
          .collection('items')
          .get();

        const items = await Promise.all(
          itemsSnap.docs.map(async (d) => {
            const it = d.data() as PrescriptionItemDoc;
            const drugSnap = await db.collection(COLLECTIONS.drugReference).doc(it.drug_id).get();
            const drug = drugSnap.exists ? (drugSnap.data() as DrugReferenceDoc) : null;
            return {
              drug_id: it.drug_id,
              drug_name: drug ? `${drug.brand_name} (${drug.generic_name})` : it.drug_id,
              dose: it.dose,
              frequency: it.frequency,
              duration_days: it.duration_days,
              instructions: it.instructions_enc
                ? deps.fieldCipher.decrypt(
                    it.instructions_enc,
                    aad('prescription_items', 'instructions_enc', it.id),
                  )
                : null,
            };
          }),
        );

        const explanation = deps.aiClient.explainPrescription
          ? await deps.aiClient.explainPrescription({ prescriptionId, locale, items, db, role: auth.role })
          : await explainPrescription(deps.env, { prescriptionId, locale, items, db, role: auth.role });

        res.status(200).json({
          prescription_id: prescriptionId,
          ...explanation,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // 4. Vision AI: Lab Report Analyzer
  router.post(
    '/ai/vision/lab-report',
    requirePermission('assistant:use'),
    deps.rateLimit.middleware('assistant_msg'),
    uploadVision.single('image'),
    async (req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const locale = req.body?.locale === 'en' ? 'en' : 'ar';
        const file = req.file;
        if (!file) throw new AppError('VALIDATION_FAILED', { detail: 'image_required' });
        await consumeAiQuota({
          db: deps.db,
          env: deps.env,
          userId: auth.userId,
          bucket: 'patient_vision',
          locale,
        });
        const out = await analyzeLabReportImage(deps.env, {
          imageBuffer: file.buffer,
          mimeType: file.mimetype || 'image/jpeg',
          locale,
          db: deps.db,
          role: auth.role,
        });
        res.status(200).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  // 5. Vision AI: Paper Prescription OCR Digitizer
  router.post(
    '/ai/vision/prescription-ocr',
    requirePermission('assistant:use'),
    deps.rateLimit.middleware('assistant_msg'),
    uploadVision.single('image'),
    async (req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const locale = req.body?.locale === 'en' ? 'en' : 'ar';
        const file = req.file;
        if (!file) throw new AppError('VALIDATION_FAILED', { detail: 'image_required' });
        await consumeAiQuota({
          db: deps.db,
          env: deps.env,
          userId: auth.userId,
          bucket: 'patient_vision',
          locale,
        });
        const out = await digitizePaperPrescription(deps.env, {
          imageBuffer: file.buffer,
          mimeType: file.mimetype || 'image/jpeg',
          locale,
          db: deps.db,
          role: auth.role,
        });
        res.status(200).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  // 6. Vision AI: Medicine Box Scanner + Local Allergy Check
  router.post(
    '/ai/vision/medicine-box',
    requirePermission('assistant:use'),
    deps.rateLimit.middleware('assistant_msg'),
    uploadVision.single('image'),
    async (req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const locale = req.body?.locale === 'en' ? 'en' : 'ar';
        const file = req.file;
        if (!file) throw new AppError('VALIDATION_FAILED', { detail: 'image_required' });
        await consumeAiQuota({
          db: deps.db,
          env: deps.env,
          userId: auth.userId,
          bucket: 'patient_vision',
          locale,
        });

        let patientAllergies: Array<{ allergen_code?: string | null }> = [];
        if (deps.db && auth.role === 'patient') {
          const recSnap = await deps.db
            .collection(COLLECTIONS.medicalRecords)
            .where('patient_id', '==', auth.userId)
            .get();
          patientAllergies = recSnap.docs
            .map((d) => d.data() as MedicalRecordDoc)
            .filter((r) => r.kind === 'allergy' && r.status !== 'refuted')
            .map((r) => ({ allergen_code: r.allergen_code ?? null }));
        }

        const out = await scanMedicineBoxImage(deps.env, {
          imageBuffer: file.buffer,
          mimeType: file.mimetype || 'image/jpeg',
          locale,
          patientAllergies,
          db: deps.db,
          role: auth.role,
        });
        res.status(200).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  // 7. Voice AI Medical Scribe (Zero-Audio-Token: plain transcript -> SOAP + Draft Rx)
  router.post(
    '/ai/scribe/soap',
    requirePermission('patient_record:write:granted'),
    deps.rateLimit.middleware('assistant_msg'),
    validate({ body: SoapScribeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { transcript, locale } = res.locals.validated!.body as {
          transcript: string;
          locale: 'ar' | 'en';
        };
        await consumeAiQuota({
          db: deps.db,
          env: deps.env,
          userId: auth.userId,
          bucket: 'doctor',
          locale,
        });
        const out = await generateSoapFromTranscript(deps.env, {
          transcript,
          locale,
          db: deps.db,
          role: auth.role,
        });
        res.status(200).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  // 8. Zero-Token Chronic Disease Anomaly Alerts
  router.post(
    '/patients/me/chronic-anomalies',
    requirePermission('patient_record:read:self'),
    validate({ body: ChronicAnomaliesRequestSchema }),
    async (_req, res, next) => {
      try {
        const { readings } = res.locals.validated!.body as { readings: VitalReadingInput[] };
        const alerts = detectChronicAnomalies(readings);
        res.status(200).json({ alerts, tokens_used: 0 });
      } catch (err) {
        next(err);
      }
    },
  );

  // 9. Zero-Token Prescription Fraud & Anomaly Detection (Admin)
  router.get(
    '/admin/fraud-alerts',
    requirePermission('audit:read'),
    async (_req, res, next) => {
      try {
        const db = requireDb(deps);
        const rxSnap = await db.collection(COLLECTIONS.prescriptions).limit(200).get();
        const samples = rxSnap.docs.map((d) => {
          const rx = d.data() as PrescriptionDoc;
          return {
            id: rx.id,
            patient_id: rx.patient_id,
            doctor_id: rx.doctor_id,
            created_at: rx.issued_at ?? new Date().toISOString(),
            drug_ids: [],
          };
        });
        const alerts = detectPrescriptionFraud(samples);
        res.status(200).json({ alerts, tokens_used: 0 });
      } catch (err) {
        next(err);
      }
    },
  );

  // 10. Admin AI Token & Cache Efficiency Telemetry
  router.get(
    '/admin/ai-metrics',
    requirePermission('audit:read'),
    async (_req, res, next) => {
      try {
        const summary = await getAiTelemetrySummary(deps.db);
        res.status(200).json(summary);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
