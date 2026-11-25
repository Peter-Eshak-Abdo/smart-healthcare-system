'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ClipboardCheck,
  FileText,
  Globe,
  LogOut,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Users,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useThemeMode } from '@/components/providers/AppProviders';
import { OfflineRibbon } from '@/components/common/OfflineRibbon';
import { signOutFirebaseBrowser } from '@/lib/firebase/client';
import { useRxBuilderStore } from '@/stores/rx-builder.store';

export type PortalKind = 'doctor' | 'pharmacy' | 'er' | 'admin';

export function AppShell({
  portal,
  userLabel,
  subtitle,
  children,
}: {
  portal: PortalKind;
  userLabel: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const locale = useLocale() as 'ar' | 'en';
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearDrafts = useRxBuilderStore((s) => s.clearAllDrafts);
  const { theme, setTheme } = useThemeMode();

  const tApp = useTranslations('app');
  const tCommon = useTranslations('nav.common');
  const tAuth = useTranslations('auth');
  const tDoc = useTranslations('doctor');
  const tNavDoc = useTranslations('nav.doctor');
  const tNavPh = useTranslations('nav.pharmacy');
  const tNavEr = useTranslations('nav.er');
  const tNavAdm = useTranslations('nav.admin');
  const tErr = useTranslations('errors');

  const timeoutMs = portal === 'admin' ? 10 * 60_000 : 15 * 60_000;
  const warnBeforeMs = 60_000;
  const [warnSeconds, setWarnSeconds] = useState<number | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(() => Date.now());

  const handleLogout = useCallback(async () => {
    await signOutFirebaseBrowser();
    queryClient.clear();
    clearDrafts();
    router.push((locale === 'ar' ? '/login' : '/en/login') as never);
  }, [clearDrafts, locale, queryClient, router]);

  useEffect(() => {
    if (portal === 'er') return;
    const bump = () => {
      setLastActivity(Date.now());
      setWarnSeconds(null);
    };
    const events = ['pointerdown', 'keydown'] as const;
    for (const ev of events) {
      window.addEventListener(ev, bump, { passive: true });
    }
    const timer = window.setInterval(() => {
      const remaining = timeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) {
        void handleLogout();
      } else if (remaining <= warnBeforeMs) {
        setWarnSeconds(Math.ceil(remaining / 1000));
      }
    }, 1000);
    return () => {
      for (const ev of events) window.removeEventListener(ev, bump);
      window.clearInterval(timer);
    };
  }, [handleLogout, lastActivity, portal, timeoutMs]);

  const toggleLocale = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    const stripped = pathname.replace(/^\/(ar|en)/, '') || '/';
    const target = nextLocale === 'ar' ? stripped : `/en${stripped === '/' ? '' : stripped}`;
    router.push(target as never);
  };

  const prefix = locale === 'ar' ? '' : '/en';
  const navItems: Array<{ href: string; label: string; icon: ReactNode }> =
    portal === 'doctor'
      ? [
          { href: `${prefix}/doctor`, label: tNavDoc('dashboard'), icon: <Activity className="h-4 w-4" /> },
          { href: `${prefix}/doctor/patients`, label: tNavDoc('patients'), icon: <Users className="h-4 w-4" /> },
          { href: `${prefix}/doctor/access/redeem`, label: tNavDoc('redeem'), icon: <ShieldCheck className="h-4 w-4" /> },
          { href: `${prefix}/doctor/prescriptions`, label: tNavDoc('prescriptions'), icon: <FileText className="h-4 w-4" /> },
        ]
      : portal === 'pharmacy'
        ? [
            { href: `${prefix}/pharmacy`, label: tNavPh('verify'), icon: <ClipboardCheck className="h-4 w-4" /> },
            { href: `${prefix}/pharmacy/history`, label: tNavPh('history'), icon: <FileText className="h-4 w-4" /> },
          ]
        : portal === 'er'
          ? [{ href: `${prefix}/er`, label: tNavEr('console'), icon: <ShieldAlert className="h-4 w-4" /> }]
          : [
              { href: `${prefix}/admin`, label: tNavAdm('overview'), icon: <Activity className="h-4 w-4" /> },
              { href: `${prefix}/admin/users`, label: tNavAdm('users'), icon: <Users className="h-4 w-4" /> },
              { href: `${prefix}/admin/facilities`, label: tNavAdm('facilities'), icon: <Building2 className="h-4 w-4" /> },
              { href: `${prefix}/admin/audit`, label: tNavAdm('audit'), icon: <FileText className="h-4 w-4" /> },
              { href: `${prefix}/admin/emergency-review`, label: tNavAdm('emergencyReview'), icon: <ShieldAlert className="h-4 w-4" /> },
              { href: `${prefix}/admin/security-flags`, label: tNavAdm('securityFlags'), icon: <ShieldCheck className="h-4 w-4" /> },
            ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <OfflineRibbon message={tErr('OFFLINE')} />
      <div className="flex flex-1">
        <aside className="no-print hidden md:flex w-64 shrink-0 flex-col border-e border-border bg-card p-4">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
              SH
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{tApp('name')}</p>
              <p className="truncate text-xs text-muted-foreground">{subtitle ?? portal.toUpperCase()}</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1" aria-label={portal}>
            {navItems.map((item) => {
              const active = pathname === item.href || pathname === `${item.href}/`;
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-border pt-4">
            <p className="truncate px-2 text-xs font-medium text-foreground">{userLabel}</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-medium text-destructive hover:bg-danger-surface"
            >
              <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              <span>{tCommon('logout')}</span>
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground md:hidden">{tApp('name')}</span>
              <span className="hidden text-sm text-muted-foreground md:inline">
                {portal === 'doctor' ? tDoc('welcome') : subtitle ?? tApp('tagline')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-border bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-label={tCommon('themeLight')}
                  className={`rounded-lg p-1.5 text-xs ${theme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Sun className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-label={tCommon('themeDark')}
                  className={`rounded-lg p-1.5 text-xs ${theme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Moon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('emergency')}
                  aria-label={tCommon('themeEmergency')}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${theme === 'emergency' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground'}`}
                >
                  ER
                </button>
              </div>

              <button
                type="button"
                onClick={toggleLocale}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{tCommon('language')}</span>
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>

      {warnSeconds !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">{tAuth('sessionExpiringTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tAuth('sessionExpiringBody', { seconds: warnSeconds })}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
              >
                {tCommon('logout')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLastActivity(Date.now());
                  setWarnSeconds(null);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {tAuth('staySignedIn')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
