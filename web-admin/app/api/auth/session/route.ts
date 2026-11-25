import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseServerAuth } from '@/lib/firebase/admin';

const SessionBodySchema = z.object({
  idToken: z.string().min(20),
});

export async function POST(request: Request) {
  const body = SessionBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 });
  }

  const auth = getFirebaseServerAuth();
  if (auth) {
    try {
      await auth.verifyIdToken(body.data.idToken, true);
    } catch {
      return NextResponse.json({ error: 'Invalid Firebase ID token' }, { status: 401 });
    }
  }

  const store = await cookies();
  store.set('sh_id_token', body.data.idToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 3600,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete('sh_id_token');
  return NextResponse.json({ ok: true });
}
