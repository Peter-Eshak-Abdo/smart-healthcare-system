'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { OverrideDraft } from '@/stores/rx-builder.store';

const REASON_CODES = [
  'benefit_outweighs_risk',
  'allergy_disputed',
  'desensitisation_protocol',
  'monitored_setting',
  'other',
] as const;

export function OverrideDialog({
  alertKey,
  initial,
  onSave,
  onClose,
}: {
  alertKey: string;
  initial?: OverrideDraft;
  onSave: (draft: OverrideDraft) => void;
  onClose: () => void;
}) {
  const tRx = useTranslations('rx');
  const tCommon = useTranslations('nav.common');

  const [reasonCode, setReasonCode] = useState<OverrideDraft['reason_code']>(
    initial?.reason_code ?? 'benefit_outweighs_risk',
  );
  const [justification, setJustification] = useState(initial?.justification ?? '');
  const [acknowledged, setAcknowledged] = useState(false);

  const trimmed = justification.trim();
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const isValid = trimmed.length >= 15 && wordCount >= 3 && acknowledged;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 id="override-title" className="text-lg font-bold text-foreground">
          {tRx('overrideDialogTitle')}
        </h2>
        <p className="clinical-num mt-1 font-mono text-xs text-muted-foreground">
          <bdi>{alertKey}</bdi>
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold text-foreground">{tRx('overrideReason')}</legend>
          {REASON_CODES.map((rc) => (
            <label key={rc} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="reason_code"
                value={rc}
                checked={reasonCode === rc}
                onChange={() => setReasonCode(rc)}
                className="accent-primary"
              />
              <span>{tRx(`overrideReasons.${rc}`)}</span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4">
          <label htmlFor="override-justification" className="block text-xs font-semibold text-foreground">
            {tRx('overrideJustification')}
          </label>
          <textarea
            id="override-justification"
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="clinical-num mt-1 text-xs text-muted-foreground">
            {trimmed.length}/15 chars · {wordCount}/3 words
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>{tRx('overrideAck')}</span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => {
              onSave({ alert_key: alertKey, reason_code: reasonCode, justification: trimmed });
              onClose();
            }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
