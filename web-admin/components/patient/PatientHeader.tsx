'use client';

import type { DoctorPatientSummaryResponseSchema } from '@smarthealth/contracts';
import { AlertCircle, Droplets, Lock, Pill, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { formatCairoDateTime } from '@/lib/format/date';

type PatientSummary = z.infer<typeof DoctorPatientSummaryResponseSchema>;

export function PatientHeader({ summary }: { summary: PatientSummary }) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('doctor');
  const { patient, critical, restricted_record_count, grant } = summary;

  return (
    <section className="sticky top-16 z-10 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
            {patient.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">{patient.full_name}</h1>
              <span className="clinical-num rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                <bdi>{patient.mrn}</bdi>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="clinical-num">{patient.age}</span> · {patient.sex} ·{' '}
              {formatCairoDateTime(grant.expires_at, locale)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
              critical.blood_type.source === 'clinician_confirmed'
                ? 'border-destructive/40 bg-danger-surface text-destructive'
                : 'border-warning/50 bg-warning-surface text-warning'
            }`}
          >
            <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('criticalBanner.bloodType')}:</span>
            <bdi className="clinical-num font-mono">{critical.blood_type.value}</bdi>
            <span className="text-muted-foreground font-normal">
              (
              {critical.blood_type.source === 'clinician_confirmed'
                ? t('criticalBanner.confirmed')
                : t('criticalBanner.selfReported')}
              )
            </span>
          </div>

          {restricted_record_count > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('restrictedChip', { count: restricted_record_count })}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('criticalBanner.allergies')}:
        </span>
        {critical.allergies.length === 0 ? (
          <span className="text-xs text-success">{t('criticalBanner.noAllergies')}</span>
        ) : (
          critical.allergies.map((al) => {
            const label =
              (al.allergen ? (locale === 'ar' ? al.allergen.name.ar : al.allergen.name.en) : al.free_text) ??
              'Allergy';
            const highRisk = al.severity === 'anaphylaxis' || al.severity === 'severe';
            return (
              <span
                key={al.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  highRisk
                    ? 'bg-destructive text-destructive-foreground'
                    : al.source === 'patient_reported' && al.allergen === null
                      ? 'border border-warning bg-warning-surface text-warning'
                      : 'bg-warning-surface text-warning'
                }`}
              >
                {highRisk ? (
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                )}
                <bdi>{label}</bdi>
                <span>({al.severity})</span>
              </span>
            );
          })
        )}

        <span className="ms-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Pill className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {t('criticalBanner.medications')} ({critical.current_medications.length})
          </span>
        </span>
      </div>
    </section>
  );
}
