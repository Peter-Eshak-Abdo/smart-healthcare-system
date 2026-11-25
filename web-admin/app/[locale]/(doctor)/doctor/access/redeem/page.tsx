'use client';

import type { RedeemShareCodeResponseSchema } from '@smarthealth/contracts';
import { KeyRound, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';

type RedeemRes = z.infer<typeof RedeemShareCodeResponseSchema>;

export default function RedeemShareCodePage() {
  const locale = useLocale() as 'ar' | 'en';
  const prefix = locale === 'en' ? '/en' : '';
  const router = useRouter();
  const tDoc = useTranslations('doctor');

  const [mrn, setMrn] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<RedeemRes>('/v1/doctor/access/redeem', {
        method: 'POST',
        locale,
        body: {
          patient_mrn: mrn.trim().toUpperCase(),
          code: code.trim(),
        },
      });
      router.push(`${prefix}/doctor/patients/${res.patient_id}` as never);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-bold text-foreground">{tDoc('redeemTitle')}</h1>
      </div>

      {error !== null && (
        <div className="mt-4">
          <ProblemAlert error={error} />
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="redeem-mrn" className="text-sm font-medium text-foreground">
            {tDoc('mrnLabel')}
          </label>
          <input
            id="redeem-mrn"
            required
            value={mrn}
            onChange={(e) => setMrn(e.target.value)}
            placeholder="SH-EG-000102"
            className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
            dir="ltr"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="redeem-code" className="text-sm font-medium text-foreground">
            {tDoc('shareCodeLabel')}
          </label>
          <input
            id="redeem-code"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Unlock className="h-4 w-4" />
          <span>{submitting ? '…' : tDoc('redeemSubmit')}</span>
        </button>
      </form>
    </div>
  );
}
