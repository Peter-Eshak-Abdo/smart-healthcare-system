'use client';

import type { PrescriptionDetailSchema } from '@smarthealth/contracts';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';
import { formatCairoDateTime } from '@/lib/format/date';

type PrescriptionDetail = z.infer<typeof PrescriptionDetailSchema>;

function BarcodeSvg({ value }: { value: string }) {
  // Deterministic monochrome Code-style bars suitable for monochrome A4 laser printing
  const bits: number[] = [1, 0, 1, 1, 0, 1];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    for (let b = 7; b >= 0; b -= 1) {
      bits.push((code >> b) & 1);
    }
    bits.push(0);
  }
  bits.push(1, 1, 0, 1, 0, 1);

  const width = Math.max(bits.length * 2, 120);
  return (
    <svg
      viewBox={`0 0 ${width} 44`}
      className="h-12 w-full max-w-xs"
      role="img"
      aria-label={value}
    >
      <rect x={0} y={0} width={width} height={44} className="fill-white" />
      {bits.map((bit, idx) =>
        bit === 1 ? (
          <rect key={idx} x={idx * 2} y={4} width={1.6} height={36} className="fill-black" />
        ) : null,
      )}
    </svg>
  );
}

export default function PrintPrescriptionPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const tRx = useTranslations('rx');
  const tApp = useTranslations('app');

  const paperCode = searchParams.get('code');

  const query = useQuery({
    queryKey: ['print-prescription', params.id],
    queryFn: () => apiFetch<PrescriptionDetail>(`/v1/prescriptions/${params.id}`, { locale }),
  });

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-center text-sm text-muted-foreground">
        {isEn ? 'Preparing printable prescription summary…' : 'جاري تجهيز ملخص الروشتة للطباعة…'}
      </main>
    );
  }

  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <ProblemAlert error={query.error} />
      </main>
    );
  }

  const rx = query.data;

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black print:p-4">
      <div className="mb-6 flex items-center justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">{tApp('name')} — {isEn ? 'E-Prescription Summary' : 'ملخص روشتة إلكترونية'}</h1>
          <p className="mt-1 text-xs">{rx.prescriber.facility}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-black px-3 py-1.5 text-xs font-bold print:hidden"
        >
          <Printer className="h-4 w-4" />
          <span>{tRx('printSummary')}</span>
        </button>
      </div>

      <section className="grid grid-cols-2 gap-4 border-b border-black/30 pb-4 text-sm">
        <div>
          <p className="text-xs opacity-70">{isEn ? 'Patient' : 'المريض'}</p>
          <p className="font-bold">{rx.patient.full_name}</p>
          <p className="clinical-num font-mono text-xs">
            <bdi>{rx.patient.mrn}</bdi> · {rx.patient.age} · {rx.patient.sex}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-70">{isEn ? 'Prescriber' : 'الدكتور المعالج'}</p>
          <p className="font-bold">{rx.prescriber.name}</p>
          <p className="clinical-num font-mono text-xs">
            <bdi>{rx.prescriber.license_number}</bdi>
            {rx.prescriber.specialty ? ` · ${rx.prescriber.specialty}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-70">{isEn ? 'Rx Number' : 'رقم الروشتة'}</p>
          <p className="clinical-num font-mono text-base font-bold">
            <bdi>{rx.rx_number}</bdi>
          </p>
        </div>
        <div>
          <p className="text-xs opacity-70">{isEn ? 'Paper Verification Code' : 'كود الصرف الورقي'}</p>
          <p className="clinical-num font-mono text-base font-bold">
            <bdi>{paperCode ?? rx.verification_code_hint ?? '••••••'}</bdi>
          </p>
        </div>
        <div>
          <p className="text-xs opacity-70">{isEn ? 'Issued' : 'تاريخ الإصدار'}</p>
          <p className="text-xs">{formatCairoDateTime(rx.issued_at, locale)}</p>
        </div>
        <div>
          <p className="text-xs opacity-70">{isEn ? 'Valid Until' : 'صالحة حتى'}</p>
          <p className="text-xs">{formatCairoDateTime(rx.expires_at, locale)}</p>
        </div>
      </section>

      <section className="my-5">
        <h2 className="mb-2 text-sm font-bold">{isEn ? 'Prescribed Medications' : 'الأدوية المصروفة'}</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-start text-xs">
              <th className="py-2 text-start">{isEn ? 'Medication' : 'الدواء'}</th>
              <th className="py-2 text-start">{tRx('dose')}</th>
              <th className="py-2 text-start">{tRx('frequency')}</th>
              <th className="py-2 text-start">{tRx('durationDays')}</th>
              <th className="py-2 text-start">{tRx('quantity')}</th>
            </tr>
          </thead>
          <tbody>
            {rx.items.map((item) => (
              <tr key={item.id} className="border-b border-black/20 align-top">
                <td className="py-2 pe-2">
                  <p className="font-bold">
                    <bdi>{item.drug.brand_name}</bdi> ({item.drug.strength})
                  </p>
                  <p className="text-xs opacity-75">
                    <bdi>{item.drug.generic_name}</bdi> · {item.drug.dosage_form}
                  </p>
                  {item.instructions && <p className="mt-1 text-xs">{item.instructions}</p>}
                </td>
                <td className="clinical-num py-2 pe-2">
                  <bdi>{item.dose}</bdi>
                </td>
                <td className="clinical-num py-2 pe-2">
                  <bdi>{item.frequency}</bdi>
                </td>
                <td className="clinical-num py-2 pe-2">
                  <bdi>{item.duration_days}</bdi>
                </td>
                <td className="clinical-num py-2">
                  <bdi>
                    {item.quantity_prescribed} {item.quantity_unit}
                  </bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {rx.notes_to_pharmacist && (
        <section className="mb-5 rounded border border-black/30 p-3 text-xs">
          <p className="font-bold">{tRx('notesToPharmacist')}:</p>
          <p className="mt-1">{rx.notes_to_pharmacist}</p>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-black pt-4">
        <div className="space-y-1 text-xs">
          <p className="font-bold">{isEn ? 'Ed25519 Signature Verification' : 'توقيع رقمي موثّق Ed25519'}</p>
          <p className="clinical-num font-mono text-[11px] opacity-75">
            kid: <bdi>{rx.signature.kid}</bdi>
          </p>
        </div>
        <BarcodeSvg value={`${rx.rx_number}${paperCode ? `:${paperCode}` : ''}`} />
      </footer>
    </main>
  );
}
