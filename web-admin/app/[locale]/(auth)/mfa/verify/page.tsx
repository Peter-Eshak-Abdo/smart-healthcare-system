'use client';

import type { MeResponse } from '@smarthealth/contracts';
import { TotpMultiFactorGenerator } from 'firebase/auth';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import {
  getPendingMfaResolver,
  setPendingMfaResolver,
  syncFirebaseSessionCookie,
} from '@/lib/firebase/client';

function portalHome(role: MeResponse['role'], prefix: string): string {
  switch (role) {
    case 'doctor':
      return `${prefix}/doctor`;
    case 'pharmacist':
      return `${prefix}/pharmacy`;
    case 'paramedic':
      return `${prefix}/er`;
    case 'admin':
      return `${prefix}/admin`;
    default:
      return `${prefix}/not-authorized`;
  }
}

export default function MfaVerifyPage() {
  const locale = useLocale() as 'ar' | 'en';
  const prefix = locale === 'ar' ? '' : `/${locale}`;
  const router = useRouter();
  const tAuth = useTranslations('auth');

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const resolver = getPendingMfaResolver();
    if (!resolver) {
      router.push(`${prefix}/login` as never);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const hint = resolver.hints.find(
        (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      if (!hint) {
        router.push(`${prefix}/mfa/enroll` as never);
        return;
      }

      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
      const cred = await resolver.resolveSignIn(assertion);
      setPendingMfaResolver(null);
      const token = await cred.user.getIdToken(true);
      await syncFirebaseSessionCookie(token);

      const me = await apiFetch<MeResponse>('/v1/me', { locale });
      router.push(portalHome(me.role, prefix) as never);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{tAuth('mfaTitle')}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tAuth('mfaHint')}</p>

        {error !== null && (
          <div className="mt-4">
            <ProblemAlert error={error} />
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mfa-verify-code" className="text-sm font-medium text-foreground">
              {tAuth('mfaCode')}
            </label>
            <input
              id="mfa-verify-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{submitting ? '…' : tAuth('mfaVerifyBtn')}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
