import type { AppRole, MeResponse } from '@smarthealth/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/api/server';
import { getFirebaseServerAuth } from '@/lib/firebase/admin';

export async function requireRole(
  expectedRole: AppRole | AppRole[],
  locale: 'ar' | 'en',
): Promise<MeResponse> {
  const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
  const prefix = locale === 'ar' ? '' : `/${locale}`;

  const cookieStore = await cookies();
  const idToken = cookieStore.get('sh_id_token')?.value;
  if (!idToken) {
    redirect(`${prefix}/login` as never);
  }

  const fbAuth = getFirebaseServerAuth();
  if (fbAuth) {
    try {
      await fbAuth.verifyIdToken(idToken, true);
    } catch {
      redirect(`${prefix}/login` as never);
    }
  }

  let me: MeResponse;
  try {
    me = await serverApiFetch<MeResponse>('/v1/me', idToken, locale);
  } catch {
    redirect(`${prefix}/not-authorized` as never);
  }

  if (!allowed.includes(me.role) || me.status !== 'active') {
    redirect(`${prefix}/not-authorized` as never);
  }
  if (me.role !== 'admin' && me.practitioner?.license_status !== 'verified') {
    redirect(`${prefix}/not-authorized?reason=license` as never);
  }

  return me;
}
