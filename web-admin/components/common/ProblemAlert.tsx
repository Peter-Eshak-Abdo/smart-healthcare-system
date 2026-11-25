'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiRequestError } from '@/lib/api/errors';

export function ProblemAlert({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const tErr = useTranslations('errors');
  const tCommon = useTranslations('nav.common');

  const code = error instanceof ApiRequestError ? error.code : 'GENERIC';
  const reqId = error instanceof ApiRequestError ? error.problem.request_id : undefined;

  let msg = tErr('GENERIC');
  try {
    msg = tErr(code as never);
  } catch {
    msg = tErr('GENERIC');
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-danger-surface p-4 text-sm text-foreground"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">{msg}</p>
          {reqId ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Ref: <bdi className="clinical-num font-mono">{reqId}</bdi>
            </p>
          ) : null}
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {tCommon('retry')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
