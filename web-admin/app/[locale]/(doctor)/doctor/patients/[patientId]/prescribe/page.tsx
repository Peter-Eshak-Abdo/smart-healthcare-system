'use client';

import type {
  CreateEncounterResponseSchema,
  DoctorPatientSummaryResponseSchema,
  MeResponse,
} from '@smarthealth/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { RxBuilder } from '@/components/prescription/RxBuilder';
import { apiFetch } from '@/lib/api/client';

type PatientSummary = z.infer<typeof DoctorPatientSummaryResponseSchema>;
type CreatedEncounter = z.infer<typeof CreateEncounterResponseSchema>;

export default function DoctorPrescribePage() {
  const params = useParams<{ patientId: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';

  const summaryQuery = useQuery({
    queryKey: ['doctor-patient-summary', params.patientId],
    queryFn: () =>
      apiFetch<PatientSummary>(`/v1/doctor/patients/${params.patientId}/summary`, { locale }),
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/v1/me', { locale }),
  });

  const initialEncounter =
    searchParams.get('encounterId') ?? summaryQuery.data?.recent_encounters[0]?.id ?? null;
  const [createdEncounterId, setCreatedEncounterId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const createEncounter = useMutation({
    mutationFn: () => {
      const facilityId =
        meQuery.data?.practitioner?.active_facility_id ??
        meQuery.data?.practitioner?.facilities[0]?.id;
      return apiFetch<CreatedEncounter>(`/v1/doctor/patients/${params.patientId}/encounters`, {
        method: 'POST',
        locale,
        body: { encounter_type: 'outpatient', facility_id: facilityId },
      });
    },
    onSuccess: (enc) => {
      setError(null);
      setCreatedEncounterId(enc.id);
    },
    onError: (err) => setError(err),
  });

  const encounterId = createdEncounterId ?? initialEncounter;

  if (!encounterId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        {error !== null && (
          <div className="mb-4 text-start">
            <ProblemAlert error={error} />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {isEn
            ? 'An encounter must be open before signing an e-prescription.'
            : 'لازم تفتح كشف طبي الأول قبل إصدار روشتة إلكترونية.'}
        </p>
        <button
          type="button"
          disabled={createEncounter.isPending || !meQuery.data}
          onClick={() => createEncounter.mutate()}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {isEn ? 'Open Outpatient Encounter & Continue' : 'افتح كشف خارجي وكمّل'}
        </button>
      </div>
    );
  }

  return <RxBuilder patientId={params.patientId} encounterId={encounterId} />;
}
