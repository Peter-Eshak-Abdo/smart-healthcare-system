'use client';

import type {
  CreateEncounterResponseSchema,
  DoctorPatientSummaryResponseSchema,
  MeResponse,
  PatientAiSummaryResponseSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Droplets, FilePlus2, Pill, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type PatientSummary = z.infer<typeof DoctorPatientSummaryResponseSchema>;
type CreatedEncounter = z.infer<typeof CreateEncounterResponseSchema>;
type PatientAiSummary = z.infer<typeof PatientAiSummaryResponseSchema>;

export default function DoctorPatientSummaryPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const queryClient = useQueryClient();
  const tCrit = useTranslations('doctor.criticalBanner');

  const [encounterType, setEncounterType] = useState<'outpatient' | 'inpatient' | 'telehealth' | 'emergency'>('outpatient');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [bloodType, setBloodType] = useState<'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown'>('O+');
  const [verifiedLab, setVerifiedLab] = useState(true);
  const [actionError, setActionError] = useState<unknown>(null);
  const [aiSummaryRequested, setAiSummaryRequested] = useState(false);

  const aiSummaryQuery = useQuery({
    queryKey: ['doctor-patient-ai-summary', params.patientId, locale],
    queryFn: () =>
      apiFetch<PatientAiSummary>(`/v1/patients/${params.patientId}/ai-summary?locale=${locale}`, {
        locale,
      }),
    enabled: aiSummaryRequested,
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/v1/me', { locale }),
  });

  const summaryQuery = useQuery({
    queryKey: ['doctor-patient-summary', params.patientId],
    queryFn: () =>
      apiFetch<PatientSummary>(`/v1/doctor/patients/${params.patientId}/summary`, { locale }),
  });

  const startEncounterMutation = useMutation({
    mutationFn: () => {
      const facilityId =
        meQuery.data?.practitioner?.active_facility_id ??
        meQuery.data?.practitioner?.facilities[0]?.id;
      return apiFetch<CreatedEncounter>(`/v1/doctor/patients/${params.patientId}/encounters`, {
        method: 'POST',
        locale,
        body: {
          encounter_type: encounterType,
          facility_id: facilityId,
          chief_complaint: chiefComplaint.trim() || undefined,
        },
      });
    },
    onSuccess: (enc) => {
      router.push(`${prefix}/doctor/patients/${params.patientId}/encounters/${enc.id}` as never);
    },
    onError: (err) => setActionError(err),
  });

  const verifyAllergyMutation = useMutation({
    mutationFn: (input: { id: string; verification: 'confirmed' | 'refuted' }) =>
      apiFetch(`/v1/doctor/patients/${params.patientId}/allergies/${input.id}`, {
        method: 'PATCH',
        locale,
        body: { verification: input.verification },
      }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['doctor-patient-summary', params.patientId] });
    },
    onError: (err) => setActionError(err),
  });

  const bloodMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/v1/doctor/patients/${params.patientId}/blood-type`, {
        method: 'PUT',
        locale,
        body: { value: bloodType, verified_by_lab: verifiedLab },
      }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['doctor-patient-summary', params.patientId] });
    },
    onError: (err) => setActionError(err),
  });

  const summary = summaryQuery.data;
  if (!summary) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-7">
        {actionError !== null && <ProblemAlert error={actionError} />}

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2>{isEn ? 'AI 5-Second Clinical Summary' : 'ملخص الحالة الذكي في 5 ثواني'}</h2>
            </div>
            <button
              type="button"
              onClick={() => setAiSummaryRequested(true)}
              disabled={aiSummaryQuery.isFetching}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {aiSummaryQuery.isFetching
                ? isEn
                  ? 'Summarizing...'
                  : 'جاري التلخيص...'
                : aiSummaryQuery.data
                  ? isEn
                    ? 'Refresh Summary'
                    : 'تحديث الملخص'
                  : isEn
                    ? 'Generate AI Summary'
                    : 'تلخيص التاريخ المرضي'}
            </button>
          </div>
          {aiSummaryQuery.data && (
            <div className="mt-3 space-y-2 text-sm text-foreground">
              <p className="font-semibold">{aiSummaryQuery.data.headline}</p>
              {aiSummaryQuery.data.critical_alerts.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                  {aiSummaryQuery.data.critical_alerts.join(' · ')}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{aiSummaryQuery.data.clinical_takeaway}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h2>{tCrit('allergies')}</h2>
          </div>
          {summary.critical.allergies.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{tCrit('noAllergies')}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {summary.critical.allergies.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {a.allergen ? (isEn ? a.allergen.name.en : a.allergen.name.ar) : a.free_text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.severity} · {a.source}
                      {a.reaction ? ` · ${a.reaction}` : ''}
                    </p>
                  </div>
                  {a.source !== 'clinician_confirmed' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          verifyAllergyMutation.mutate({ id: a.id, verification: 'confirmed' })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{isEn ? 'Confirm' : 'تأكيد'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          verifyAllergyMutation.mutate({ id: a.id, verification: 'refuted' })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{isEn ? 'Refute' : 'نفي'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground">{tCrit('conditions')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.critical.chronic_conditions.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              summary.critical.chronic_conditions.map((c) => (
                <span
                  key={c.id}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                >
                  {isEn ? c.name.en : c.name.ar}{' '}
                  {c.icd10_code && (
                    <span className="clinical-num font-mono text-muted-foreground">
                      (<bdi>{c.icd10_code}</bdi>)
                    </span>
                  )}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Pill className="h-4 w-4 text-primary" />
            <h2>{tCrit('medications')}</h2>
          </div>
          <div className="mt-3 space-y-2">
            {summary.critical.current_medications.map((m, idx) => (
              <div
                key={`${m.drug.id}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  <bdi>{m.drug.display}</bdi>
                </span>
                <span className="clinical-num text-xs text-muted-foreground">
                  <bdi>{m.dose_text}</bdi>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground">
            {isEn ? 'Recent Encounters' : 'أحدث الزيارات الطبية'}
          </h2>
          <div className="mt-3 space-y-2">
            {summary.recent_encounters.map((enc) => (
              <Link
                key={enc.id}
                href={`${prefix}/doctor/patients/${params.patientId}/encounters/${enc.id}` as never}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm hover:border-primary/40"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {enc.primary_diagnosis ?? (isEn ? 'Open visit' : 'كشف طبي')}
                  </p>
                  <p className="text-xs text-muted-foreground">{enc.doctor}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCairoDateTime(enc.started_at, locale)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-5 lg:col-span-5">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            startEncounterMutation.mutate();
          }}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <FilePlus2 className="h-5 w-5 text-primary" />
            <h2>{isEn ? 'Start New Clinical Encounter' : 'ابدأ كشف طبي جديد'}</h2>
          </div>
          <div className="mt-4 space-y-3">
            <select
              value={encounterType}
              onChange={(e) =>
                setEncounterType(
                  e.target.value as 'outpatient' | 'inpatient' | 'telehealth' | 'emergency',
                )
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="outpatient">{isEn ? 'Outpatient clinic' : 'عيادة خارجية'}</option>
              <option value="inpatient">{isEn ? 'Inpatient' : 'محجوز بالمستشفى'}</option>
              <option value="telehealth">{isEn ? 'Telehealth' : 'كشف عن بُعد'}</option>
              <option value="emergency">{isEn ? 'Emergency' : 'طوارئ'}</option>
            </select>
            <textarea
              rows={3}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder={isEn ? 'Chief complaint...' : 'الشكوى الرئيسية للمريض...'}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={startEncounterMutation.isPending || !meQuery.data}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {isEn ? 'Open Encounter Workspace' : 'فتح مساحة الكشف'}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Droplets className="h-4 w-4 text-primary" />
            <h2>{tCrit('bloodType')}</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value as typeof bloodType)}
              className="clinical-num rounded-xl border border-border bg-background px-3 py-2 text-sm"
              dir="ltr"
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'].map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={verifiedLab}
                onChange={(e) => setVerifiedLab(e.target.checked)}
              />
              <span>{tCrit('confirmed')}</span>
            </label>
            <button
              type="button"
              onClick={() => bloodMutation.mutate()}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-accent"
            >
              {isEn ? 'Verify Blood Type' : 'توثيق الفصيلة'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
