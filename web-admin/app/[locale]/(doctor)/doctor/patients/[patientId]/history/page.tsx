'use client';

import type { MedicalHistoryResponseSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type HistoryResponse = z.infer<typeof MedicalHistoryResponseSchema>;

export default function DoctorPatientHistoryPage() {
  const params = useParams<{ patientId: string }>();
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const [filter, setFilter] = useState<'all' | 'visits' | 'diagnoses' | 'medications'>('all');

  const historyQuery = useQuery({
    queryKey: ['doctor-patient-history', params.patientId, filter],
    queryFn: () =>
      apiFetch<HistoryResponse>(`/v1/doctor/patients/${params.patientId}/history?type=${filter}`, {
        locale,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['all', 'visits', 'diagnoses', 'medications'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
              filter === tab
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {historyQuery.error !== null && historyQuery.error !== undefined && (
        <ProblemAlert error={historyQuery.error} />
      )}

      {(historyQuery.data?.data ?? []).length === 0 && !historyQuery.isLoading ? (
        <EmptyState title={isEn ? 'No history entries.' : 'مفيش سجل زيارات سابق.'} />
      ) : (
        <div className="space-y-3">
          {(historyQuery.data?.data ?? []).map((item, idx) =>
            item.kind === 'restricted_placeholder' ? (
              <div
                key={`restricted-${idx}`}
                className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-semibold text-amber-800 dark:text-amber-300"
              >
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {isEn ? 'Restricted visit (hidden by patient)' : 'زيارة مقيدة (مخفية بواسطة المريض)'}
                </span>
                <span>{formatCairoDateTime(item.started_at, locale)}</span>
              </div>
            ) : (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">
                      {item.doctor.name} · {item.facility.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.encounter_type} · {formatCairoDateTime(item.started_at, locale)}
                    </p>
                  </div>
                  <Link
                    href={`${prefix}/doctor/patients/${params.patientId}/encounters/${item.id}` as never}
                    className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-accent"
                  >
                    {isEn ? 'Open' : 'فتح'}
                  </Link>
                </div>

                {item.diagnoses.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.diagnoses.map((d) => (
                      <span
                        key={`${item.id}-${d.icd10_code}`}
                        className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium"
                      >
                        <bdi>{d.icd10_code}</bdi> · {isEn ? d.name.en : d.name.ar}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes_internal && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.notes_internal}
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
