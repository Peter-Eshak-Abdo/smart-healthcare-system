import { createHmac, randomInt, randomUUID } from 'node:crypto';
import {
  AccessLogQuerySchema,
  CreateShareCodeRequestSchema,
  GrantIdParamSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type AccessGrantDoc,
  type PatientDoc,
  type ShareCodeDoc,
  type SystemLogDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission, requireStepUp } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { AppError } from '../../shared/errors.js';

export function computeShareCodeHmac(
  blindIndexKey: Buffer,
  patientMrn: string,
  code: string,
): Buffer {
  return createHmac('sha256', blindIndexKey)
    .update(`share:${patientMrn.toUpperCase()}:${code}`, 'utf8')
    .digest();
}

export function accessRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post(
    '/patients/me/share-codes',
    requirePermission('access_grant:manage:self'),
    requireStepUp(deps.stepUp, 'pickup_token'),
    validate({ body: CreateShareCodeRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          grant_duration_days: number;
          scope: 'read_only' | 'read_write';
        };
        const db = requireDb(deps);
        const patSnap = await db.collection(COLLECTIONS.patients).doc(auth.userId).get();
        if (!patSnap.exists) {
          throw new AppError('RESOURCE_NOT_FOUND', { detail: 'patient_profile_not_found' });
        }
        const patient = patSnap.data() as PatientDoc;
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const codeHmacHex = computeShareCodeHmac(
          deps.keyring.blindIndexKey,
          patient.mrn,
          code,
        ).toString('hex');

        const id = randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
        const shareDoc: ShareCodeDoc = {
          id,
          patient_id: auth.userId,
          mrn: patient.mrn,
          code_hmac: codeHmacHex,
          grant_duration_days: body.grant_duration_days,
          scope: body.scope,
          expires_at: expiresAt,
          redeemed_at: null,
          redeemed_by_doctor_id: null,
          created_at: now.toISOString(),
        };

        await db.collection(COLLECTIONS.shareCodes).doc(id).set(shareDoc);
        await writeAuditLog(db, auth, {
          action: 'SHARE_CODE_CREATED',
          resourceType: 'share_code',
          resourceId: id,
          patientId: auth.userId,
          patientMrnLast4: patient.mrn_last4,
          metadata: {
            scope: body.scope,
            grant_duration_days: body.grant_duration_days,
          },
        });

        res.status(201).json({
          code,
          expires_at: expiresAt,
          grant_duration_days: body.grant_duration_days,
          scope: body.scope,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/access-grants',
    requirePermission('access_grant:manage:self'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.accessGrants)
          .where('patient_id', '==', auth.userId)
          .orderBy('granted_at', 'desc')
          .limit(50)
          .get();

        const data = snap.docs.map((doc) => {
          const g = doc.data() as AccessGrantDoc;
          return {
            id: g.id,
            grant_type: g.grant_type,
            practitioner: {
              name: g.doctor_name,
              type: 'doctor' as const,
              facility: g.facility_name,
            },
            scope: g.scope,
            status: g.status,
            granted_at: g.granted_at,
            expires_at: g.expires_at,
          };
        });

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/patients/me/access-grants/:grantId',
    requirePermission('access_grant:manage:self'),
    validate({ params: GrantIdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { grantId } = res.locals.validated!.params as { grantId: string };
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.accessGrants).doc(grantId);
        const snap = await ref.get();
        if (!snap.exists || (snap.data() as AccessGrantDoc).patient_id !== auth.userId) {
          throw new AppError('RESOURCE_NOT_FOUND');
        }
        await ref.update({ status: 'revoked' });
        await writeAuditLog(db, auth, {
          action: 'ACCESS_GRANT_REVOKED',
          resourceType: 'access_grant',
          resourceId: grantId,
          patientId: auth.userId,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/patients/me/access-log',
    requirePermission('access_log:read:self'),
    validate({ query: AccessLogQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as { limit: number; cursor?: string };
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.systemLogs)
          .where('patient_id', '==', auth.userId)
          .orderBy('seq', 'desc')
          .limit(query.limit)
          .get();

        const data = snap.docs.map((doc) => {
          const row = doc.data() as SystemLogDoc;
          return {
            id: row.id,
            occurred_at: row.occurred_at,
            actor_name: row.actor_name ?? 'System',
            actor_role: row.actor_role ?? 'system',
            action: row.action,
            resource_type: row.resource_type,
          };
        });
        res.status(200).json({ data, next_cursor: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
