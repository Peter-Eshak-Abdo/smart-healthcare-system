import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { requireRole } from '@/lib/auth/require-role';

export default async function ErLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === 'en' ? 'en' : 'ar';
  const me = await requireRole(['paramedic', 'doctor'], loc);
  const tEr = await getTranslations('er');

  return (
    <AppShell portal="er" userLabel={me.full_name} subtitle={tEr('title')}>
      {children}
    </AppShell>
  );
}
