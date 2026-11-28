'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, UserCheck, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState } from 'react';

interface StaffRequestItem {
  uid: string;
  email: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  assignedRole?: string;
}

export function PendingStaffRequests() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<
    Record<string, 'doctor' | 'pharmacist' | 'paramedic' | 'admin'>
  >({});

  const { data, isLoading } = useQuery<{ items: StaffRequestItem[] }>({
    queryKey: ['staff-access-requests'],
    queryFn: async () => {
      const res = await fetch('/api/staff-requests');
      if (!res.ok) return { items: [] };
      return (await res.json()) as { items: StaffRequestItem[] };
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: {
      uid: string;
      action: 'approve' | 'reject';
      role?: 'doctor' | 'pharmacist' | 'paramedic' | 'admin';
    }) => {
      const res = await fetch('/api/staff-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error('Failed to update request');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-access-requests'] });
    },
  });

  const pending = (data?.items ?? []).filter((item) => item.status === 'pending');

  if (isLoading || pending.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <UserCheck className="h-5 w-5" />
        <h2 className="text-base font-bold">
          {isEn
            ? `Pending Staff Access Requests (${pending.length})`
            : `طلبات انضمام الطاقم الطبي المعلقة (${pending.length})`}
        </h2>
      </div>
      <div className="mt-3 space-y-2">
        {pending.map((item) => {
          const role = selectedRoles[item.uid] ?? 'doctor';
          return (
            <div
              key={item.uid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {item.displayName || item.email}
                </p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {item.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={role}
                  onChange={(e) =>
                    setSelectedRoles((prev) => ({
                      ...prev,
                      [item.uid]: e.target.value as
                        | 'doctor'
                        | 'pharmacist'
                        | 'paramedic'
                        | 'admin',
                    }))
                  }
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                >
                  <option value="doctor">{isEn ? 'Doctor' : 'طبيب'}</option>
                  <option value="pharmacist">{isEn ? 'Pharmacist' : 'صيدلي'}</option>
                  <option value="paramedic">{isEn ? 'Paramedic' : 'مسعف'}</option>
                  <option value="admin">{isEn ? 'Admin' : 'أدمن'}</option>
                </select>
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ uid: item.uid, action: 'approve', role })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Approve' : 'موافقة'}</span>
                </button>
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ uid: item.uid, action: 'reject' })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Reject' : 'رفض'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
