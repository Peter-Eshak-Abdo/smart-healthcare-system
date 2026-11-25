'use client';

import type { DoctorPatientSummaryResponseSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { PatientHeader } from '@/components/patient/PatientHeader';
import { apiFetch } from '@/lib/api/client';
import { isApiErrorCode } from '@/lib/api/errors';

type PatientSummary = z.infer<typeof DoctorPatientSummaryResponseSchema>;

export default function PatientChartLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ patientId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const prefix = locale === 'en' ? '/en' : '';
  const tTabs = useTranslations('doctor.tabs');

  const summaryQuery = useQuery({
    queryKey: ['doctor-patient-summary', params.patientId],
    queryFn: () =>
      apiFetch<PatientSummary>(`/v1/doctor/patients/${params.patientId}/summary`, { locale }),
  });

  useEffect(() => {
    if (
      summaryQuery.error &&
      (isApiErrorCode(summaryQuery.error, 'ACCESS_GRANT_REVOKED') ||
        isApiErrorCode(summaryQuery.error, 'ACCESS_GRANT_REQUIRED'))
    ) {
      router.replace(`${prefix}/doctor/patients?revoked=1` as never);
    }
  }, [prefix, router, summaryQuery.error]);

  const basePath = `${prefix}/doctor/patients/${params.patientId}`;
  const tabs = [
    { href: basePath, label: tTabs('summary'), exact: true },
    { href: `${basePath}/history`, label: tTabs('history'), exact: false },
    { href: `${basePath}/prescribe`, label: tTabs('prescribe'), exact: false },
  ];

  return (
    <div className="space-y-5">
      {summaryQuery.data && <PatientHeader summary={summaryQuery.data} />}

      {summaryQuery.error !== null && summaryQuery.error !== undefined && (
        <ProblemAlert error={summaryQuery.error} />
      )}

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href as never}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
