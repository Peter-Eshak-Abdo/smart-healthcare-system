import { createHmac, randomInt } from 'node:crypto';
import {
  AccessLogQuerySchema,
  CreateShareCodeRequestSchema,
  GrantIdParamSchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { requirePermission, requireStepUp } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { AppError } from '../../shared/errors.js';
import { decodeCursor, encodeCursor } from '../../shared/pagination.js';

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

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

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
        const pools = requirePools();

        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

        const created = await withUserTx(pools, auth, async (tx) => {
          const patient = await tx
            .selectFrom('app.patients')
            .select('mrn')
            .where('id', '=', auth.userId)
            .executeTakeFirstOrThrow();

          const hmac = computeShareCodeHmac(deps.keyring.blindIndexKey, patient.mrn, code);

          const inserted = await tx
            .insertInto('app.share_codes')
            .values({
              patient_id: auth.userId,
              code_hmac: hmac,
              scope: body.scope,
              grant_duration_days: body.grant_duration_days,
            })
            .returning(['id', 'expires_at'])
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'SHARE_CODE_CREATED',
            resourceType: 'share_code',
            resourceId: inserted.id,
            patientId: auth.userId,
            metadata: {
              scope: body.scope,
              grant_duration_days: body.grant_duration_days,
            },
          });

          return inserted;
        });

        res.status(201).json({
          code,
          expires_at: new Date(created.expires_at).toISOString(),
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
        const pools = requirePools();

        const data = await withUserTx(pools, auth, async (tx) => {
          const rows = await sql<{
            id: string;
            grant_type: 'patient_share' | 'encounter' | 'admin_override';
            practitioner_name: string;
            practitioner_type: 'doctor' | 'pharmacist' | 'paramedic';
            facility_name: string | null;
            scope: 'read_only' | 'read_write';
            status: 'active' | 'revoked' | 'expired';
            granted_at: string;
            expires_at: string;
          }>`
            select
              ag.id,
              ag.grant_type,
              p.full_name as practitioner_name,
              pr.practitioner_type,
              (
                select f.name
                  from app.practitioner_facilities pf
                  join app.facilities f on f.id = pf.facility_id
                 where pf.practitioner_id = pr.id and pf.ended_at is null
                 order by pf.started_at asc
                 limit 1
              ) as facility_name,
              ag.scope,
              ag.status,
              ag.granted_at::text,
              ag.expires_at::text
            from app.access_grants ag
            join app.practitioners pr on pr.id = ag.practitioner_id
            join app.profiles p on p.id = pr.id
            where ag.patient_id = ${auth.userId}::uuid
            order by ag.granted_at desc
          `.execute(tx);

          return rows.rows.map((r) => ({
            id: r.id,
            grant_type: r.grant_type,
            practitioner: {
              name: r.practitioner_name,
              type: r.practitioner_type,
              facility: r.facility_name,
            },
            scope: r.scope,
            status: r.status,
            granted_at: new Date(r.granted_at).toISOString(),
            expires_at: new Date(r.expires_at).toISOString(),
          }));
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
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          const updated = await tx
            .updateTable('app.access_grants')
            .set({
              status: 'revoked',
              revoked_at: sql`now()`,
              revoked_by: auth.userId,
            })
            .where('id', '=', grantId)
            .where('patient_id', '=', auth.userId)
            .where('status', '=', 'active')
            .returning('id')
            .executeTakeFirst();

          if (!updated) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'ACCESS_GRANT_REVOKED',
            resourceType: 'access_grant',
            resourceId: grantId,
            patientId: auth.userId,
          });
        });

        res.status(204).send();
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
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const page = await withUserTx(pools, auth, async (tx) => {
          const rows = (
            await sql<{
              id: string;
              occurred_at: string;
              actor_name: string | null;
              actor_role: 'patient' | 'doctor' | 'pharmacist' | 'paramedic' | 'admin' | null;
              facility_name: string | null;
              action: string;
              resource_type: string | null;
            }>`
              select
                l.id::text,
                l.occurred_at::text,
                l.actor_name,
                l.actor_role::app.app_role as actor_role,
                l.facility_name,
                l.action,
                l.resource_type
              from private.patient_access_log(
                ${query.limit + 1},
                ${cursor?.t ?? null}::timestamptz
              ) l
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => {
              let context: 'grant' | 'emergency' | 'pharmacy' | 'self' | 'system' = 'system';
              if (r.action.startsWith('EMERGENCY_')) context = 'emergency';
              else if (r.action.startsWith('RX_VERIFIED') || r.action.startsWith('RX_DISPENSED')) {
                context = 'pharmacy';
              } else if (r.actor_role === 'doctor') context = 'grant';
              else if (r.actor_role === 'patient') context = 'self';

              return {
                at: new Date(r.occurred_at).toISOString(),
                actor: {
                  name: r.actor_name ?? 'SmartHealth System',
                  role: r.actor_role ?? 'admin',
                  facility: r.facility_name,
                },
                action: r.action,
                context,
              };
            }),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.occurred_at, id: last.id }, deps.keyring.blindIndexKey)
                  : null,
              has_more: hasMore,
            },
          };
        });

        res.status(200).json(page);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
