import { evaluateRedFlags, type RedFlagMatch } from './triage/red-flags.js';

export type { RedFlagMatch };
export { evaluateRedFlags };

export interface VitalReadingInput {
  type: 'blood_pressure' | 'blood_glucose' | 'heart_rate';
  systolic?: number;
  diastolic?: number;
  value?: number; // mg/dL for glucose or bpm for HR
  recorded_at: string;
}

export interface ChronicAnomalyAlert {
  type: 'blood_pressure' | 'blood_glucose' | 'heart_rate';
  severity: 'info' | 'moderate' | 'critical';
  title_ar: string;
  title_en: string;
  detail_ar: string;
  detail_en: string;
  z_score: number | null;
  tokens_used: 0;
}

function meanAndStd(nums: number[]): { mean: number; std: number } {
  if (nums.length === 0) return { mean: 0, std: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / nums.length;
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Pillar 1.3: Zero-Token Chronic Disease Anomaly Alerts
 * Pure deterministic clinical thresholds + moving-average Z-score trend detection.
 */
export function detectChronicAnomalies(readings: VitalReadingInput[]): ChronicAnomalyAlert[] {
  const alerts: ChronicAnomalyAlert[] = [];

  const bpReadings = readings.filter(
    (r) => r.type === 'blood_pressure' && r.systolic !== undefined && r.diastolic !== undefined,
  );
  if (bpReadings.length > 0) {
    const latest = bpReadings[bpReadings.length - 1]!;
    const sys = latest.systolic!;
    const dia = latest.diastolic!;
    const histSys = bpReadings.slice(0, -1).map((r) => r.systolic!);
    const { mean, std } = meanAndStd(histSys);
    const z = std > 0 ? Number(((sys - mean) / std).toFixed(2)) : null;

    if (sys >= 180 || dia >= 120) {
      alerts.push({
        type: 'blood_pressure',
        severity: 'critical',
        title_ar: 'ارتفاع حاد في ضغط الدم (أزمة ضغط)',
        title_en: 'Hypertensive Crisis Reading',
        detail_ar: `الضغط المسجل ${sys}/${dia} مرتفع بشكل خطير. استرح فوراً وأعد القياس، وإذا استمر مع ألم صدر أو صداع توجه للطوارئ.`,
        detail_en: `Recorded BP ${sys}/${dia} mmHg is critically elevated. Seek urgent medical evaluation.`,
        z_score: z,
        tokens_used: 0,
      });
    } else if (sys >= 140 || dia >= 90 || (z !== null && z >= 2.0)) {
      alerts.push({
        type: 'blood_pressure',
        severity: 'moderate',
        title_ar: 'ارتفاع ملحوظ في ضغط الدم عن المعدل المعتاد',
        title_en: 'Elevated Blood Pressure Trend',
        detail_ar: `الضغط المسجل ${sys}/${dia} أعلى من المعدل الطبيعي. تابع القياس بانتظام وراجع طبيبك.`,
        detail_en: `Recorded BP ${sys}/${dia} mmHg is above target range. Monitor closely and consult your doctor.`,
        z_score: z,
        tokens_used: 0,
      });
    } else if (sys < 90 || dia < 60) {
      alerts.push({
        type: 'blood_pressure',
        severity: 'moderate',
        title_ar: 'انخفاض في ضغط الدم',
        title_en: 'Low Blood Pressure Alert',
        detail_ar: `الضغط المسجل ${sys}/${dia} منخفض. اشرب سوائل وتجنب الوقوف المفاجئ.`,
        detail_en: `Recorded BP ${sys}/${dia} mmHg is low. Hydrate and rise slowly.`,
        z_score: z,
        tokens_used: 0,
      });
    }
  }

  const glucoseReadings = readings.filter(
    (r) => r.type === 'blood_glucose' && r.value !== undefined,
  );
  if (glucoseReadings.length > 0) {
    const latest = glucoseReadings[glucoseReadings.length - 1]!;
    const val = latest.value!;
    const hist = glucoseReadings.slice(0, -1).map((r) => r.value!);
    const { mean, std } = meanAndStd(hist);
    const z = std > 0 ? Number(((val - mean) / std).toFixed(2)) : null;

    if (val < 70) {
      alerts.push({
        type: 'blood_glucose',
        severity: 'critical',
        title_ar: 'هبوط حاد في سكر الدم',
        title_en: 'Hypoglycemia Alert',
        detail_ar: `السكر المسجل ${val} mg/dL منخفض جداً. خد عصير مسكر أو معلقة عسل فوراً لو واعي.`,
        detail_en: `Blood glucose ${val} mg/dL is hypoglycemic (<70). Take fast-acting carbohydrates immediately.`,
        z_score: z,
        tokens_used: 0,
      });
    } else if (val >= 300) {
      alerts.push({
        type: 'blood_glucose',
        severity: 'critical',
        title_ar: 'ارتفاع شديد في سكر الدم',
        title_en: 'Severe Hyperglycemia Alert',
        detail_ar: `السكر المسجل ${val} mg/dL مرتفع جداً. اشرب مية وتواصل مع طبيبك أو الطوارئ إذا وجد قيء.`,
        detail_en: `Blood glucose ${val} mg/dL is severely elevated (>=300). Check ketones and seek prompt care.`,
        z_score: z,
        tokens_used: 0,
      });
    } else if (val >= 200 || (z !== null && z >= 2.0)) {
      alerts.push({
        type: 'blood_glucose',
        severity: 'moderate',
        title_ar: 'ارتفاع ملحوظ في مستوى السكر',
        title_en: 'Elevated Glucose Trend',
        detail_ar: `السكر المسجل ${val} mg/dL أعلى من المعتاد. راجع نظام الأكل والجرعات مع طبيبك.`,
        detail_en: `Blood glucose ${val} mg/dL is above expected trend.`,
        z_score: z,
        tokens_used: 0,
      });
    }
  }

  const hrReadings = readings.filter((r) => r.type === 'heart_rate' && r.value !== undefined);
  if (hrReadings.length > 0) {
    const latest = hrReadings[hrReadings.length - 1]!;
    const bpm = latest.value!;
    const hist = hrReadings.slice(0, -1).map((r) => r.value!);
    const { mean, std } = meanAndStd(hist);
    const z = std > 0 ? Number(((bpm - mean) / std).toFixed(2)) : null;

    if (bpm >= 130 || bpm <= 40) {
      alerts.push({
        type: 'heart_rate',
        severity: 'critical',
        title_ar: 'اضطراب حاد في معدل نبضات القلب',
        title_en: 'Critical Heart Rate Alert',
        detail_ar: `النبض المسجل ${bpm} نبضة/دقيقة خارج النطاق الآمن. توجه للتقييم الطبي الفوري إذا صاحبها دوخة أو ألم صدر.`,
        detail_en: `Heart rate ${bpm} bpm is outside safe resting limits. Seek urgent medical review.`,
        z_score: z,
        tokens_used: 0,
      });
    } else if (bpm >= 105 || bpm < 50 || (z !== null && Math.abs(z) >= 2.2)) {
      alerts.push({
        type: 'heart_rate',
        severity: 'moderate',
        title_ar: 'تغير ملحوظ في نبضات القلب',
        title_en: 'Heart Rate Trend Anomaly',
        detail_ar: `النبض المسجل ${bpm} نبضة/دقيقة مختلف عن متوسط قياساتك المعتاد.`,
        detail_en: `Heart rate ${bpm} bpm deviates from your baseline trend.`,
        z_score: z,
        tokens_used: 0,
      });
    }
  }

  return alerts;
}

export interface PrescriptionAuditSample {
  id: string;
  patient_id: string;
  doctor_id: string;
  created_at: string; // ISO
  drug_ids: string[];
  dispensed_at?: string | null;
  signature_valid?: boolean;
}

export interface FraudAlertItem {
  alert_id: string;
  rule: 'duplicate_controlled_rx' | 'abnormal_velocity' | 'off_hours_bulk' | 'tampered_signature';
  severity: 'medium' | 'high' | 'critical';
  score: number;
  doctor_id: string;
  patient_id: string;
  prescription_id: string;
  reason_ar: string;
  reason_en: string;
  tokens_used: 0;
}

const CONTROLLED_DRUG_HINTS = ['OPIOID', 'TRAMADOL', 'BENZO', 'DIAZEPAM', 'ALPRAZOLAM', 'PREGABALIN'];

/**
 * Pillar 1.4: Zero-Token Prescription Fraud & Anomaly Detection
 */
export function detectPrescriptionFraud(prescriptions: PrescriptionAuditSample[]): FraudAlertItem[] {
  const alerts: FraudAlertItem[] = [];
  const byDoctorHour = new Map<string, PrescriptionAuditSample[]>();
  const controlledByPatient = new Map<string, PrescriptionAuditSample[]>();

  for (const rx of prescriptions) {
    // 1. Tampered signature
    if (rx.signature_valid === false) {
      alerts.push({
        alert_id: `FRAUD-SIG-${rx.id}`,
        rule: 'tampered_signature',
        severity: 'critical',
        score: 98,
        doctor_id: rx.doctor_id,
        patient_id: rx.patient_id,
        prescription_id: rx.id,
        reason_ar: 'فشل التحقق من التوقيع الرقمي Ed25519 للروشتة — اشتباه تلاعب.',
        reason_en: 'Ed25519 digital signature verification failed — possible tampering.',
        tokens_used: 0,
      });
    }

    // 2. Off-hours prescribing (01:00 - 05:00 UTC+2 / Africa/Cairo approximate)
    const dt = new Date(rx.created_at);
    const cairoHour = (dt.getUTCHours() + 2) % 24;
    if (cairoHour >= 1 && cairoHour < 5) {
      const hourBucket = `${rx.doctor_id}:${rx.created_at.slice(0, 13)}`;
      const list = byDoctorHour.get(hourBucket) ?? [];
      list.push(rx);
      byDoctorHour.set(hourBucket, list);
    }

    // Group by doctor+hour for velocity check
    const docBucket = `${rx.doctor_id}:${rx.created_at.slice(0, 13)}`;
    const velList = byDoctorHour.get(docBucket) ?? [];
    if (!velList.includes(rx)) {
      velList.push(rx);
      byDoctorHour.set(docBucket, velList);
    }

    // 3. Controlled drug grouping per patient
    const hasControlled = rx.drug_ids.some((id) =>
      CONTROLLED_DRUG_HINTS.some((h) => id.toUpperCase().includes(h)),
    );
    if (hasControlled) {
      const pList = controlledByPatient.get(rx.patient_id) ?? [];
      pList.push(rx);
      controlledByPatient.set(rx.patient_id, pList);
    }
  }

  for (const [, list] of byDoctorHour.entries()) {
    if (list.length >= 6) {
      const sample = list[0]!;
      const dt = new Date(sample.created_at);
      const cairoHour = (dt.getUTCHours() + 2) % 24;
      const isOffHours = cairoHour >= 1 && cairoHour < 5;
      alerts.push({
        alert_id: `FRAUD-VEL-${sample.id}`,
        rule: isOffHours ? 'off_hours_bulk' : 'abnormal_velocity',
        severity: isOffHours ? 'high' : 'medium',
        score: isOffHours ? 82 : 68,
        doctor_id: sample.doctor_id,
        patient_id: sample.patient_id,
        prescription_id: sample.id,
        reason_ar: isOffHours
          ? `إصدار ${list.length} روشتات في ساعة واحدة خلال ساعات الليل المتأخرة.`
          : `معدل إصدار غير معتاد (${list.length} روشتة خلال ساعة واحدة).`,
        reason_en: isOffHours
          ? `Bulk off-hours prescribing (${list.length} prescriptions in 1 hour).`
          : `Abnormal prescribing velocity (${list.length} prescriptions in 1 hour).`,
        tokens_used: 0,
      });
    }
  }

  for (const [patientId, list] of controlledByPatient.entries()) {
    if (list.length >= 2) {
      const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        const diffDays =
          (new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays <= 7) {
          alerts.push({
            alert_id: `FRAUD-CTRL-${curr.id}`,
            rule: 'duplicate_controlled_rx',
            severity: 'high',
            score: 88,
            doctor_id: curr.doctor_id,
            patient_id: patientId,
            prescription_id: curr.id,
            reason_ar: 'تكرار صرف أدوية خاضعة للرقابة لنفس المريض خلال أقل من 7 أيام.',
            reason_en: 'Duplicate controlled-substance prescription for same patient within 7 days.',
            tokens_used: 0,
          });
        }
      }
    }
  }

  return alerts;
}
