'use client';

import type {
  AcquireLeaseResponseSchema,
  DispenseResponseSchema,
  PharmacyGetPrescriptionResponseSchema,
  RefDrugDtoSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Lock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { RxSeal } from '@/components/three/RxSeal';
import { apiFetch } from '@/lib/api/client';
import { isApiErrorCode } from '@/lib/api/errors';
import { formatCairoDateTime } from '@/lib/format/date';

type PharmacyRxDetail = z.infer<typeof PharmacyGetPrescriptionResponseSchema>;
type LeaseRes = z.infer<typeof AcquireLeaseResponseSchema>;
type DispenseRes = z.infer<typeof DispenseResponseSchema>;
type RefDrug = z.infer<typeof RefDrugDtoSchema>;

export default function PharmacyDispenseDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const queryClient = useQueryClient();
  const tPh = useTranslations('pharmacy');

  const verificationId = searchParams.get('vid') ?? '';
  const validUntil = searchParams.get('until');
  const initialResult = searchParams.get('result') ?? 'valid';

  const [online, setOnline] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(900);
  const [leaseHeldConflict, setLeaseHeldConflict] = useState(false);
  const [leaseExpiresAt, setLeaseExpiresAt] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  const [subQuery, setSubQuery] = useState<Record<string, string>>({});
  const [subOptions, setSubOptions] = useState<Record<string, RefDrug[]>>({});
  const [counselling, setCounselling] = useState(false);
  const [dispenseResult, setDispenseResult] = useState<DispenseRes | null>(null);
  const [error, setError] = useState<unknown>(null);

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

  useEffect(() => {
    if (!validUntil) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(validUntil).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [validUntil]);

  const detailQuery = useQuery({
    queryKey: ['pharmacy-rx', params.id, verificationId],
    enabled: Boolean(verificationId),
    queryFn: () =>
      apiFetch<PharmacyRxDetail>(
        `/v1/pharmacy/prescriptions/${params.id}?verification_id=${encodeURIComponent(verificationId)}`,
        { locale },
      ),
  });

  useEffect(() => {
    const items = detailQuery.data?.prescription.items;
    if (!items) return;
    setQuantities((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const initial: Record<string, number> = {};
      for (const item of items) {
        initial[item.id] = item.quantity_remaining;
      }
      return initial;
    });
  }, [detailQuery.data]);

  const leaseMutation = useMutation({
    mutationFn: (force: boolean) =>
      apiFetch<LeaseRes>(`/v1/pharmacy/prescriptions/${params.id}/lease`, {
        method: 'POST',
        locale,
        body: { verification_id: verificationId, force },
      }),
    onSuccess: (res) => {
      setError(null);
      setLeaseHeldConflict(false);
      setLeaseExpiresAt(res.expires_at);
    },
    onError: (err) => {
      if (isApiErrorCode(err, 'RX_DISPENSE_LEASE_HELD')) {
        setLeaseHeldConflict(true);
      }
      setError(err);
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: () => {
      const rx = detailQuery.data?.prescription;
      if (!rx) throw new Error('Prescription not loaded');
      const itemsToDispense = rx.items
        .map((item) => ({
          prescription_item_id: item.id,
          quantity: Number(quantities[item.id] ?? 0),
          substituted_drug_id: substitutions[item.id] || null,
        }))
        .filter((i) => i.quantity > 0);

      return apiFetch<DispenseRes>(`/v1/pharmacy/prescriptions/${params.id}/dispensations`, {
        method: 'POST',
        locale,
        idempotencyKey: crypto.randomUUID(),
        body: {
          verification_id: verificationId,
          expected_version: rx.version,
          items: itemsToDispense,
          counselling_given: counselling,
        },
      });
    },
    onSuccess: (res) => {
      setError(null);
      setDispenseResult(res);
      void queryClient.invalidateQueries({ queryKey: ['pharmacy-rx', params.id, verificationId] });
    },
    onError: (err) => setError(err),
  });

  const searchGenericAlternatives = async (itemId: string, genericName: string) => {
    const res = await apiFetch<{ data: RefDrug[] }>(
      `/v1/ref/drugs?q=${encodeURIComponent(genericName)}`,
      { locale },
    );
    setSubOptions((prev) => ({ ...prev, [itemId]: res.data }));
  };

  if (!verificationId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'Verify a pickup token or paper code first.'
            : 'ابدأ بالتحقق من كود الروشتة الأول.'}
        </p>
        <Link
          href={`${prefix}/pharmacy` as never}
          className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {tPh('verifyTitle')}
        </Link>
      </div>
    );
  }

  const data = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <RxSeal
            status={
              initialResult === 'valid'
                ? 'valid'
                : initialResult === 'expired'
                  ? 'expired'
                  : 'invalid'
            }
          />
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {data ? <bdi>{data.prescription.rx_number}</bdi> : '…'}
            </h1>
            {data && (
              <p className="text-sm text-muted-foreground">
                {data.patient_for_pharmacy.full_name} · {data.patient_for_pharmacy.age} ·{' '}
                {data.patient_for_pharmacy.sex}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold">
          <Clock className="h-4 w-4 text-primary" />
          <span className="clinical-num">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {!online && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-sm font-semibold text-amber-900 dark:text-amber-200">
          {tPh('offlineBanner')}
        </div>
      )}

      {initialResult !== 'valid' && (
        <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4 text-sm font-bold text-destructive">
          {initialResult === 'already_dispensed' && tPh('alreadyDispensed')}
          {initialResult === 'expired' && tPh('expired')}
          {initialResult === 'cancelled' && tPh('cancelled')}
          {initialResult === 'prescriber_invalid' && tPh('prescriberInvalid')}
        </div>
      )}

      {leaseHeldConflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            <span>{tPh('leaseHeld')}</span>
          </div>
          <button
            type="button"
            onClick={() => leaseMutation.mutate(true)}
            className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            {tPh('proceedAnyway')}
          </button>
        </div>
      )}

      {error !== null && !leaseHeldConflict && <ProblemAlert error={error} />}

      {dispenseResult && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
          <span>
            {isEn ? 'Dispensed successfully' : 'تم الصرف بنجاح'} · {dispenseResult.prescription_status} (
            {formatCairoDateTime(dispenseResult.dispensed_at, locale)})
          </span>
        </div>
      )}

      {data && (
        <>
          {data.patient_for_pharmacy.allergies.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                <ShieldAlert className="h-4 w-4" />
                <span>{isEn ? 'Patient Allergies' : 'حساسية مسجلة عند المريض'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.patient_for_pharmacy.allergies.map((a, idx) => (
                  <span
                    key={`${a.name}-${idx}`}
                    className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-destructive"
                  >
                    {a.name} ({a.severity})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Lock className="h-4 w-4 text-primary" />
              <span>
                {leaseExpiresAt
                  ? `${isEn ? 'Prepare lock active until' : 'حجز التحضير نشط حتى'} ${formatCairoDateTime(leaseExpiresAt, locale)}`
                  : isEn
                    ? 'Acquire dispense prepare lock before counting stock.'
                    : 'احجز الروشتة للتحضير قبل الصرف.'}
              </span>
            </div>
            <button
              type="button"
              disabled={!online || leaseMutation.isPending}
              onClick={() => leaseMutation.mutate(false)}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-accent disabled:opacity-50"
            >
              {isEn ? 'Acquire Prepare Lease' : 'حجز للتحضير'}
            </button>
          </div>

          <section className="space-y-3">
            {data.prescription.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-foreground">
                      <bdi>{item.drug.brand_name}</bdi> ({item.drug.strength})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <bdi>{item.drug.generic_name}</bdi> · {item.dose} · {item.frequency} ·{' '}
                      {item.duration_days} {isEn ? 'days' : 'يوم'}
                    </p>
                    {item.instructions && (
                      <p className="mt-1 text-xs text-primary">{item.instructions}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-end text-xs">
                      <p className="text-muted-foreground">{tPh('remaining')}</p>
                      <p className="clinical-num font-mono font-bold">
                        {item.quantity_remaining} {item.quantity_unit}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground">
                        {tPh('dispenseNow')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={item.quantity_remaining}
                        disabled={item.quantity_remaining <= 0}
                        value={quantities[item.id] ?? 0}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [item.id]: Math.min(
                              item.quantity_remaining,
                              Math.max(0, Number(e.target.value)),
                            ),
                          }))
                        }
                        className="clinical-num w-24 rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm font-bold"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {item.substitution_allowed && !item.drug.is_controlled && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={subQuery[item.id] ?? ''}
                        onChange={(e) =>
                          setSubQuery((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder={isEn ? 'Substitute generic...' : 'بديل بنفس المادة الفعالة...'}
                        className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void searchGenericAlternatives(
                            item.id,
                            subQuery[item.id]?.trim() || item.drug.generic_name,
                          )
                        }
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
                      >
                        {isEn ? 'Find Equivalent' : 'ابحث عن بديل'}
                      </button>
                      {(subOptions[item.id] ?? []).length > 0 && (
                        <select
                          value={substitutions[item.id] ?? ''}
                          onChange={(e) =>
                            setSubstitutions((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="">{isEn ? 'Original prescribed drug' : 'الدواء الأصلي'}</option>
                          {(subOptions[item.id] ?? []).map((alt) => (
                            <option key={alt.id} value={alt.id}>
                              {alt.brand_name} ({alt.strength})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>

          <div className="rounded-2xl border border-border bg-card p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={counselling}
                onChange={(e) => setCounselling(e.target.checked)}
              />
              <span>{tPh('counselling')}</span>
            </label>

            <button
              type="button"
              disabled={
                !online ||
                initialResult !== 'valid' ||
                dispenseMutation.isPending ||
                secondsLeft <= 0
              }
              onClick={() => dispenseMutation.mutate()}
              className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {tPh('dispenseSubmit')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
