'use client';

import type { DoctorPatientListItemSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type PatientItem = z.infer<typeof DoctorPatientListItemSchema>;
type PatientsPage = { data: PatientItem[]; next_cursor: string | null };

export default function DoctorPatientsPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const tDoc = useTranslations('doctor');
  const tNavDoc = useTranslations('nav.doctor');

  const [query, setQuery] = useState('');

  const patientsQuery = useQuery({
    queryKey: ['doctor-patients-list', query],
    queryFn: () => {
      const qs = query.trim().length >= 2 ? `?query=${encodeURIComponent(query.trim())}` : '';
      return apiFetch<PatientsPage>(`/v1/doctor/patients${qs}`, { locale });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{tNavDoc('patients')}</h1>
        <Link
          href={`${prefix}/doctor/access/redeem` as never}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <KeyRound className="h-4 w-4" />
          <span>{tDoc('redeemCta')}</span>
        </Link>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tDoc('searchPlaceholder')}
          className="w-full rounded-xl border border-border bg-card py-2.5 pe-4 ps-10 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {patientsQuery.error !== null && patientsQuery.error !== undefined && (
        <ProblemAlert error={patientsQuery.error} />
      )}

      {(patientsQuery.data?.data ?? []).length === 0 && !patientsQuery.isLoading ? (
        <EmptyState title={tDoc('emptyPatients')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(patientsQuery.data?.data ?? []).map((p) => (
            <Link
              key={p.patient_id}
              href={`${prefix}/doctor/patients/${p.patient_id}` as never}
              className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-foreground">{p.full_name}</h2>
                  <p className="clinical-num mt-1 font-mono text-xs text-muted-foreground">
                    <bdi>{p.mrn}</bdi> · {p.age} · {p.sex}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Granted' : 'إذن نشط'}</span>
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {isEn ? 'Grant expires:' : 'ينتهي الإذن:'} {formatCairoDateTime(p.grant.expires_at, locale)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
