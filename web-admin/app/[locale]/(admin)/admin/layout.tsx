import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { requireRole } from '@/lib/auth/require-role';

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === 'en' ? 'en' : 'ar';
  const me = await requireRole('admin', loc);
  const tAdm = await getTranslations('admin');

  return (
    <AppShell portal="admin" userLabel={me.full_name} subtitle={tAdm('title')}>
      {children}
    </AppShell>
  );
}
