import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, type SystemLogDoc } from '../firebase/firestore-types.js';
import type { AuthLocals } from './auth-context.js';
import { getRequestId, requestContext } from '../shared/request-context.js';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  patientMrnLast4?: string | null;
  outcome?: 'success' | 'denied' | 'error';
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

const GENESIS_HASH = '0'.repeat(64);

function computeAuditHash(payload: Omit<SystemLogDoc, 'entry_hash'>): string {
  const material = JSON.stringify({
    seq: payload.seq,
    occurred_at: payload.occurred_at,
    actor_id: payload.actor_id,
    action: payload.action,
    resource_type: payload.resource_type,
    resource_id: payload.resource_id,
    patient_id: payload.patient_id,
    outcome: payload.outcome,
    reason: payload.reason,
    prev_hash: payload.prev_hash,
    metadata: payload.metadata,
  });
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

/**
 * Appends an immutable SHA-256 hash-chained audit entry to Firestore `system_logs`.
 * Never store PHI values inside metadata — IDs, field names, and counts only.
 */
export async function writeAuditLog(
  db: Firestore | null,
  auth: Pick<AuthLocals, 'userId' | 'role' | 'fullName'> | null,
  entry: AuditEntry,
): Promise<void> {
  if (!db) return;

  const ctx = requestContext.getStore();
  const reqId = getRequestId() ?? null;
  const nowIso = new Date().toISOString();
  const logId = randomUUID();

  await db.runTransaction(async (tx) => {
    const metaRef = db.collection(COLLECTIONS.auditMeta).doc('chain_head');
    const metaSnap = await tx.get(metaRef);
    const prevSeq = metaSnap.exists ? Number(metaSnap.data()?.seq ?? 0) : 0;
    const prevHash = metaSnap.exists
      ? String(metaSnap.data()?.last_hash ?? GENESIS_HASH)
      : GENESIS_HASH;

    const seq = prevSeq + 1;
    const baseDoc: Omit<SystemLogDoc, 'entry_hash'> = {
      id: logId,
      seq,
      occurred_at: nowIso,
      actor_id: auth?.userId ?? null,
      actor_name: auth?.fullName ?? null,
      actor_role: auth?.role ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      patient_id: entry.patientId ?? null,
      patient_mrn_last4: entry.patientMrnLast4 ?? null,
      outcome: entry.outcome ?? 'success',
      reason: entry.reason ?? null,
      request_id: reqId,
      ip: ctx?.ip ?? null,
      user_agent: ctx?.userAgent ?? null,
      metadata: entry.metadata ?? {},
      prev_hash: prevHash,
    };

    const entryHash = computeAuditHash(baseDoc);
    const fullDoc: SystemLogDoc = { ...baseDoc, entry_hash: entryHash };

    tx.create(db.collection(COLLECTIONS.systemLogs).doc(logId), fullDoc);
    tx.set(metaRef, {
      seq,
      last_hash: entryHash,
      last_event_id: logId,
      updated_at: nowIso,
    });
  });
}

export async function verifyAuditChain(db: Firestore): Promise<{
  verified_at: string;
  last_event_id: string | null;
  status: 'ok' | 'broken';
  broken_at_event_id: string | null;
}> {
  const verifiedAt = new Date().toISOString();
  const snap = await db
    .collection(COLLECTIONS.systemLogs)
    .orderBy('seq', 'asc')
    .limit(5000)
    .get();

  let expectedPrev = GENESIS_HASH;
  let lastEventId: string | null = null;

  for (const doc of snap.docs) {
    const row = doc.data() as SystemLogDoc;
    lastEventId = row.id;
    if (row.prev_hash !== expectedPrev) {
      return {
        verified_at: verifiedAt,
        last_event_id: lastEventId,
        status: 'broken',
        broken_at_event_id: row.id,
      };
    }
    const { entry_hash, ...rest } = row;
    if (computeAuditHash(rest) !== entry_hash) {
      return {
        verified_at: verifiedAt,
        last_event_id: lastEventId,
        status: 'broken',
        broken_at_event_id: row.id,
      };
    }
    expectedPrev = entry_hash;
  }

  return {
    verified_at: verifiedAt,
    last_event_id: lastEventId,
    status: 'ok',
    broken_at_event_id: null,
  };
}
