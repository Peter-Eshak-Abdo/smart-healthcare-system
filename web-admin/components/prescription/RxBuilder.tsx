'use client';

import type {
  CheckPrescriptionsResponseSchema,
  PrescriptionDetailSchema,
  RefDrugsResponseSchema,
} from '@smarthealth/contracts';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileSignature, Lock, Printer, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { OverrideDialog } from '@/components/prescription/OverrideDialog';
import { SafetyAlertBanner } from '@/components/prescription/SafetyAlertBanner';
import { apiFetch } from '@/lib/api/client';
import { isApiErrorCode } from '@/lib/api/errors';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useRxBuilderStore, type DraftRxItem } from '@/stores/rx-builder.store';

type RefDrugDto = z.infer<typeof RefDrugsResponseSchema>['data'][number];
type SafetyResponse = z.infer<typeof CheckPrescriptionsResponseSchema>;
type PrescriptionDetail = z.infer<typeof PrescriptionDetailSchema>;

const FREQUENCIES: Array<DraftRxItem['frequency']> = [
  'once_daily',
  'twice_daily',
  'three_times_daily',
  'four_times_daily',
  'every_x_hours',
  'at_bedtime',
  'as_needed',
  'once',
  'weekly',
];

export function RxBuilder({
  patientId,
  encounterId,
}: {
  patientId: string;
  encounterId: string;
}) {
  const locale = useLocale() as 'ar' | 'en';
  const tRx = useTranslations('rx');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('nav.common');

  const draft = useRxBuilderStore((s) => s.getDraft(patientId));
  const addItem = useRxBuilderStore((s) => s.addItem);
  const updateItem = useRxBuilderStore((s) => s.updateItem);
  const removeItem = useRxBuilderStore((s) => s.removeItem);
  const setOverride = useRxBuilderStore((s) => s.setOverride);
  const pruneOverrides = useRxBuilderStore((s) => s.pruneOverrides);
  const setManualAttested = useRxBuilderStore((s) => s.setManualAttested);
  const setNotes = useRxBuilderStore((s) => s.setNotes);
  const resetDraft = useRxBuilderStore((s) => s.resetDraft);

  const [drugQuery, setDrugQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [overrideTargetKey, setOverrideTargetKey] = useState<string | null>(null);
  const [issuedRx, setIssuedRx] = useState<PrescriptionDetail | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthCode, setReauthCode] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(drugQuery.trim()), 250);
    return () => window.clearTimeout(id);
  }, [drugQuery]);

  const drugSearch = useQuery({
    queryKey: ['ref-drugs', debouncedQuery],
    queryFn: ({ signal }) =>
      apiFetch<z.infer<typeof RefDrugsResponseSchema>>(
        `/v1/ref/drugs?query=${encodeURIComponent(debouncedQuery)}&limit=10`,
        { signal, locale },
      ),
    enabled: debouncedQuery.length >= 2,
  });

  const drugKey = useMemo(
    () => draft.items.map((i) => i.drug_id).sort().join(','),
    [draft.items],
  );

  const safetyQuery = useQuery({
    queryKey: ['rx-check', patientId, drugKey],
    queryFn: ({ signal }) =>
      apiFetch<SafetyResponse>('/v1/prescriptions/check', {
        method: 'POST',
        body: {
          patient_id: patientId,
          items: draft.items.map((i) => ({ client_key: i.client_key, drug_id: i.drug_id })),
        },
        signal,
        locale,
      }),
    enabled: drugKey.length > 0,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!safetyQuery.data) return;
    const keys = new Set(safetyQuery.data.alerts.map((a) => a.alert_key));
    pruneOverrides(patientId, keys);
  }, [patientId, pruneOverrides, safetyQuery.data]);

  const issueMutation = useMutation({
    mutationFn: () =>
      apiFetch<PrescriptionDetail>('/v1/prescriptions', {
        method: 'POST',
        idempotencyKey: draft.idempotencyKey,
        locale,
        body: {
          patient_id: patientId,
          encounter_id: encounterId,
          items: draft.items.map((i) => ({
            client_key: i.client_key,
            drug_id: i.drug_id,
            dose: i.dose,
            route: i.route,
            frequency: i.frequency,
            frequency_interval_hours: i.frequency === 'every_x_hours' ? i.frequency_interval_hours ?? 8 : null,
            duration_days: i.duration_days,
            quantity: i.quantity,
            quantity_unit: i.base_unit,
            instructions: i.instructions || undefined,
            substitution_allowed: i.is_controlled ? false : i.substitution_allowed,
          })),
          overrides: Object.values(draft.overrides),
          manual_review_attested: draft.manualReviewAttested,
          notes_to_pharmacist: draft.notesToPharmacist.trim() || undefined,
        },
      }),
    onSuccess: (rx) => {
      setIssuedRx(rx);
      resetDraft(patientId);
    },
    onError: (err) => {
      if (isApiErrorCode(err, 'AUTH_STEP_UP_REQUIRED')) {
        setReauthOpen(true);
      }
    },
  });

  const handleSelectDrug = (drug: RefDrugDto) => {
    addItem(patientId, {
      client_key: `i-${crypto.randomUUID().slice(0, 8)}`,
      drug_id: drug.id,
      brand_name: drug.brand_name,
      generic_name: drug.generic_name,
      strength: drug.strength,
      dosage_form: drug.dosage_form,
      is_controlled: drug.is_controlled,
      base_unit: drug.base_unit,
      dose: `1 ${drug.base_unit}`,
      route: drug.route,
      frequency: 'twice_daily',
      frequency_interval_hours: null,
      duration_days: 7,
      quantity: 14,
      instructions: '',
      substitution_allowed: !drug.is_controlled,
    });
    setDrugQuery('');
    setDebouncedQuery('');
  };

  const alerts = safetyQuery.data?.alerts ?? [];
  const blockingMissingCount = alerts.filter(
    (a) => a.requires_override && !draft.overrides[a.alert_key],
  ).length;
  const isUnavailable = safetyQuery.data?.checks_status === 'unavailable';
  const canIssue =
    draft.items.length > 0 &&
    !safetyQuery.isFetching &&
    !issueMutation.isPending &&
    blockingMissingCount === 0 &&
    (!isUnavailable || draft.manualReviewAttested);

  const handleReauthSubmit = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const factors = await supabase.auth.mfa.listFactors();
    const totp = factors.data?.totp?.[0];
    if (!totp) return;
    const chal = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (chal.error || !chal.data) return;
    const ver = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: chal.data.id,
      code: reauthCode.trim(),
    });
    if (!ver.error) {
      setReauthOpen(false);
      setReauthCode('');
      issueMutation.mutate();
    }
  };

  if (issuedRx) {
    const prefix = locale === 'ar' ? '' : '/en';
    return (
      <div className="rounded-2xl border border-success/50 bg-success-surface p-6">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          <h2 className="text-xl font-bold text-foreground">{tRx('issuedSuccess')}</h2>
        </div>

        <p className="clinical-num mt-2 font-mono text-lg font-bold text-foreground">
          <bdi>{issuedRx.rx_number}</bdi>
        </p>

        {issuedRx.verification_code_hint ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">{tRx('paperCodeLabel')}</p>
            <p className="clinical-num mt-1 font-mono text-2xl font-extrabold tracking-widest text-primary">
              <bdi>{issuedRx.verification_code_hint}</bdi>
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`${prefix}/print/prescriptions/${issuedRx.id}` as never}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>{tRx('printSummary')}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">{tRx('builderTitle')}</h2>

          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute top-3 start-3 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={drugQuery}
              onChange={(e) => setDrugQuery(e.target.value)}
              placeholder={tRx('searchDrug')}
              className="w-full rounded-xl border border-input bg-background py-2.5 ps-10 pe-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {debouncedQuery.length >= 2 && drugSearch.data?.data.length ? (
              <ul className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                {drugSearch.data.data.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectDrug(d)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm hover:bg-muted"
                    >
                      <span>
                        <bdi className="font-semibold text-foreground">{d.brand_name}</bdi>{' '}
                        <bdi className="clinical-num text-xs text-muted-foreground">
                          ({d.generic_name} {d.strength} · {d.dosage_form})
                        </bdi>
                      </span>
                      {d.is_controlled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-surface px-2 py-0.5 text-xs font-semibold text-warning">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          {tRx('controlledBadge')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {draft.items.map((item) => {
          const itemAlerts = alerts.filter((a) => a.item_keys.includes(item.client_key));
          const hasContra = itemAlerts.some((a) => a.severity === 'contraindicated');
          const hasMajor = itemAlerts.some((a) => a.severity === 'major');
          const borderCls = hasContra
            ? 'border-s-4 border-destructive'
            : hasMajor
              ? 'border-s-4 border-warning'
              : 'border-border';

          return (
            <div
              key={item.client_key}
              className={`rounded-2xl border bg-card p-4 ${borderCls}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-foreground">
                    <bdi>{item.brand_name}</bdi>{' '}
                    <span className="clinical-num text-xs font-normal text-muted-foreground">
                      <bdi>
                        {item.generic_name} {item.strength}
                      </bdi>
                    </span>
                  </h3>
                  {item.is_controlled ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-surface px-2 py-0.5 text-xs font-semibold text-warning">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      {tRx('controlledBadge')}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(patientId, item.client_key)}
                  aria-label="Remove item"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-danger-surface hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{tRx('dose')}</label>
                  <input
                    type="text"
                    value={item.dose}
                    onChange={(e) => updateItem(patientId, item.client_key, { dose: e.target.value })}
                    className="clinical-num mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{tRx('frequency')}</label>
                  <select
                    value={item.frequency}
                    onChange={(e) =>
                      updateItem(patientId, item.client_key, {
                        frequency: e.target.value as DraftRxItem['frequency'],
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {tRx('durationDays')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={item.duration_days}
                    onChange={(e) =>
                      updateItem(patientId, item.client_key, {
                        duration_days: Number.parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="clinical-num mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {tRx('quantity')} ({item.base_unit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(patientId, item.client_key, {
                        quantity: Number.parseFloat(e.target.value) || 1,
                      })
                    }
                    className="clinical-num mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  value={item.instructions}
                  placeholder={tRx('instructions')}
                  onChange={(e) =>
                    updateItem(patientId, item.client_key, { instructions: e.target.value })
                  }
                  className="flex-1 min-w-48 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={item.is_controlled}
                    checked={!item.is_controlled && item.substitution_allowed}
                    onChange={(e) =>
                      updateItem(patientId, item.client_key, {
                        substitution_allowed: e.target.checked,
                      })
                    }
                    className="accent-primary"
                  />
                  <span>{tRx('allowSub')}</span>
                </label>
              </div>
            </div>
          );
        })}

        {draft.items.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="block text-xs font-semibold text-muted-foreground">
              {tRx('notesToPharmacist')}
            </label>
            <textarea
              rows={2}
              value={draft.notesToPharmacist}
              onChange={(e) => setNotes(patientId, e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            />
          </div>
        ) : null}

        {issueMutation.error ? <ProblemAlert error={issueMutation.error} /> : null}

        <div className="sticky bottom-4 flex items-center justify-between rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
          <span className="clinical-num text-sm text-muted-foreground">
            {draft.items.length} item(s) · {blockingMissingCount} blocking alert(s)
          </span>
          <button
            type="button"
            disabled={!canIssue}
            onClick={() => issueMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            <span>{tRx('signAndIssue')}</span>
          </button>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="sticky top-24 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground">{tRx('safetyPanelTitle')}</h3>

          {safetyQuery.isFetching ? (
            <p className="mt-3 text-xs text-muted-foreground">{tRx('checking')}</p>
          ) : null}

          {isUnavailable ? (
            <div className="mt-3 rounded-xl border border-warning bg-warning-surface p-3 text-xs text-foreground">
              <p className="font-semibold">{tRx('unavailableBanner')}</p>
              <label className="mt-2 flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.manualReviewAttested}
                  onChange={(e) => setManualAttested(patientId, e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span>{tRx('manualAttest')}</span>
              </label>
            </div>
          ) : null}

          {!safetyQuery.isFetching && !isUnavailable && draft.items.length > 0 && alerts.length === 0 ? (
            <p className="mt-3 rounded-xl bg-success-surface p-3 text-xs font-medium text-success">
              {tRx('noAlerts')}
            </p>
          ) : null}

          <div className="mt-3 space-y-2.5">
            {alerts.map((alert) => (
              <SafetyAlertBanner
                key={alert.alert_key}
                alert={alert}
                overridden={Boolean(draft.overrides[alert.alert_key])}
                onOverride={() => setOverrideTargetKey(alert.alert_key)}
              />
            ))}
          </div>
        </div>
      </aside>

      {overrideTargetKey ? (
        <OverrideDialog
          alertKey={overrideTargetKey}
          {...(draft.overrides[overrideTargetKey]
            ? { initial: draft.overrides[overrideTargetKey] }
            : {})}
          onSave={(ov) => setOverride(patientId, ov)}
          onClose={() => setOverrideTargetKey(null)}
        />
      ) : null}

      {reauthOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-base font-bold text-foreground">{tAuth('reauthTitle')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{tAuth('reauthBody')}</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={reauthCode}
              onChange={(e) => setReauthCode(e.target.value)}
              className="clinical-num mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-center font-mono text-lg"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReauthOpen(false)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleReauthSubmit()}
                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {tAuth('mfaVerifyBtn')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
