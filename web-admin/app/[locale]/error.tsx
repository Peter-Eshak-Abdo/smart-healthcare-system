'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';

  useEffect(() => {
    // Log only non-PHI error metadata
    console.error('[LocaleError]', { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          {isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          {isAr
            ? 'تعذر تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.'
            : 'Unable to load this page. Please try again.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          {isAr ? 'إعادة المحاولة' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
