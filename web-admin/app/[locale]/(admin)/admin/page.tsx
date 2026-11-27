'use client';

import type { AdminAiMetricsResponseSchema, AdminMetricsResponseSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, FileText, ShieldCheck, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';

type AdminMetrics = z.infer<typeof AdminMetricsResponseSchema>;
type AdminAiMetrics = z.infer<typeof AdminAiMetricsResponseSchema>;

export default function AdminOverviewPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const tAdm = useTranslations('admin');

  const query = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiFetch<AdminMetrics>('/v1/admin/metrics', { locale }),
  });

  const aiMetricsQuery = useQuery({
    queryKey: ['admin-ai-metrics'],
    queryFn: () => apiFetch<AdminAiMetrics>('/v1/admin/ai-metrics', { locale }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm font-semibold text-primary">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>{tAdm('noPhiNotice')}</span>
        </div>
      </div>

      {query.error !== null && query.error !== undefined && <ProblemAlert error={query.error} />}

      {query.data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tAdm('activePatients')}</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="clinical-num mt-2 text-3xl font-extrabold">
                {query.data.active_patients}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tAdm('rxIssued7d')}</span>
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <p className="clinical-num mt-2 text-3xl font-extrabold">
                {query.data.rx_issued_7d}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tAdm('dispenseRate')}</span>
                <Activity className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="clinical-num mt-2 text-3xl font-extrabold">
                {(query.data.dispense_rate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{isEn ? 'AI Red Flags (7d)' : 'تنبيهات الطوارئ (7 أيام)'}</span>
                <ShieldCheck className="h-4 w-4 text-amber-600" />
              </div>
              <p className="clinical-num mt-2 text-3xl font-extrabold">
                {query.data.ai_red_flags_7d}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-bold text-foreground">
              {isEn ? 'Safety Override Rate by Prescriber' : 'نسبة تجاوز تنبيهات الأدوية حسب الدكتور'}
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted-foreground">
                    <th className="py-2 text-start">{isEn ? 'Doctor' : 'الدكتور'}</th>
                    <th className="py-2 text-start">{isEn ? 'Override Rate' : 'نسبة التجاوز'}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.override_rate_by_doctor.map((row) => (
                    <tr key={row.doctor_id} className="border-b border-border/50">
                      <td className="py-2.5 font-medium">{row.doctor_name}</td>
                      <td className="clinical-num py-2.5 font-mono font-bold">
                        {(row.override_rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {aiMetricsQuery.data && (
            <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-base font-bold text-foreground">
                <Cpu className="h-5 w-5 text-primary" />
                <h2>
                  {isEn ? 'AI Token & Cache Efficiency (Today)' : 'كفاءة استهلاك التوكنز والكاش (اليوم)'}
                </h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-xs text-muted-foreground">
                    {isEn ? 'Cache Hit Rate' : 'نسبة إصابة الكاش'}
                  </p>
                  <p className="clinical-num mt-1 text-2xl font-extrabold text-emerald-600">
                    {(aiMetricsQuery.data.cache_hit_rate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-xs text-muted-foreground">
                    {isEn ? 'Tokens Used Today' : 'التوكنز المستهلكة اليوم'}
                  </p>
                  <p className="clinical-num mt-1 text-2xl font-extrabold">
                    {aiMetricsQuery.data.total_tokens_used_today}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-xs text-muted-foreground">
                    {isEn ? 'Est. Tokens Saved' : 'التوكنز الموفرة'}
                  </p>
                  <p className="clinical-num mt-1 text-2xl font-extrabold text-primary">
                    {aiMetricsQuery.data.estimated_tokens_saved_today}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-xs text-muted-foreground">
                    {isEn ? '0-Token Requests' : 'طلبات بدون توكنز'}
                  </p>
                  <p className="clinical-num mt-1 text-2xl font-extrabold">
                    {aiMetricsQuery.data.zero_token_requests_today}
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
