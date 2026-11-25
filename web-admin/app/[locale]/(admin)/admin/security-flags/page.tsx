'use client';

import type { AdminSecurityFlagsResponseSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type FlagsRes = z.infer<typeof AdminSecurityFlagsResponseSchema>;

export default function AdminSecurityFlagsPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';

  const query = useQuery({
    queryKey: ['admin-security-flags'],
    queryFn: () => apiFetch<FlagsRes>('/v1/admin/security-flags', { locale }),
  });

  return (
    <div className="space-y-4">
      {query.error !== null && query.error !== undefined && <ProblemAlert error={query.error} />}

      {(query.data?.data ?? []).length === 0 && !query.isLoading ? (
        <EmptyState title={isEn ? 'No security flags active.' : 'مفيش تنبيهات أمنية مفتوحة.'} />
      ) : (
        (query.data?.data ?? []).map((f) => (
          <div
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-bold text-foreground">{f.flag_type}</p>
                <p className="clinical-num font-mono text-xs text-muted-foreground">
                  <bdi>{f.user_id}</bdi> · {formatCairoDateTime(f.created_at, locale)}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
              {f.resolved_at ? (isEn ? 'Resolved' : 'تم الحل') : isEn ? 'Open' : 'مفتوح'}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
