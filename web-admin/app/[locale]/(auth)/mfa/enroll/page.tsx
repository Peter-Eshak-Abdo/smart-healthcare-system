'use client';

import type { MeResponse } from '@smarthealth/contracts';
import { QrCode, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { getSupabaseBrowser } from '@/lib/supabase/client';

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

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    let active = true;
    void supabase.auth.mfa
      .enroll({ factorType: 'totp', friendlyName: 'SmartHealth Clinical' })
      .then(({ data, error: enrollErr }) => {
        if (!active) return;
        if (enrollErr || !data) {
          setError(enrollErr ?? new Error('MFA enrollment unavailable'));
          return;
        }
        setFactorId(data.id);
        setQrSvg(data.totp.qr_code);
        setSecret(data.totp.secret);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase || !factorId) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: challengeErr, data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr || !challenge) {
        setError(challengeErr ?? new Error('Failed to start challenge'));
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyErr) {
        setError(verifyErr);
        return;
      }
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

        {qrSvg && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4">
            {/* Supabase enroll returns an inline SVG data URI */}
            <img src={qrSvg} alt="TOTP QR" className="h-44 w-44" />
            {secret && (
              <p className="clinical-num break-all text-center font-mono text-xs text-muted-foreground" dir="ltr">
                {secret}
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
            disabled={submitting || !factorId}
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
