import { getLocale } from 'next-intl/server';
import Link from 'next/link';

export default async function NotFoundPage() {
  const locale = await getLocale();
  const isAr = locale === 'ar';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="mb-1 text-3xl font-bold text-teal-600">404</p>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          {isAr ? 'الصفحة غير موجودة' : 'Page not found'}
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          {isAr
            ? 'الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.'
            : 'The page you are looking for does not exist or has been moved.'}
        </p>
        <Link
          href={`/${locale}`}
          className="inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          {isAr ? 'العودة للرئيسية' : 'Back to home'}
        </Link>
      </div>
    </div>
  );
}
