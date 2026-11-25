'use client';

import type { MeResponse } from '@smarthealth/contracts';
import {
  multiFactor,
  TotpMultiFactorGenerator,
  type TotpSecret,
} from 'firebase/auth';
import { QrCode, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { getFirebaseBrowserAuth, syncFirebaseSessionCookie } from '@/lib/firebase/client';

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

export default function MfaEnrollPage() {
  const locale = useLocale() as 'ar' | 'en';
  const prefix = locale === 'ar' ? '' : `/${locale}`;
  const router = useRouter();
  const tAuth = useTranslations('auth');

  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const auth = getFirebaseBrowserAuth();
    const user = auth?.currentUser;
    if (!user) return;
    let active = true;
    void multiFactor(user)
      .getSession()
      .then((session) => TotpMultiFactorGenerator.generateSecret(session))
      .then((secret) => {
        if (!active) return;
        setTotpSecret(secret);
        setQrUri(secret.generateQrCodeUrl(user.email ?? 'staff@smarthealth.eg', 'SmartHealth'));
      })
      .catch((err) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    const auth = getFirebaseBrowserAuth();
    const user = auth?.currentUser;
    if (!user || !totpSecret) return;
    setError(null);
    setSubmitting(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code.trim());
      await multiFactor(user).enroll(assertion, 'SmartHealth Clinical');
      const token = await user.getIdToken(true);
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
            <QrCode className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{tAuth('mfaEnrollTitle')}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tAuth('mfaHint')}</p>

        {error !== null && (
          <div className="mt-4">
            <ProblemAlert error={error} />
          </div>
        )}

        {totpSecret && (
          <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4 text-center">
            <p className="clinical-num break-all font-mono text-xs text-foreground" dir="ltr">
              {totpSecret.secretKey}
            </p>
            {qrUri && (
              <p className="clinical-num break-all font-mono text-[10px] text-muted-foreground" dir="ltr">
                {qrUri}
              </p>
            )}
          </div>
        )}

        <form onSubmit={(e) => void handleConfirm(e)} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mfa-enroll-code" className="text-sm font-medium text-foreground">
              {tAuth('mfaCode')}
            </label>
            <input
              id="mfa-enroll-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !totpSecret}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{tAuth('mfaVerifyBtn')}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
