import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getFirebaseServerApp, getFirebaseServerAuth } from '@/lib/firebase/admin';

const PatchBodySchema = z.object({
  uid: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  role: z.enum(['doctor', 'pharmacist', 'paramedic', 'admin']).optional(),
});

async function getAuthenticatedUser() {
  const auth = getFirebaseServerAuth();
  if (!auth) return null;
  const store = await cookies();
  const token = store.get('sh_id_token')?.value;
  if (!token) return null;
  try {
    return await auth.verifyIdToken(token, true);
  } catch {
    return null;
  }
}

export async function POST() {
  const decoded = await getAuthenticatedUser();
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const app = getFirebaseServerApp();
  if (!app) {
    return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
  }

  const db = getFirestore(app);
  const docRef = db.collection('staff_access_requests').doc(decoded.uid);
  const existing = await docRef.get();

  if (!existing.exists) {
    await docRef.set({
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: decoded.name ?? decoded.email ?? '',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, status: existing.data()?.status ?? 'pending' });
}

export async function GET() {
  const decoded = await getAuthenticatedUser();
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const app = getFirebaseServerApp();
  if (!app) {
    return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
  }

  const db = getFirestore(app);
  const snap = await db
    .collection('staff_access_requests')
    .orderBy('requestedAt', 'desc')
    .limit(50)
    .get();

  const items = snap.docs.map((doc) => doc.data());
  return NextResponse.json({ items });
}

export async function PATCH(request: Request) {
  const decoded = await getAuthenticatedUser();
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = PatchBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const app = getFirebaseServerApp();
  const auth = getFirebaseServerAuth();
  if (!app || !auth) {
    return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
  }

  const { uid, action, role } = body.data;
  const db = getFirestore(app);
  const docRef = db.collection('staff_access_requests').doc(uid);

  if (action === 'approve') {
    const assignedRole = role ?? 'doctor';
    await auth.setCustomUserClaims(uid, { role: assignedRole, approved: true });
    await docRef.set(
      {
        status: 'approved',
        assignedRole,
        reviewedBy: decoded.uid,
        reviewedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } else {
    await docRef.set(
      {
        status: 'rejected',
        reviewedBy: decoded.uid,
        reviewedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  return NextResponse.json({ ok: true });
}
