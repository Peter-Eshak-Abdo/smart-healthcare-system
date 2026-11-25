import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Activity, Building2, ClipboardList, ShieldCheck, Stethoscope, Pill } from 'lucide-react';
import { MedicalIdCard3D } from '@/components/three/MedicalIdCard3D';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';
  const tApp = await getTranslations('app');
  const tNavDoc = await getTranslations('nav.doctor');
  const tNavPh = await getTranslations('nav.pharmacy');
  const tNavEr = await getTranslations('nav.er');
  const tNavAdm = await getTranslations('nav.admin');
  const tAuth = await getTranslations('auth');

  const portals = [
    {
      href: `${prefix}/doctor`,
      title: isEn ? 'Doctor Clinical Portal' : 'بوابة الدكتور والعيادات',
      badge: tNavDoc('dashboard'),
      description: isEn
        ? 'Redeem patient share codes, document encounters, check live drug safety, and sign Ed25519 e-prescriptions.'
        : 'افتح ملفات المرضى بكود المشاركة، وثّق الكشف، افحص التفاعلات الدوائية، ووقّع الروشتات إلكترونياً.',
      icon: Stethoscope,
    },
    {
      href: `${prefix}/pharmacy`,
      title: isEn ? 'Pharmacist Dispensing Desk' : 'بوابة الصيدلي وصرف الدواء',
      badge: tNavPh('verify'),
      description: isEn
        ? 'Verify SH1. signatures, acquire dispense leases, record full/partial dispensing, and substitute equivalents.'
        : 'تحقق من توقيع الروشتة الإلكتروني، احجز الصرف، وسجّل الصرف الكلي أو الجزئي بأمان.',
      icon: Pill,
    },
    {
      href: `${prefix}/er`,
      title: isEn ? 'Emergency Room Console' : 'وحدة الطوارئ (High Contrast)',
      badge: tNavEr('console'),
      description: isEn
        ? 'Break-glass emergency identification via Face AI, SHEC1. QR card, or National ID with closed profile scope.'
        : 'دخول طوارئ سريع بالوجه أو كارت الطوارئ أو الرقم القومي لعرض الملف الحرج فقط.',
      icon: Activity,
    },
    {
      href: `${prefix}/admin`,
      title: isEn ? 'Zero-PHI Governance & Audit' : 'لوحة الإدارة وسجل الرقابة',
      badge: tNavAdm('overview'),
      description: isEn
        ? 'Manage staff licences, two-person role approvals, facilities, SHA-256 audit chain integrity, and ER review.'
        : 'إدارة تراخيص الطاقم الطبي، اعتماد الصلاحيات، المنشآت، وفحص سلامة سجل التدقيق.',
      icon: Building2,
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between gap-10 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tApp('name')}</h1>
            <p className="text-sm text-muted-foreground">{tApp('tagline')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={(isEn ? '/' : '/en') as never}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {isEn ? 'العربية' : 'English'}
          </Link>
          <Link
            href={`${prefix}/login` as never}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"
          >
            {tAuth('signIn')}
          </Link>
        </div>
      </header>

      <section className="grid items-center gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary">
            <ClipboardList className="h-3.5 w-3.5" />
            {isEn ? 'Zero-Trust Clinical Platform · AAL2 Enforced' : 'منصة طبية مؤمّنة · تحقق ثنائي إلزامي'}
          </span>
          <h2 className="text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
            {isEn
              ? 'Unified National Health Record, Cryptographic E-Prescriptions & Break-Glass ER'
              : 'سجل طبي موحّد، روشتات موقّعة رقمياً، ودخول طوارئ ذكي'}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {isEn
              ? 'Every clinical action requires MFA verification, verified medical licensure, and immutable SHA-256 audit logging.'
              : 'كل إجراء طبي يخضع للتحقق بخطوتين، سريان الترخيص المهني، والتوثيق الفوري في سجل التدقيق غير القابل للتعديل.'}
          </p>
        </div>
        <div className="lg:col-span-5">
          <MedicalIdCard3D
            fullName={isEn ? 'SmartHealth Clinical ID' : 'هوية سمارت هيلث'}
            mrn="SH-EG-000102"
            bloodType="O+"
            allergies={[isEn ? 'Verified Emergency Card' : 'بطاقة طوارئ موثّقة']}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {portals.map((portal) => {
          const Icon = portal.icon;
          return (
            <Link
              key={portal.href}
              href={portal.href as never}
              className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {portal.badge}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground group-hover:text-primary">
                {portal.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {portal.description}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
