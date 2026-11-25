import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { AppDeps } from '../app-deps.js';
import { COLLECTIONS, type AccessGrantDoc } from './firestore-types.js';
import { AppError } from '../shared/errors.js';

export function requireDb(deps: Pick<AppDeps, 'db'>): Firestore {
  if (!deps.db) {
    throw new AppError('INTERNAL_ERROR', { detail: 'firestore_not_configured' });
  }
  return deps.db;
}

export async function getActiveDoctorGrant(
  db: Firestore,
  patientId: string,
  doctorId: string,
): Promise<AccessGrantDoc | null> {
  const snap = await db
    .collection(COLLECTIONS.accessGrants)
    .where('patient_id', '==', patientId)
    .where('doctor_id', '==', doctorId)
    .where('status', '==', 'active')
    .limit(5)
    .get();

  const nowIso = new Date().toISOString();
  for (const doc of snap.docs) {
    const grant = doc.data() as AccessGrantDoc;
    if (grant.expires_at > nowIso) {
      return grant;
    }
  }
  return null;
}

export async function requireDoctorGrant(
  db: Firestore,
  patientId: string,
  doctorId: string,
  requiredScope?: 'read_write',
): Promise<AccessGrantDoc> {
  const grant = await getActiveDoctorGrant(db, patientId, doctorId);
  if (!grant) {
    throw new AppError('ACCESS_GRANT_REQUIRED');
  }
  if (requiredScope === 'read_write' && grant.scope !== 'read_write') {
    throw new AppError('RBAC_FORBIDDEN', { detail: 'grant_scope_read_only' });
  }
  return grant;
}

export async function enqueueOutboxNotification(
  db: Firestore,
  input: {
    user_id: string;
    channel: 'push' | 'sms' | 'in_app';
    template: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const id = randomUUID();
  await db
    .collection(COLLECTIONS.outboxEvents)
    .doc(id)
    .set({
      id,
      user_id: input.user_id,
      channel: input.channel,
      template: input.template,
      payload: input.payload,
      status: 'pending',
      attempts: 0,
      created_at: new Date().toISOString(),
    });
}
