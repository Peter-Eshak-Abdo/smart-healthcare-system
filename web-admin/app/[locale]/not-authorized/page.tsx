import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShieldAlert } from 'lucide-react';

export default async function NotAuthorizedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { locale } = await params;
  const { reason } = await searchParams;
  const prefix = locale === 'en' ? '/en' : '';
  const tAuth = await getTranslations('auth');
  const tCommon = await getTranslations('nav.common');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">{tAuth('notAuthorizedTitle')}</h1>
        {reason === 'license' && (
          <p className="mt-2 text-sm text-muted-foreground">{tAuth('notAuthorizedLicense')}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`${prefix}/login` as never}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {tAuth('signIn')}
          </Link>
          <Link
            href={`${prefix || '/'}` as never}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            {tCommon('back')}
          </Link>
        </div>
      </div>
    </main>
  );
}
