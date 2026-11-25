import { sql } from 'kysely';
import type { Tx } from '../db/with-user-tx.js';
import type { AuthLocals } from './auth-context.js';
import { getRequestId, requestContext } from '../shared/request-context.js';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  outcome?: 'success' | 'denied' | 'error';
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts a tamper-evident audit entry inside the current user transaction.
 * Never store PHI values inside metadata — IDs, field names, and counts only.
 */
export async function writeAuditLog(
  tx: Tx,
  auth: Pick<AuthLocals, 'userId' | 'role'> | null,
  entry: AuditEntry,
): Promise<void> {
  const ctx = requestContext.getStore();
  const reqId = getRequestId() ?? null;
  const metaJson = JSON.stringify(entry.metadata ?? {});

  await sql`
    insert into audit.system_logs (
      actor_id,
      actor_role,
      action,
      resource_type,
      resource_id,
      patient_id,
      outcome,
      reason,
      request_id,
      ip,
      user_agent,
      metadata
    ) values (
      ${auth?.userId ?? null}::uuid,
      ${auth?.role ?? null},
      ${entry.action},
      ${entry.resourceType},
      ${entry.resourceId ?? null}::uuid,
      ${entry.patientId ?? null}::uuid,
      ${entry.outcome ?? 'success'}::audit.outcome,
      ${entry.reason ?? null},
      ${reqId}::uuid,
      ${ctx?.ip ?? null}::inet,
      ${ctx?.userAgent ?? null},
      ${metaJson}::jsonb
    )
  `.execute(tx);
}
