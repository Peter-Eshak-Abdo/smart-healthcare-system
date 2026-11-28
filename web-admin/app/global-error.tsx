'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold">حدث خطأ غير متوقع / Unexpected Error</h1>
          <p className="mb-6 text-sm text-slate-600">
            {error.digest ? `Reference: ${error.digest}` : 'يرجى المحاولة مرة أخرى.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            إعادة المحاولة / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
