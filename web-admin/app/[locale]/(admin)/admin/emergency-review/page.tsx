'use client';

import type {
  AdminEmergencySessionsResponseSchema,
  AdminReviewEmergencySessionResponseSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/common/EmptyState';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type SessionsPage = z.infer<typeof AdminEmergencySessionsResponseSchema>;
type ReviewRes = z.infer<typeof AdminReviewEmergencySessionResponseSchema>;

export default function AdminEmergencyReviewPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: ['admin-er-sessions'],
    queryFn: () => apiFetch<SessionsPage>('/v1/admin/emergency-sessions', { locale }),
  });

  const reviewMutation = useMutation({
    mutationFn: (input: { id: string; outcome: 'appropriate' | 'inappropriate' }) =>
      apiFetch<ReviewRes>(`/v1/admin/emergency-sessions/${input.id}/review`, {
        method: 'POST',
        locale,
        body: {
          outcome: input.outcome,
          note: (notes[input.id] ?? '').trim() || 'Administrative break-glass review completed.',
        },
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-er-sessions'] });
    },
    onError: (err) => setError(err),
  });

  return (
    <div className="space-y-4">
      {error !== null && <ProblemAlert error={error} />}
      {query.error !== null && query.error !== undefined && <ProblemAlert error={query.error} />}

      {(query.data?.data ?? []).length === 0 && !query.isLoading ? (
        <EmptyState title={isEn ? 'No emergency sessions to review.' : 'مفيش جلسات طوارئ للمراجعة.'} />
      ) : (
        (query.data?.data ?? []).map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-foreground">
                  {s.paramedic.name} · {s.method} ·{' '}
                  <span className="clinical-num font-mono">••{s.patient_mrn_last4 ?? '----'}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCairoDateTime(s.started_at, locale)} · score: {s.match_score_band} ·{' '}
                  {s.review_status}
                </p>
              </div>
            </div>

            {s.review_status === 'pending' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[s.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  placeholder={isEn ? 'Review justification...' : 'ملاحظات المراجعة...'}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate({ id: s.id, outcome: 'appropriate' })}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {isEn ? 'Appropriate' : 'استخدام سليم'}
                </button>
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate({ id: s.id, outcome: 'inappropriate' })}
                  className="rounded-xl bg-destructive px-3 py-1.5 text-xs font-bold text-white"
                >
                  {isEn ? 'Inappropriate' : 'مخالفة'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
