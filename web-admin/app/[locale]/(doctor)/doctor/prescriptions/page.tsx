'use client';

import type { DoctorPrescriptionsResponseSchema } from '@smarthealth/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Printer } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type PrescriptionsPage = z.infer<typeof DoctorPrescriptionsResponseSchema>;

export default function DoctorPrescriptionsPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const queryClient = useQueryClient();
  const tNavDoc = useTranslations('nav.doctor');
  const tRx = useTranslations('rx');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cancelError, setCancelError] = useState<unknown>(null);

  const listQuery = useQuery({
    queryKey: ['doctor-rx-list', statusFilter],
    queryFn: () => {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      return apiFetch<PrescriptionsPage>(`/v1/doctor/prescriptions${qs}`, { locale });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (rxId: string) =>
      apiFetch(`/v1/prescriptions/${rxId}/cancel`, {
        method: 'POST',
        locale,
        body: { reason_code: 'prescribing_error', item_ids: null },
      }),
    onSuccess: () => {
      setCancelError(null);
      void queryClient.invalidateQueries({ queryKey: ['doctor-rx-list'] });
    },
    onError: (err) => setCancelError(err),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{tNavDoc('prescriptions')}</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">{isEn ? 'All statuses' : 'كل الحالات'}</option>
          <option value="pending">{isEn ? 'Pending' : 'قيد الانتظار'}</option>
          <option value="partially_dispensed">{isEn ? 'Partially dispensed' : 'صرف جزئي'}</option>
          <option value="dispensed">{isEn ? 'Dispensed' : 'مصروفة بالكامل'}</option>
          <option value="cancelled">{isEn ? 'Cancelled' : 'ملغاة'}</option>
          <option value="expired">{isEn ? 'Expired' : 'منتهية'}</option>
        </select>
      </div>

      {cancelError !== null && <ProblemAlert error={cancelError} />}
      {listQuery.error !== null && listQuery.error !== undefined && (
        <ProblemAlert error={listQuery.error} />
      )}

      {(listQuery.data?.data ?? []).length === 0 && !listQuery.isLoading ? (
        <EmptyState title={isEn ? 'No prescriptions found.' : 'مفيش روشتات لسه.'} />
      ) : (
        <div className="space-y-3">
          {(listQuery.data?.data ?? []).map((rx) => (
            <div
              key={rx.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="clinical-num font-mono text-sm font-bold text-primary">
                    <bdi>{rx.rx_number}</bdi>
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                    {rx.status}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {rx.patient.full_name} (<bdi>{rx.patient.mrn}</bdi>) ·{' '}
                  <span className="clinical-num">{rx.item_count}</span>{' '}
                  {isEn ? 'items' : 'أصناف'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatCairoDateTime(rx.issued_at, locale)} →{' '}
                  {formatCairoDateTime(rx.expires_at, locale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`${prefix}/print/prescriptions/${rx.id}` as never}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{tRx('printSummary')}</span>
                </Link>
                {(rx.status === 'pending' || rx.status === 'partially_dispensed') && (
                  <button
                    type="button"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(rx.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span>{isEn ? 'Cancel Rx' : 'إلغاء الروشتة'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
