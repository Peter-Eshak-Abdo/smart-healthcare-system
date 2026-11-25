'use client';

import type { DoctorPatientListItemSchema, DoctorPrescriptionsResponseSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, FileText, KeyRound, Search, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type PatientItem = z.infer<typeof DoctorPatientListItemSchema>;
type PatientsPage = { data: PatientItem[]; next_cursor: string | null };
type PrescriptionsPage = z.infer<typeof DoctorPrescriptionsResponseSchema>;

export default function DoctorDashboardPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const tDoc = useTranslations('doctor');

  const [query, setQuery] = useState('');

  const patientsQuery = useQuery({
    queryKey: ['doctor-patients', query],
    queryFn: () => {
      const qs = query.trim().length >= 2 ? `?query=${encodeURIComponent(query.trim())}` : '';
      return apiFetch<PatientsPage>(`/v1/doctor/patients${qs}`, { locale });
    },
  });

  const rxQuery = useQuery({
    queryKey: ['doctor-prescriptions-today'],
    queryFn: () => apiFetch<PrescriptionsPage>('/v1/doctor/prescriptions?limit=50', { locale }),
  });

  const expiringSoon = useMemo(() => {
    const items = patientsQuery.data?.data ?? [];
    const cutoff = Date.now() + 2 * 60 * 60_000;
    return items.filter((p) => new Date(p.grant.expires_at).getTime() <= cutoff);
  }, [patientsQuery.data]);

  const issuedTodayCount = useMemo(() => {
    const items = rxQuery.data?.data ?? [];
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return items.filter((rx) => rx.issued_at.startsWith(todayPrefix)).length;
  }, [rxQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tDoc('welcome')}</h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Active patient grants, daily prescriptions, and quick chart search'
              : 'الأذون النشطة، روشتات اليوم، والوصول السريع لملفات المرضى'}
          </p>
        </div>
        <Link
          href={`${prefix}/doctor/access/redeem` as never}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <KeyRound className="h-4 w-4" />
          <span>{tDoc('redeemCta')}</span>
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{tDoc('activeGrants')}</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="clinical-num mt-2 text-3xl font-extrabold text-foreground">
            {patientsQuery.data?.data.length ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{tDoc('rxToday')}</span>
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <p className="clinical-num mt-2 text-3xl font-extrabold text-foreground">
            {issuedTodayCount}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{tDoc('expiringSoon')}</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="clinical-num mt-2 text-3xl font-extrabold text-foreground">
            {expiringSoon.length}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tDoc('searchPlaceholder')}
            className="w-full rounded-xl border border-border bg-background py-2.5 pe-4 ps-10 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {patientsQuery.error !== null && patientsQuery.error !== undefined && (
          <div className="mt-4">
            <ProblemAlert error={patientsQuery.error} />
          </div>
        )}

        {expiringSoon.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {tDoc('expiringSoon')}: {expiringSoon.length} — {tDoc('askRenew')}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {(patientsQuery.data?.data ?? []).length === 0 && !patientsQuery.isLoading ? (
            <EmptyState
              title={tDoc('emptyPatients')}
              action={
                <Link
                  href={`${prefix}/doctor/access/redeem` as never}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>{tDoc('redeemCta')}</span>
                </Link>
              }
            />
          ) : (
            (patientsQuery.data?.data ?? []).map((p) => (
              <Link
                key={p.patient_id}
                href={`${prefix}/doctor/patients/${p.patient_id}` as never}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-accent/30"
              >
                <div>
                  <p className="font-bold text-foreground">{p.full_name}</p>
                  <p className="clinical-num mt-0.5 font-mono text-xs text-muted-foreground">
                    <bdi>{p.mrn}</bdi> · {p.age} · {p.sex}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                  <span>{formatCairoDateTime(p.grant.expires_at, locale)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
