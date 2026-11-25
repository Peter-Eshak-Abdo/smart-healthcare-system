import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { requireRole } from '@/lib/auth/require-role';

export default async function DoctorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === 'en' ? 'en' : 'ar';
  const me = await requireRole('doctor', loc);
  const tDoc = await getTranslations('doctor');
  const subtitle = me.practitioner?.specialty
    ? loc === 'ar'
      ? me.practitioner.specialty.name.ar
      : me.practitioner.specialty.name.en
    : tDoc('welcome');

  return (
    <AppShell portal="doctor" userLabel={me.full_name} subtitle={subtitle}>
      {children}
    </AppShell>
  );
}
