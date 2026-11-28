'use client';

import type {
  AdminApprovalResponseSchema,
  AdminFacilitiesResponseSchema,
  AdminInviteUserResponseSchema,
  AdminSetUserRoleResponseSchema,
  AdminUsersResponseSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { PendingStaffRequests } from '@/components/admin/PendingStaffRequests';
import { apiFetch } from '@/lib/api/client';

type UsersPage = z.infer<typeof AdminUsersResponseSchema>;
type FacilitiesRes = z.infer<typeof AdminFacilitiesResponseSchema>;
type SetRoleRes = z.infer<typeof AdminSetUserRoleResponseSchema>;
type InviteRes = z.infer<typeof AdminInviteUserResponseSchema>;
type ApprovalRes = z.infer<typeof AdminApprovalResponseSchema>;

export default function AdminUsersPage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const queryClient = useQueryClient();
  const tAdm = useTranslations('admin');

  const [roleFilter, setRoleFilter] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<'doctor' | 'pharmacist' | 'paramedic' | 'admin'>('doctor');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiresAt, setLicenseExpiresAt] = useState('2028-12-31');
  const [facilityId, setFacilityId] = useState('');
  const [approvalIdInput, setApprovalIdInput] = useState('');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => {
      const qs = roleFilter ? `?role=${encodeURIComponent(roleFilter)}` : '';
      return apiFetch<UsersPage>(`/v1/admin/users${qs}`, { locale });
    },
  });

  const facilitiesQuery = useQuery({
    queryKey: ['admin-facilities'],
    queryFn: () => apiFetch<FacilitiesRes>('/v1/admin/facilities', { locale }),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiFetch<InviteRes>('/v1/admin/users', {
        method: 'POST',
        locale,
        body: {
          email: email.trim(),
          full_name: fullName.trim(),
          role: inviteRole,
          ...(inviteRole !== 'admin'
            ? {
                practitioner: {
                  license_number: licenseNumber.trim(),
                  license_expires_at: licenseExpiresAt,
                  facility_ids: [facilityId || facilitiesQuery.data?.data[0]?.id],
                },
              }
            : {}),
        },
      }),
    onSuccess: () => {
      setError(null);
      setInviteOpen(false);
      setEmail('');
      setFullName('');
      setLicenseNumber('');
      setBannerMsg(isEn ? 'Staff invitation sent.' : 'تم إرسال دعوة الانضمام بنجاح.');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => setError(err),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: 'suspended' | 'active' }) =>
      apiFetch(`/v1/admin/users/${input.id}/status`, {
        method: 'PATCH',
        locale,
        body: { status: input.status, reason: 'Administrative review action' },
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => setError(err),
  });

  const licenseMutation = useMutation({
    mutationFn: (input: { id: string; license_status: 'verified' | 'revoked' | 'suspended' }) =>
      apiFetch(`/v1/admin/practitioners/${input.id}/license`, {
        method: 'PATCH',
        locale,
        body: { license_status: input.license_status, reason: 'License review update' },
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => setError(err),
  });

  const roleChangeMutation = useMutation({
    mutationFn: (input: { id: string; role: 'doctor' | 'pharmacist' | 'paramedic' | 'admin' }) =>
      apiFetch<SetRoleRes>(`/v1/admin/users/${input.id}/role`, {
        method: 'PATCH',
        locale,
        body: { role: input.role, reason: 'Two-person role change governance' },
      }),
    onSuccess: (res) => {
      setError(null);
      if ('pending_approval_id' in res) {
        setApprovalIdInput(res.pending_approval_id);
        setBannerMsg(
          isEn
            ? `Two-person approval created: ${res.pending_approval_id}`
            : `تم إنشاء طلب اعتماد ثنائي برقم: ${res.pending_approval_id}`,
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      }
    },
    onError: (err) => setError(err),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApprovalRes>(`/v1/admin/approvals/${id}/approve`, {
        method: 'POST',
        locale,
        body: {},
      }),
    onSuccess: (res) => {
      setError(null);
      setBannerMsg(
        res.executed
          ? isEn
            ? 'Two-person action approved and executed.'
            : 'تم اعتماد وتنفيذ الصلاحية بنجاح.'
          : isEn
            ? 'Approval recorded.'
            : 'تم تسجيل الاعتماد.',
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => setError(err),
  });

  return (
    <div className="space-y-6">
      <PendingStaffRequests />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">{isEn ? 'All roles' : 'كل الأدوار'}</option>
          <option value="doctor">doctor</option>
          <option value="pharmacist">pharmacist</option>
          <option value="paramedic">paramedic</option>
          <option value="admin">admin</option>
        </select>

        <button
          type="button"
          onClick={() => setInviteOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" />
          <span>{tAdm('inviteUser')}</span>
        </button>
      </div>

      {error !== null && <ProblemAlert error={error} />}
      {bannerMsg && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">
          {bannerMsg}
        </div>
      )}

      {inviteOpen && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
          className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@clinic.eg"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            dir="ltr"
          />
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={isEn ? 'Full name' : 'الاسم الكامل'}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="doctor">doctor</option>
            <option value="pharmacist">pharmacist</option>
            <option value="paramedic">paramedic</option>
            <option value="admin">admin</option>
          </select>

          {inviteRole !== 'admin' && (
            <>
              <input
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="EG-MED-12345"
                className="clinical-num rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
                dir="ltr"
              />
              <input
                type="date"
                required
                value={licenseExpiresAt}
                onChange={(e) => setLicenseExpiresAt(e.target.value)}
                className="clinical-num rounded-xl border border-border bg-background px-3 py-2 text-sm"
                dir="ltr"
              />
              <select
                value={facilityId || facilitiesQuery.data?.data[0]?.id || ''}
                onChange={(e) => setFacilityId(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {(facilitiesQuery.data?.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground sm:col-span-2"
          >
            {tAdm('inviteUser')}
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
        <input
          value={approvalIdInput}
          onChange={(e) => setApprovalIdInput(e.target.value)}
          placeholder="Pending approval UUID..."
          className="clinical-num flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
          dir="ltr"
        />
        <button
          type="button"
          disabled={!approvalIdInput.trim() || approveMutation.isPending}
          onClick={() => approveMutation.mutate(approvalIdInput.trim())}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{tAdm('approveAction')}</span>
        </button>
      </div>

      <div className="space-y-3">
        {(usersQuery.data?.data ?? []).map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-bold text-foreground">
                {u.full_name} · <span className="text-xs text-primary">{u.role}</span> ·{' '}
                <span className="text-xs text-muted-foreground">{u.status}</span>
              </p>
              {u.email && (
                <p className="clinical-num text-xs text-muted-foreground" dir="ltr">
                  {u.email}
                </p>
              )}
              {u.practitioner && (
                <p className="clinical-num mt-0.5 font-mono text-xs text-muted-foreground">
                  <bdi>{u.practitioner.license_number}</bdi> · {u.practitioner.license_status}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {u.practitioner && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      licenseMutation.mutate({ id: u.id, license_status: 'verified' })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{tAdm('verifyLicense')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      licenseMutation.mutate({ id: u.id, license_status: 'revoked' })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{tAdm('revokeLicense')}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  statusMutation.mutate({
                    id: u.id,
                    status: u.status === 'active' ? 'suspended' : 'active',
                  })
                }
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
              >
                {u.status === 'active'
                  ? isEn
                    ? 'Suspend'
                    : 'إيقاف'
                  : isEn
                    ? 'Activate'
                    : 'تفعيل'}
              </button>
              <button
                type="button"
                onClick={() =>
                  roleChangeMutation.mutate({
                    id: u.id,
                    role: u.role === 'admin' ? 'doctor' : 'admin',
                  })
                }
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
              >
                {isEn ? 'Request Role Switch' : 'طلب تعديل الدور'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
