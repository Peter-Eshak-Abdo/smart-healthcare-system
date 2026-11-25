'use client';

import type {
  AdminAuditEventsResponseSchema,
  AdminAuditIntegrityResponseSchema,
} from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';
import { getSupabaseBrowser } from '@/lib/supabase/client';

type AuditPage = z.infer<typeof AdminAuditEventsResponseSchema>;
type AuditIntegrity = z.infer<typeof AdminAuditIntegrityResponseSchema>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default function AdminAuditPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const tAdm = useTranslations('admin');
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');

  const integrityQuery = useQuery({
    queryKey: ['admin-audit-integrity'],
    queryFn: () => apiFetch<AuditIntegrity>('/v1/admin/audit-integrity', { locale }),
  });

  const eventsQuery = useQuery({
    queryKey: ['admin-audit-events', actionFilter, outcomeFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (actionFilter.trim()) qs.set('action', actionFilter.trim());
      if (outcomeFilter) qs.set('outcome', outcomeFilter);
      const q = qs.toString();
      return apiFetch<AuditPage>(`/v1/admin/audit-events${q ? `?${q}` : ''}`, { locale });
    },
  });

  const handleExportCsv = async () => {
    const supabase = getSupabaseBrowser();
    const token = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined;
    const res = await fetch(`${API_BASE}/v1/admin/audit-events/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smarthealth-audit.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {integrityQuery.data && (
        <div
          className={`flex items-center justify-between rounded-2xl border p-4 text-sm font-bold ${
            integrityQuery.data.status === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive bg-destructive/15 text-destructive'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {integrityQuery.data.status === 'ok' ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            <span>
              {integrityQuery.data.status === 'ok'
                ? tAdm('auditIntegrityOk')
                : tAdm('auditIntegrityBroken', {
                    seq: integrityQuery.data.broken_at_event_id ?? '0',
                  })}
            </span>
          </span>
          <span className="text-xs opacity-75">
            {formatCairoDateTime(integrityQuery.data.verified_at, locale)}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder={isEn ? 'Filter action...' : 'تصفية بنوع العملية...'}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
          />
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">{isEn ? 'All outcomes' : 'كل النتائج'}</option>
            <option value="success">success</option>
            <option value="denied">denied</option>
            <option value="error">error</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void handleExportCsv()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-accent"
        >
          <Download className="h-4 w-4" />
          <span>{isEn ? 'Export CSV' : 'تصدير CSV'}</span>
        </button>
      </div>

      {eventsQuery.error !== null && eventsQuery.error !== undefined && (
        <ProblemAlert error={eventsQuery.error} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-start text-muted-foreground">
              <th className="p-3 text-start">{isEn ? 'Time' : 'الوقت'}</th>
              <th className="p-3 text-start">{isEn ? 'Actor' : 'الفاعل'}</th>
              <th className="p-3 text-start">{isEn ? 'Action' : 'العملية'}</th>
              <th className="p-3 text-start">{isEn ? 'Resource' : 'المورد'}</th>
              <th className="p-3 text-start">{isEn ? 'Outcome' : 'النتيجة'}</th>
            </tr>
          </thead>
          <tbody>
            {(eventsQuery.data?.data ?? []).map((ev) => (
              <tr key={ev.id} className="border-b border-border/50">
                <td className="clinical-num p-3">{formatCairoDateTime(ev.occurred_at, locale)}</td>
                <td className="p-3">
                  {ev.actor.name ?? 'system'} ({ev.actor.role ?? '—'})
                </td>
                <td className="clinical-num p-3 font-mono font-bold">{ev.action}</td>
                <td className="clinical-num p-3 font-mono">
                  {ev.resource_type}
                  {ev.patient_mrn_last4 ? ` · ••${ev.patient_mrn_last4}` : ''}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                    {ev.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
