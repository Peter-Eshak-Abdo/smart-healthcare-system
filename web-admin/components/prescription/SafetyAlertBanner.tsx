'use client';

import type { SafetyAlertDtoSchema } from '@smarthealth/contracts';
import { AlertCircle, CheckCircle2, Info, OctagonX, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { z } from 'zod';

type SafetyAlertDto = z.infer<typeof SafetyAlertDtoSchema>;

export function SafetyAlertBanner({
  alert,
  overridden,
  onOverride,
}: {
  alert: SafetyAlertDto;
  overridden: boolean;
  onOverride: () => void;
}) {
  const locale = useLocale() as 'ar' | 'en';
  const tRx = useTranslations('rx');
  const blocking = alert.requires_override;
  const isContra = alert.severity === 'contraindicated';
  const isMajor = alert.severity === 'major';

  const containerCls = isContra
    ? 'border-s-4 border-destructive bg-danger-surface'
    : isMajor
      ? 'border-s-4 border-warning bg-warning-surface'
      : 'border-s-4 border-border bg-muted';

  return (
    <div
      role={blocking ? 'alert' : 'status'}
      className={`rounded-xl p-3.5 text-sm text-foreground ${containerCls}`}
    >
      <div className="flex items-start gap-2.5">
        {isContra ? (
          <OctagonX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        ) : isMajor ? (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">
            {locale === 'ar' ? alert.title.ar : alert.title.en}
          </p>
          <p className="mt-1 text-xs text-foreground/90">
            {locale === 'ar' ? alert.message.ar : alert.message.en}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === 'ar' ? alert.management.ar : alert.management.en}
          </p>

          {alert.involves_current_medication ? (
            <p className="mt-1 text-xs font-medium text-warning">
              {alert.involves_current_medication.from_restricted_record ? (
                tRx('restrictedMedNote')
              ) : (
                <bdi>{alert.involves_current_medication.display}</bdi>
              )}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              <bdi>{alert.source}</bdi>
            </span>

            {alert.previously_reviewed ? (
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                {alert.previously_reviewed.by}
              </span>
            ) : null}

            {blocking ? (
              overridden ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2.5 py-0.5 font-semibold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {tRx('overriddenBadge')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOverride}
                  className="rounded-lg bg-destructive px-3 py-1 font-semibold text-destructive-foreground hover:opacity-90"
                >
                  {tRx('overrideBtn')}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
