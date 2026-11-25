'use client';

import type {
  MeResponse,
  VerifyPrescriptionResponseSchema,
  VerifySmsPendingResponseSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, KeyRound, QrCode, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { RxSeal } from '@/components/three/RxSeal';
import { apiFetch } from '@/lib/api/client';
import { isApiErrorCode } from '@/lib/api/errors';
import { fetchRxJwks, verifyPickupTokenSignatureLocally } from '@/lib/crypto/jwks';

type VerifySuccess = z.infer<typeof VerifyPrescriptionResponseSchema>;
type VerifySmsPending = z.infer<typeof VerifySmsPendingResponseSchema>;
type VerifyResponse = VerifySuccess | VerifySmsPending;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default function PharmacyVerifyPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const router = useRouter();
  const tPh = useTranslations('pharmacy');

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/v1/me', { locale }),
  });

  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>('');
  const [tab, setTab] = useState<'scan' | 'manual'>('scan');
  const [pickupToken, setPickupToken] = useState('');
  const [rxNumber, setRxNumber] = useState('');
  const [paperCode, setPaperCode] = useState('');
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpTargetHint, setOtpTargetHint] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [tamperBlocked, setTamperBlocked] = useState(false);
  const [online, setOnline] = useState(true);
  const [localCheckResult, setLocalCheckResult] = useState<'valid' | 'expired' | 'unverifiable' | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const firstFacility = meQuery.data?.practitioner?.facilities[0]?.id;
    if (firstFacility && !selectedPharmacyId) {
      setSelectedPharmacyId(meQuery.data?.practitioner?.active_facility_id ?? firstFacility);
    }
  }, [meQuery.data, selectedPharmacyId]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      setTamperBlocked(false);
      setLocalCheckResult(null);
      setError(null);

      if (tab === 'scan') {
        const trimmed = pickupToken.trim();
        const keys = await fetchRxJwks(API_BASE);
        const localStatus = await verifyPickupTokenSignatureLocally(trimmed, keys);
        if (localStatus.status === 'invalid') {
          setTamperBlocked(true);
          throw new Error(tPh('doNotDispense'));
        }
        if (!navigator.onLine) {
          setLocalCheckResult(localStatus.status);
          return null;
        }
        return apiFetch<VerifyResponse>('/v1/pharmacy/prescriptions/verify', {
          method: 'POST',
          locale,
          body: {
            mode: 'pickup_token',
            pickup_token: trimmed,
            pharmacy_id: selectedPharmacyId,
          },
        });
      }

      return apiFetch<VerifyResponse>('/v1/pharmacy/prescriptions/verify', {
        method: 'POST',
        locale,
        body: {
          mode: 'rx_code',
          rx_number: rxNumber.trim().toUpperCase(),
          verification_code: paperCode.trim().toUpperCase(),
          pharmacy_id: selectedPharmacyId,
          presence: {
            method: 'sms_otp',
            otp_request_id: otpRequestId,
            ...(otpRequestId && otpCode.trim() ? { otp_code: otpCode.trim() } : {}),
          },
        },
      });
    },
    onSuccess: (res) => {
      if (!res) return;
      if ('otp_request_id' in res) {
        setOtpRequestId(res.otp_request_id);
        setOtpTargetHint(res.sent_to);
        return;
      }
      router.push(
        `${prefix}/pharmacy/prescriptions/${res.prescription.id}?vid=${res.verification_id}&until=${encodeURIComponent(res.valid_until)}&result=${res.result}` as never,
      );
    },
    onError: (err) => {
      if (isApiErrorCode(err, 'RX_SIGNATURE_INVALID')) {
        setTamperBlocked(true);
      }
      setError(err);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPharmacyId) return;
    verifyMutation.mutate();
  };

  const facilities = meQuery.data?.practitioner?.facilities ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{tPh('verifyTitle')}</h1>
        <RxSeal
          status={
            tamperBlocked
              ? 'invalid'
              : localCheckResult === 'expired'
                ? 'expired'
                : localCheckResult === 'valid'
                  ? 'valid'
                  : 'verifying'
          }
        />
      </div>

      {!online && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-sm font-semibold text-amber-900 dark:text-amber-200">
          {tPh('offlineBanner')}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <label
          htmlFor="pharmacy-facility-select"
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground"
        >
          <Building2 className="h-4 w-4 text-primary" />
          <span>{tPh('selectFacility')}</span>
        </label>
        <select
          id="pharmacy-facility-select"
          value={selectedPharmacyId}
          onChange={(e) => setSelectedPharmacyId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {tamperBlocked && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-destructive bg-destructive/15 p-6 text-destructive shadow-sm"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 shrink-0" />
            <div>
              <h2 className="text-lg font-extrabold">{tPh('doNotDispense')}</h2>
              <p className="mt-1 text-sm">{tPh('doNotDispenseBody')}</p>
            </div>
          </div>
        </div>
      )}

      {localCheckResult === 'valid' && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-5 w-5" />
          <span>{tPh('validBanner')}</span>
        </div>
      )}

      {localCheckResult === 'expired' && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-bold text-amber-800 dark:text-amber-300">
          {tPh('expired')}
        </div>
      )}

      {error !== null && !tamperBlocked && <ProblemAlert error={error} />}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setTab('scan')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === 'scan'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-muted-foreground'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>{tPh('tabScan')}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === 'manual'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-muted-foreground'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>{tPh('tabManual')}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'scan' ? (
            <div className="space-y-1.5">
              <label htmlFor="pickup-token" className="text-sm font-medium">
                {tPh('scanPlaceholder')}
              </label>
              <textarea
                id="pickup-token"
                rows={3}
                required
                value={pickupToken}
                onChange={(e) => setPickupToken(e.target.value)}
                placeholder="SH1.eyJ..."
                className="clinical-num w-full rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="rx-number" className="text-xs font-medium">
                    {tPh('rxNumber')}
                  </label>
                  <input
                    id="rx-number"
                    required
                    value={rxNumber}
                    onChange={(e) => setRxNumber(e.target.value)}
                    placeholder="RX-2026-000102"
                    className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="paper-code" className="text-xs font-medium">
                    {tPh('paperCode')}
                  </label>
                  <input
                    id="paper-code"
                    required
                    value={paperCode}
                    onChange={(e) => setPaperCode(e.target.value)}
                    placeholder="K7M2P9"
                    className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm uppercase"
                    dir="ltr"
                  />
                </div>
              </div>

              {otpRequestId && (
                <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <label htmlFor="otp-code" className="text-xs font-bold text-primary">
                    {tPh('otpPrompt')} ({otpTargetHint})
                  </label>
                  <input
                    id="otp-code"
                    required
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="clinical-num w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
                    dir="ltr"
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || !selectedPharmacyId}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {tab === 'manual' && !otpRequestId ? tPh('presenceSms') : tPh('verifyBtn')}
          </button>
        </form>
      </div>
    </div>
  );
}
