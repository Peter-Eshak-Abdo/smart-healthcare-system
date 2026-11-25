import type { AppRole, MeResponse } from '@smarthealth/contracts';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/api/server';
import { isApiErrorCode } from '@/lib/api/errors';
import { createServerSupabase } from '@/lib/supabase/server';

export async function requireRole(
  expectedRole: AppRole | AppRole[],
  locale: 'ar' | 'en',
): Promise<MeResponse> {
  const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
  const prefix = locale === 'ar' ? '' : `/${locale}`;

  const supabase = await createServerSupabase();
  if (!supabase) {
    redirect(`${prefix}/login` as never);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`${prefix}/login` as never);
  }

  let me: MeResponse;
  try {
    me = await serverApiFetch<MeResponse>('/v1/me', session.access_token, locale);
  } catch (err) {
    if (isApiErrorCode(err, 'AUTH_MFA_REQUIRED')) {
      redirect(`${prefix}/mfa/verify` as never);
    }
    redirect(`${prefix}/not-authorized` as never);
  }

  if (me.mfa.aal !== 'aal2') {
    redirect(`${prefix}/mfa/verify` as never);
  }
  if (!allowed.includes(me.role) || me.status !== 'active') {
    redirect(`${prefix}/not-authorized` as never);
  }
  if (me.role !== 'admin' && me.practitioner?.license_status !== 'verified') {
    redirect(`${prefix}/not-authorized?reason=license` as never);
  }

  return me;
}
