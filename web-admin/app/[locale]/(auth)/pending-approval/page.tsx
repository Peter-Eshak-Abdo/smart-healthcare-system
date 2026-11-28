'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export default function PendingApprovalPage() {
  const locale = useLocale() as 'ar' | 'en';
  const prefix = locale === 'ar' ? '' : `/${locale}`;
  const tAuth = useTranslations('auth');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-foreground">
          {tAuth('pendingApprovalTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tAuth('pendingApprovalSubtitle')}
        </p>
        <Link
          href={`${prefix}/login` as never}
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          {tAuth('backToLogin')}
        </Link>
      </div>
    </main>
  );
}
