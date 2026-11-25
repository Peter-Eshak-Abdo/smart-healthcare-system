'use client';

import type { AdminFacilitiesResponseSchema, AdminFacilityDtoSchema } from '@smarthealth/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';

type FacilitiesRes = z.infer<typeof AdminFacilitiesResponseSchema>;
type FacilityDto = z.infer<typeof AdminFacilityDtoSchema>;

export default function AdminFacilitiesPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<'hospital' | 'clinic' | 'pharmacy' | 'er_unit'>('hospital');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: ['admin-facilities'],
    queryFn: () => apiFetch<FacilitiesRes>('/v1/admin/facilities', { locale }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<FacilityDto>('/v1/admin/facilities', {
        method: 'POST',
        locale,
        body: {
          name: name.trim(),
          type,
          ...(address.trim() ? { address: address.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setError(null);
      setName('');
      setAddress('');
      void queryClient.invalidateQueries({ queryKey: ['admin-facilities'] });
    },
    onError: (err) => setError(err),
  });

  const toggleMutation = useMutation({
    mutationFn: (f: FacilityDto) =>
      apiFetch(`/v1/admin/facilities/${f.id}`, {
        method: 'PATCH',
        locale,
        body: { is_active: !f.is_active },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-facilities'] }),
    onError: (err) => setError(err),
  });

  return (
    <div className="space-y-6">
      {error !== null && <ProblemAlert error={error} />}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4"
      >
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isEn ? 'Facility name' : 'اسم المستشفى أو الصيدلية'}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="hospital">hospital</option>
          <option value="clinic">clinic</option>
          <option value="pharmacy">pharmacy</option>
          <option value="er_unit">er_unit</option>
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={isEn ? 'Address' : 'العنوان'}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>{isEn ? 'Add Facility' : 'أضف منشأة'}</span>
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {(query.data?.data ?? []).map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-bold text-foreground">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.type} {f.address ? `· ${f.address}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleMutation.mutate(f)}
              className={`rounded-xl px-3 py-1 text-xs font-bold ${
                f.is_active
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {f.is_active ? (isEn ? 'Active' : 'مفعّلة') : isEn ? 'Disabled' : 'معطّلة'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
