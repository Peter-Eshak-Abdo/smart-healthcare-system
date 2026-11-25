'use client';

import type { MeResponse } from '@smarthealth/contracts';
import {
  getMultiFactorResolver,
  multiFactor,
  signInWithEmailAndPassword,
  type MultiFactorError,
} from 'firebase/auth';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import {
  getFirebaseBrowserAuth,
  setPendingMfaResolver,
  syncFirebaseSessionCookie,
} from '@/lib/firebase/client';

function resolvePortalHome(role: MeResponse['role'], prefix: string): string {
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

export default function LoginPage() {
  const locale = useLocale() as 'ar' | 'en';
  const prefix = locale === 'ar' ? '' : `/${locale}`;
  const router = useRouter();
  const tApp = useTranslations('app');
  const tAuth = useTranslations('auth');
  const tErr = useTranslations('errors');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const auth = getFirebaseBrowserAuth();
    if (!auth) {
      setError(new Error(tErr('GENERIC')));
      return;
    }

    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const factors = multiFactor(cred.user).enrolledFactors;
      if (factors.length === 0) {
        const token = await cred.user.getIdToken();
        await syncFirebaseSessionCookie(token);
        router.push(`${prefix}/mfa/enroll` as never);
        return;
      }

      const token = await cred.user.getIdToken();
      await syncFirebaseSessionCookie(token);
      const me = await apiFetch<MeResponse>('/v1/me', { locale });
      router.push(resolvePortalHome(me.role, prefix) as never);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
        setPendingMfaResolver(resolver);
        router.push(`${prefix}/mfa/verify` as never);
        return;
      }
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">{tApp('name')}</p>
            <h1 className="text-lg font-bold text-foreground">{tAuth('loginTitle')}</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tAuth('loginSubtitle')}</p>

        {error !== null && (
          <div className="mt-4">
            <ProblemAlert error={error} />
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              {tAuth('email')}
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              {tAuth('password')}
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-95 disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            <span>{submitting ? '…' : tAuth('signIn')}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
