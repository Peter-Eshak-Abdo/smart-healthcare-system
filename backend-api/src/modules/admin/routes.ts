import {
  AdminAddFacilityMemberRequestSchema,
  AdminAuditQuerySchema,
  AdminEmergencySessionsQuerySchema,
  AdminFacilityInputSchema,
  AdminFacilityPatchSchema,
  AdminInviteUserRequestSchema,
  AdminResolveDrugRequestSchema,
  AdminReviewEmergencySessionRequestSchema,
  AdminSetLicenseStatusRequestSchema,
  AdminSetUserRoleRequestSchema,
  AdminSetUserStatusRequestSchema,
  AdminUsersQuerySchema,
  IdParamSchema,
  PaginationQuerySchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { createSupabaseAdmin } from '../../integrations/supabase-admin.js';
import { requirePermission, requireRecentAuth } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { AppError } from '../../shared/errors.js';
import { decodeCursor, encodeCursor } from '../../shared/pagination.js';

export function adminRoutes(deps: AppDeps): Router {
  const router = Router();
  const sbAdmin = deps.supabaseAdmin ?? createSupabaseAdmin(deps.env);

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.get(
    '/admin/users',
    requirePermission('user:manage'),
    validate({ query: AdminUsersQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          role?: string;
          status?: string;
          query?: string;
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const result = await withUserTx(pools, auth, async (tx) => {
          const rows = (
            await sql<{
              id: string;
              full_name: string;
              email: string | null;
              role: 'patient' | 'doctor' | 'pharmacist' | 'paramedic' | 'admin';
              status: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
              created_at: string;
              practitioner_type: 'doctor' | 'pharmacist' | 'paramedic' | null;
              license_number: string | null;
              license_status: 'pending' | 'verified' | 'suspended' | 'revoked' | 'expired' | null;
              license_expires_at: string | null;
              specialty_code: string | null;
            }>`
              select
                p.id,
                p.full_name,
                u.email,
                p.role,
                p.status,
                p.created_at::text,
                pr.practitioner_type,
                pr.license_number,
                pr.license_status,
                pr.license_expires_at::text,
                pr.specialty_code
              from app.profiles p
              left join auth.users u on u.id = p.id
              left join app.practitioners pr on pr.id = p.id
              where (${query.role ?? null}::text is null or p.role::text = ${query.role ?? null})
                and (${query.status ?? null}::text is null or p.status::text = ${query.status ?? null})
                and (
                  ${query.query ?? null}::text is null
                  or p.full_name ilike ${`%${query.query ?? ''}%`}
                  or coalesce(u.email, '') ilike ${`%${query.query ?? ''}%`}
                  or coalesce(pr.license_number, '') ilike ${`%${query.query ?? ''}%`}
                )
                and (
                  ${cursor === null}::boolean
                  or (p.created_at, p.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              order by p.created_at desc, p.id desc
              limit ${query.limit + 1}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => ({
              id: r.id,
              full_name: r.full_name,
              email: r.email,
              role: r.role,
              status: r.status,
              created_at: new Date(r.created_at).toISOString(),
              practitioner: r.practitioner_type
                ? {
                    type: r.practitioner_type,
                    license_number: r.license_number ?? '',
                    license_status: r.license_status ?? 'pending',
                    license_expires_at: r.license_expires_at ?? '2099-01-01',
                    specialty_code: r.specialty_code,
                  }
                : null,
            })),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.created_at, id: last.id }, deps.keyring.blindIndexKey)
                  : null,
              has_more: hasMore,
            },
          };
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/users',
    requirePermission('user:manage'),
    requireRecentAuth(300),
    validate({ body: AdminInviteUserRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          email: string;
          full_name: string;
          role: 'doctor' | 'pharmacist' | 'paramedic' | 'admin';
          practitioner?: {
            license_number: string;
            license_authority?: string | null;
            license_expires_at: string;
            specialty_code?: string | null;
            facility_ids: string[];
          };
        };
        const pools = requirePools();

        const invited = await sbAdmin.inviteStaffUser({
          email: body.email,
          fullName: body.full_name,
          role: body.role,
        });

        await withUserTx(pools, auth, async (tx) => {
          if (body.role !== 'admin' && body.practitioner) {
            await sql`
              select private.admin_create_practitioner(
                ${invited.id}::uuid,
                ${body.role}::app.app_role,
                ${body.practitioner.license_number},
                ${body.practitioner.license_authority ?? 'EG-MOH'},
                ${body.practitioner.license_expires_at}::date,
                ${body.practitioner.specialty_code ?? null},
                ${body.practitioner.facility_ids}::uuid[]
              )
            `.execute(tx);
          } else {
            await writeAuditLog(tx, auth, {
              action: 'ADMIN_USER_INVITED',
              resourceType: 'profile',
              resourceId: invited.id,
              metadata: { role: body.role },
            });
          }
        });

        res.status(201).json({ id: invited.id, invite_sent: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admin/users/:id/status',
    requirePermission('user:manage'),
    requireRecentAuth(300),
    validate({ params: IdParamSchema, body: AdminSetUserStatusRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const { status, reason } = res.locals.validated!.body as {
          status: 'suspended' | 'active' | 'deactivated';
          reason: string;
        };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          await sql`
            select private.admin_set_user_status(
              ${id}::uuid,
              ${status}::app.account_status,
              ${reason}
            )
          `.execute(tx);
        });

        await deps.authContext.invalidate(id);
        if (status === 'suspended' || status === 'deactivated') {
          await sbAdmin.signOutUserGlobal(id).catch(() => undefined);
        }

        res.status(200).json({ id, status });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admin/users/:id/role',
    requirePermission('role:assign'),
    requireRecentAuth(300),
    validate({ params: IdParamSchema, body: AdminSetUserRoleRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const { role, reason } = res.locals.validated!.body as {
          role: 'patient' | 'doctor' | 'pharmacist' | 'paramedic' | 'admin';
          reason: string;
        };
        if (id === auth.userId) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'cannot_change_own_role' });
        }
        const pools = requirePools();

        const outcome = await withUserTx(pools, auth, async (tx) => {
          if (role === 'admin') {
            const approval = await tx
              .insertInto('app.admin_approvals')
              .values({
                action: 'assign_admin_role',
                target_id: id,
                payload: { role, reason },
                requested_by: auth.userId,
                status: 'pending',
              })
              .returning('id')
              .executeTakeFirstOrThrow();

            await writeAuditLog(tx, auth, {
              action: 'ADMIN_ROLE_APPROVAL_REQUESTED',
              resourceType: 'admin_approval',
              resourceId: approval.id,
              reason,
            });
            return { pending_approval_id: approval.id };
          }

          await sql`
            update app.profiles
               set role = ${role}::app.app_role,
                   session_epoch = session_epoch + 1
             where id = ${id}::uuid
          `.execute(tx);

          await writeAuditLog(tx, auth, {
            action: 'USER_ROLE_CHANGED',
            resourceType: 'profile',
            resourceId: id,
            reason,
            metadata: { role },
          });
          return { id, role };
        });

        await deps.authContext.invalidate(id);

        if ('pending_approval_id' in outcome) {
          res.status(202).json(outcome);
          return;
        }
        res.status(200).json(outcome);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/approvals/:id/approve',
    requirePermission('role:assign'),
    requireRecentAuth(300),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const pools = requirePools();

        const result = await withUserTx(pools, auth, async (tx) => {
          const approval = await tx
            .selectFrom('app.admin_approvals')
            .select(['id', 'action', 'target_id', 'requested_by', 'status', 'payload'])
            .where('id', '=', id)
            .executeTakeFirst();

          if (!approval || approval.status !== 'pending') {
            throw new AppError('RESOURCE_NOT_FOUND');
          }
          if (approval.requested_by === auth.userId) {
            throw new AppError('RBAC_FORBIDDEN', { detail: 'two_person_approval_required' });
          }

          await tx
            .updateTable('app.admin_approvals')
            .set({
              status: 'approved',
              approved_by: auth.userId,
              decided_at: sql`now()`,
            })
            .where('id', '=', id)
            .execute();

          if (approval.action === 'assign_admin_role') {
            await sql`
              update app.profiles
                 set role = 'admin'::app.app_role,
                     status = 'active'::app.account_status,
                     session_epoch = session_epoch + 1
               where id = ${approval.target_id}::uuid
            `.execute(tx);
          }

          await writeAuditLog(tx, auth, {
            action: 'ADMIN_APPROVAL_GRANTED',
            resourceType: 'admin_approval',
            resourceId: id,
            metadata: { action: approval.action, target_id: approval.target_id },
          });

          return { id, targetId: approval.target_id };
        });

        await deps.authContext.invalidate(result.targetId);
        res.status(200).json({ id: result.id, approved: true, executed: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admin/practitioners/:id/license',
    requirePermission('license:manage'),
    requireRecentAuth(300),
    validate({ params: IdParamSchema, body: AdminSetLicenseStatusRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as {
          license_status: 'pending' | 'verified' | 'suspended' | 'revoked' | 'expired';
          reason: string;
          license_expires_at?: string;
        };
        const pools = requirePools();

        const row = await withUserTx(pools, auth, async (tx) => {
          const result = await sql<{
            id: string;
            license_status: 'pending' | 'verified' | 'suspended' | 'revoked' | 'expired';
            license_status_changed_at: string;
          }>`
            select id, license_status, license_status_changed_at::text
              from private.admin_set_license_status(
                ${id}::uuid,
                ${body.license_status}::app.license_status,
                ${body.reason},
                ${body.license_expires_at ?? null}::date
              )
          `.execute(tx);
          return result.rows[0]!;
        });

        await deps.authContext.invalidate(id);
        if (body.license_status === 'suspended' || body.license_status === 'revoked') {
          await sbAdmin.signOutUserGlobal(id).catch(() => undefined);
        }

        res.status(200).json({
          id: row.id,
          license_status: row.license_status,
          license_status_changed_at: new Date(row.license_status_changed_at).toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/facilities',
    requirePermission('facility:manage'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();
        const data = await withUserTx(pools, auth, async (tx) =>
          tx
            .selectFrom('app.facilities')
            .select(['id', 'name', 'type', 'address', 'phone', 'license_number', 'is_active'])
            .orderBy('name', 'asc')
            .execute(),
        );
        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/facilities',
    requirePermission('facility:manage'),
    validate({ body: AdminFacilityInputSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const body = res.locals.validated!.body as {
          name: string;
          type: 'hospital' | 'clinic' | 'pharmacy' | 'ambulance_service';
          address?: string;
          phone?: string;
          license_number?: string;
        };
        const pools = requirePools();

        const created = await withUserTx(pools, auth, async (tx) => {
          const row = await tx
            .insertInto('app.facilities')
            .values({
              name: body.name,
              type: body.type,
              address: body.address ?? null,
              phone: body.phone ?? null,
              license_number: body.license_number ?? null,
            })
            .returning(['id', 'name', 'type', 'address', 'phone', 'license_number', 'is_active'])
            .executeTakeFirstOrThrow();

          await writeAuditLog(tx, auth, {
            action: 'FACILITY_CREATED',
            resourceType: 'facility',
            resourceId: row.id,
          });
          return row;
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admin/facilities/:id',
    requirePermission('facility:manage'),
    validate({ params: IdParamSchema, body: AdminFacilityPatchSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as Record<string, unknown>;
        const pools = requirePools();

        const updated = await withUserTx(pools, auth, async (tx) => {
          const row = await tx
            .updateTable('app.facilities')
            .set(body)
            .where('id', '=', id)
            .returning(['id', 'name', 'type', 'address', 'phone', 'license_number', 'is_active'])
            .executeTakeFirst();
          if (!row) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'FACILITY_UPDATED',
            resourceType: 'facility',
            resourceId: id,
          });
          return row;
        });

        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/facilities/:id/members',
    requirePermission('facility:manage'),
    validate({ params: IdParamSchema, body: AdminAddFacilityMemberRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const { practitioner_id, role_at_facility } = res.locals.validated!.body as {
          practitioner_id: string;
          role_at_facility?: string;
        };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          await tx
            .insertInto('app.practitioner_facilities')
            .values({
              practitioner_id,
              facility_id: id,
              role_at_facility: role_at_facility ?? null,
            })
            .execute();

          await writeAuditLog(tx, auth, {
            action: 'FACILITY_MEMBER_ADDED',
            resourceType: 'facility',
            resourceId: id,
            metadata: { practitioner_id },
          });
        });

        await deps.authContext.invalidate(practitioner_id);
        res.status(201).json({ facility_id: id, practitioner_id, added: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/audit-events',
    requirePermission('audit:read'),
    validate({ query: AdminAuditQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          actor_id?: string;
          action?: string;
          patient_mrn?: string;
          outcome?: 'success' | 'denied' | 'error';
          from?: string;
          to?: string;
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;
        const beforeSeq = cursor ? Number.parseInt(cursor.id, 10) : null;

        const result = await withUserTx(pools, auth, async (tx) => {
          let patientUuid: string | null = null;
          if (query.patient_mrn) {
            const p = await sql<{ id: string }>`
              select id from app.patients where mrn = ${query.patient_mrn.toUpperCase()}
            `.execute(tx);
            patientUuid = p.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000';
          }

          const rows = (
            await sql<{
              id: string;
              chain_seq: string;
              occurred_at: string;
              actor_id: string | null;
              actor_name: string | null;
              actor_role: string | null;
              action: string;
              resource_type: string | null;
              resource_id: string | null;
              patient_mrn_last4: string | null;
              outcome: 'success' | 'denied' | 'error';
              reason: string | null;
              ip: string | null;
            }>`
              select
                l.id::text,
                l.chain_seq::text,
                l.occurred_at::text,
                l.actor_id,
                pr.full_name as actor_name,
                l.actor_role,
                l.action,
                l.resource_type,
                l.resource_id,
                right(pt.mrn, 4) as patient_mrn_last4,
                l.outcome,
                l.reason,
                host(l.ip)::text as ip
              from private.admin_search_audit(
                ${query.actor_id ?? null}::uuid,
                ${query.action ?? null},
                ${patientUuid}::uuid,
                ${query.outcome ?? null}::audit.outcome,
                ${query.from ?? null}::timestamptz,
                ${query.to ?? null}::timestamptz,
                ${query.limit + 1},
                ${beforeSeq}::bigint
              ) l
              left join app.profiles pr on pr.id = l.actor_id
              left join app.patients pt on pt.id = l.patient_id
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => ({
              id: r.id,
              occurred_at: new Date(r.occurred_at).toISOString(),
              actor: {
                id: r.actor_id,
                name: r.actor_name,
                role: r.actor_role,
              },
              action: r.action,
              resource_type: r.resource_type ?? 'unknown',
              resource_id: r.resource_id,
              patient_mrn_last4: r.patient_mrn_last4,
              outcome: r.outcome,
              reason: r.reason,
              ip: r.ip,
            })),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.occurred_at, id: last.chain_seq }, deps.keyring.blindIndexKey)
                  : null,
              has_more: hasMore,
            },
          };
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/audit-events/export',
    requirePermission('audit:read'),
    validate({ query: AdminAuditQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          actor_id?: string;
          action?: string;
          outcome?: 'success' | 'denied' | 'error';
          from?: string;
          to?: string;
        };
        const pools = requirePools();

        const csv = await withUserTx(pools, auth, async (tx) => {
          const rows = (
            await sql<{
              id: string;
              chain_seq: string;
              occurred_at: string;
              actor_id: string | null;
              actor_role: string | null;
              action: string;
              resource_type: string | null;
              outcome: string;
              reason: string | null;
            }>`
              select id::text, chain_seq::text, occurred_at::text, actor_id, actor_role, action, resource_type, outcome, reason
                from private.admin_search_audit(
                  ${query.actor_id ?? null}::uuid,
                  ${query.action ?? null},
                  null,
                  ${query.outcome ?? null}::audit.outcome,
                  ${query.from ?? null}::timestamptz,
                  ${query.to ?? null}::timestamptz,
                  500,
                  null
                )
            `.execute(tx)
          ).rows;

          await writeAuditLog(tx, auth, {
            action: 'AUDIT_LOG_EXPORTED',
            resourceType: 'audit_log',
            metadata: { row_count: rows.length },
          });

          const header = 'id,chain_seq,occurred_at,actor_id,actor_role,action,resource_type,outcome,reason';
          const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
          const lines = rows.map((r) =>
            [
              r.id,
              r.chain_seq,
              new Date(r.occurred_at).toISOString(),
              r.actor_id ?? '',
              r.actor_role ?? '',
              r.action,
              r.resource_type ?? '',
              r.outcome,
              esc(r.reason),
            ].join(','),
          );
          return [header, ...lines].join('\n');
        });

        res.status(200).type('text/csv').send(csv);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/audit-integrity',
    requirePermission('audit:read'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();

        const report = await withUserTx(pools, auth, async (tx) => {
          const chainRes = await sql<{
            ok: boolean;
            checked: string;
            broken_at_seq: string | null;
          }>`select ok, checked::text, broken_at_seq::text from private.admin_verify_audit_chain()`.execute(
            tx,
          );
          const row = chainRes.rows[0]!;
          const lastRes = await sql<{ id: string }>`
            select id::text from private.admin_search_audit(null, null, null, null, null, null, 1, null)
          `.execute(tx);

          return {
            verified_at: new Date().toISOString(),
            last_event_id: lastRes.rows[0]?.id ?? null,
            status: row.ok ? ('ok' as const) : ('broken' as const),
            ...(row.broken_at_seq ? { broken_at_event_id: row.broken_at_seq } : {}),
          };
        });

        res.status(200).json(report);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/emergency-sessions',
    requirePermission('emergency_session:review'),
    validate({ query: AdminEmergencySessionsQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          review_status?: 'pending' | 'appropriate' | 'inappropriate';
          limit: number;
          cursor?: string;
        };
        const pools = requirePools();
        const cursor = query.cursor
          ? decodeCursor(query.cursor, deps.keyring.blindIndexKey)
          : null;

        const page = await withUserTx(pools, auth, async (tx) => {
          const rows = (
            await sql<{
              id: string;
              paramedic_id: string;
              paramedic_name: string;
              patient_mrn_last4: string | null;
              method: 'face' | 'emergency_card_qr' | 'manual_search';
              low_confidence: boolean;
              match_score: number | null;
              started_at: string;
              reason_code: string | null;
              review_status: 'pending' | 'appropriate' | 'inappropriate';
            }>`
              select
                es.id,
                es.paramedic_id,
                p.full_name as paramedic_name,
                right(pt.mrn, 4) as patient_mrn_last4,
                es.method,
                es.low_confidence,
                es.match_score,
                es.started_at::text,
                es.reason_code,
                es.review_status
              from app.emergency_sessions es
              join app.profiles p on p.id = es.paramedic_id
              left join app.patients pt on pt.id = es.patient_id
              where (${query.review_status ?? null}::text is null or es.review_status = ${query.review_status ?? null})
                and (
                  ${cursor === null}::boolean
                  or (es.started_at, es.id) < (${cursor?.t ?? '1970-01-01T00:00:00Z'}::timestamptz, ${cursor?.id ?? '00000000-0000-0000-0000-000000000000'}::uuid)
                )
              order by es.started_at desc, es.id desc
              limit ${query.limit + 1}
            `.execute(tx)
          ).rows;

          const hasMore = rows.length > query.limit;
          const sliced = hasMore ? rows.slice(0, query.limit) : rows;
          const last = sliced.at(-1);

          return {
            data: sliced.map((r) => {
              let band = 'manual';
              if (r.match_score !== null) {
                band = r.match_score >= 0.7 ? 'high' : r.match_score >= 0.5 ? 'medium' : 'low';
              }
              return {
                id: r.id,
                paramedic: { id: r.paramedic_id, name: r.paramedic_name },
                patient_mrn_last4: r.patient_mrn_last4,
                method: r.method,
                low_confidence: r.low_confidence,
                match_score_band: band,
                started_at: new Date(r.started_at).toISOString(),
                reason_code: r.reason_code,
                review_status: r.review_status,
              };
            }),
            page: {
              next_cursor:
                hasMore && last
                  ? encodeCursor({ t: last.started_at, id: last.id }, deps.keyring.blindIndexKey)
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

  router.post(
    '/admin/emergency-sessions/:id/review',
    requirePermission('emergency_session:review'),
    validate({ params: IdParamSchema, body: AdminReviewEmergencySessionRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const { outcome, note } = res.locals.validated!.body as {
          outcome: 'appropriate' | 'inappropriate';
          note: string;
        };
        const pools = requirePools();

        await withUserTx(pools, auth, async (tx) => {
          await sql`
            select private.admin_review_emergency_session(${id}::uuid, ${outcome}, ${note})
          `.execute(tx);
          await writeAuditLog(tx, auth, {
            action: 'EMERGENCY_SESSION_REVIEWED',
            resourceType: 'emergency_session',
            resourceId: id,
            reason: outcome,
          });
        });

        res.status(200).json({
          id,
          review_status: outcome,
          reviewed_at: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/security-flags',
    requirePermission('audit:read'),
    validate({ query: PaginationQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { limit } = res.locals.validated!.query as { limit: number };
        const pools = requirePools();

        const data = await withUserTx(pools, auth, async (tx) => {
          const rows = await sql<{
            id: string;
            user_id: string;
            flag_type: string;
            details: Record<string, unknown>;
            created_at: string;
          }>`
            select l.id::text, coalesce(l.actor_id, l.resource_id) as user_id, l.action as flag_type, l.metadata as details, l.occurred_at::text as created_at
              from private.admin_search_audit(null, null, null, 'denied'::audit.outcome, null, null, ${limit}, null) l
             where coalesce(l.actor_id, l.resource_id) is not null
          `.execute(tx);

          return rows.rows.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            flag_type: r.flag_type,
            details: r.details,
            created_at: new Date(r.created_at).toISOString(),
            resolved_at: null,
          }));
        });

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/drug-requests/:id/resolve',
    requirePermission('drug_catalog:manage'),
    validate({ params: IdParamSchema, body: AdminResolveDrugRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const { action, drug_id } = res.locals.validated!.body as {
          action: 'added' | 'rejected';
          drug_id?: string;
        };
        const pools = requirePools();

        const row = await withUserTx(pools, auth, async (tx) => {
          const updated = await tx
            .updateTable('app.drug_requests')
            .set({
              status: action,
              resolved_by: auth.userId,
              resolved_drug_id: drug_id ?? null,
              resolved_at: sql`now()`,
            })
            .where('id', '=', id)
            .returning(['id', 'status'])
            .executeTakeFirst();
          if (!updated) throw new AppError('RESOURCE_NOT_FOUND');

          await writeAuditLog(tx, auth, {
            action: 'DRUG_REQUEST_RESOLVED',
            resourceType: 'drug_request',
            resourceId: id,
            metadata: { status: action },
          });
          return updated;
        });

        res.status(200).json({ id: row.id, status: row.status });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/admin/metrics',
    requirePermission('audit:read'),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const pools = requirePools();

        const metrics = await withUserTx(pools, auth, async (tx) => {
          const kpiRes = await sql<{
            active_patients: string;
            rx_issued_7d: string;
            rx_dispensed_7d: string;
            enrolled_patients: string;
            ai_red_flags_7d: string;
          }>`
            select
              (select count(*)::text from app.profiles where role = 'patient' and status = 'active') as active_patients,
              (select count(*)::text from app.prescriptions where issued_at >= now() - interval '7 days') as rx_issued_7d,
              (select count(*)::text from app.prescriptions where issued_at >= now() - interval '7 days' and status in ('dispensed','partially_dispensed')) as rx_dispensed_7d,
              (select count(distinct patient_id)::text from biometric.face_templates where is_active) as enrolled_patients,
              (select count(*)::text from app.assistant_messages where created_at >= now() - interval '7 days' and red_flag) as ai_red_flags_7d
          `.execute(tx);

          const docOverrides = await sql<{
            doctor_id: string;
            doctor_name: string;
            override_rate: string;
          }>`
            select
              ca.doctor_id,
              p.full_name as doctor_name,
              round((count(*) filter (where ca.overridden)::numeric / greatest(count(*), 1)), 4)::text as override_rate
            from app.clinical_alerts ca
            join app.profiles p on p.id = ca.doctor_id
            group by ca.doctor_id, p.full_name
            order by override_rate desc
            limit 10
          `.execute(tx);

          const row = kpiRes.rows[0]!;
          const activePatients = Number.parseInt(row.active_patients, 10);
          const issued7d = Number.parseInt(row.rx_issued_7d, 10);
          const dispensed7d = Number.parseInt(row.rx_dispensed_7d, 10);
          const enrolled = Number.parseInt(row.enrolled_patients, 10);

          return {
            active_patients: activePatients,
            rx_issued_7d: issued7d,
            dispense_rate: issued7d > 0 ? Number((dispensed7d / issued7d).toFixed(4)) : 0,
            override_rate_by_doctor: docOverrides.rows.map((d) => ({
              doctor_id: d.doctor_id,
              doctor_name: d.doctor_name,
              override_rate: Number.parseFloat(d.override_rate),
            })),
            face_enrolment_coverage:
              activePatients > 0 ? Number((enrolled / activePatients).toFixed(4)) : 0,
            ai_red_flags_7d: Number.parseInt(row.ai_red_flags_7d, 10),
          };
        });

        res.status(200).json(metrics);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
