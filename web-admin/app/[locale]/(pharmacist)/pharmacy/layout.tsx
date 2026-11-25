import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { requireRole } from '@/lib/auth/require-role';

export default async function PharmacyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === 'en' ? 'en' : 'ar';
  const me = await requireRole('pharmacist', loc);
  const tPh = await getTranslations('pharmacy');

  const subtitle = me.practitioner?.facilities[0]?.name ?? tPh('selectFacility');

  return (
    <AppShell portal="pharmacy" userLabel={me.full_name} subtitle={subtitle}>
      {children}
    </AppShell>
  );
}
