'use client';

import type { PharmacyHistoryResponseSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type HistoryPage = z.infer<typeof PharmacyHistoryResponseSchema>;

export default function PharmacyHistoryPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const tNavPh = useTranslations('nav.pharmacy');

  const query = useQuery({
    queryKey: ['pharmacy-history'],
    queryFn: () => apiFetch<HistoryPage>('/v1/pharmacy/dispensations?limit=50', { locale }),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">{tNavPh('history')}</h1>

      {query.error !== null && query.error !== undefined && <ProblemAlert error={query.error} />}

      {(query.data?.data ?? []).length === 0 && !query.isLoading ? (
        <EmptyState title={isEn ? 'No dispensations recorded yet.' : 'مفيش عمليات صرف مسجلة لسه.'} />
      ) : (
        <div className="space-y-3">
          {(query.data?.data ?? []).map((d) => (
            <div
              key={d.dispensation_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <p className="clinical-num font-mono text-sm font-bold text-primary">
                  <bdi>{d.rx_number}</bdi>
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="clinical-num">{d.item_count}</span> {isEn ? 'items dispensed' : 'أصناف مصروفة'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatCairoDateTime(d.dispensed_at, locale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
