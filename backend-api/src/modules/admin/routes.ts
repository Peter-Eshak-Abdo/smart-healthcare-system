import { randomUUID } from 'node:crypto';
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
} from '@smarthealth/contracts';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type EmergencySessionDoc,
  type FacilityDoc,
  type PractitionerDoc,
  type PrescriptionDoc,
  type SystemLogDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission, requireRecentAuth } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { verifyAuditChain, writeAuditLog } from '../../security/audit.js';
import { AppError } from '../../shared/errors.js';

export function adminRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get(
    '/admin/users',
    requirePermission('user:manage'),
    validate({ query: AdminUsersQuerySchema }),
    async (_req, res, next) => {
      try {
        const query = res.locals.validated!.query as {
          role?: string;
          status?: string;
          query?: string;
          limit: number;
        };
        const db = requireDb(deps);
        const snap = await db.collection(COLLECTIONS.users).limit(200).get();
        let users = snap.docs.map((d) => d.data() as UserDoc);
        if (query.role) users = users.filter((u) => u.role === query.role);
        if (query.status) users = users.filter((u) => u.status === query.status);
        if (query.query) {
          const needle = query.query.toLowerCase();
          users = users.filter(
            (u) =>
              u.full_name.toLowerCase().includes(needle) ||
              (u.email ?? '').toLowerCase().includes(needle),
          );
        }

        const data = await Promise.all(
          users.slice(0, query.limit).map(async (u) => {
            const prSnap = await db.collection(COLLECTIONS.practitioners).doc(u.id).get();
            const pr = prSnap.exists ? (prSnap.data() as PractitionerDoc) : null;
            return {
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              role: u.role,
              status: u.status,
              created_at: u.created_at,
              practitioner: pr
                ? {
                    type: pr.practitioner_type,
                    license_number: pr.license_number,
                    license_status: pr.license_status,
                    license_expires_at: pr.license_expires_at,
                    specialty_code: pr.specialty_code,
                  }
                : null,
            };
          }),
        );
        res.status(200).json({ data, next_cursor: null });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/users',
    requirePermission('user:manage'),
    requireRecentAuth(600),
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
        const db = requireDb(deps);
        const invited = await deps.firebaseAdmin.inviteStaffUser({
          email: body.email,
          fullName: body.full_name,
          role: body.role,
          ...(body.role !== 'admin' ? { licenseStatus: 'pending' } : {}),
          facilityId: body.practitioner?.facility_ids[0] ?? null,
        });
        const nowIso = new Date().toISOString();

        const batch = db.batch();
        batch.set(db.collection(COLLECTIONS.users).doc(invited.id), {
          id: invited.id,
          role: body.role,
          status: 'active',
          session_epoch: 0,
          full_name: body.full_name,
          email: body.email,
          phone: null,
          preferred_locale: 'ar',
          created_at: nowIso,
          updated_at: nowIso,
        } satisfies UserDoc);

        if (body.role !== 'admin' && body.practitioner) {
          batch.set(db.collection(COLLECTIONS.practitioners).doc(invited.id), {
            id: invited.id,
            practitioner_type: body.role,
            license_number: body.practitioner.license_number,
            license_authority: body.practitioner.license_authority ?? null,
            license_status: 'pending',
            license_expires_at: body.practitioner.license_expires_at,
            license_status_changed_at: nowIso,
            specialty_code: body.practitioner.specialty_code ?? null,
            facility_ids: body.practitioner.facility_ids,
            active_facility_id: body.practitioner.facility_ids[0] ?? null,
            created_at: nowIso,
          } satisfies PractitionerDoc);
        }
        await batch.commit();

        await writeAuditLog(db, auth, {
          action: 'ADMIN_USER_INVITED',
          resourceType: 'user',
          resourceId: invited.id,
          metadata: { role: body.role },
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
    requireRecentAuth(600),
    validate({ params: IdParamSchema, body: AdminSetUserStatusRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as {
          status: 'suspended' | 'active' | 'deactivated';
          reason: string;
        };
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.users).doc(id);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const user = snap.data() as UserDoc;
        await ref.update({
          status: body.status,
          session_epoch: user.session_epoch + 1,
          updated_at: new Date().toISOString(),
        });
        await deps.firebaseAdmin.setCustomClaims(id, {
          status: body.status,
          session_epoch: user.session_epoch + 1,
        });
        await deps.firebaseAdmin.signOutUserGlobal(id);
        await deps.authContext.invalidate(id);

        await writeAuditLog(db, auth, {
          action: 'ADMIN_USER_STATUS_CHANGED',
          resourceType: 'user',
          resourceId: id,
          reason: body.reason,
          metadata: { status: body.status },
        });
        res.status(200).json({ id, status: body.status });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admin/users/:id/role',
    requirePermission('role:assign'),
    requireRecentAuth(600),
    validate({ params: IdParamSchema, body: AdminSetUserRoleRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as { role: UserDoc['role']; reason: string };
        const db = requireDb(deps);
        const approvalId = randomUUID();
        await db.collection(COLLECTIONS.pendingApprovals).doc(approvalId).set({
          id: approvalId,
          target_user_id: id,
          new_role: body.role,
          reason: body.reason,
          requested_by: auth.userId,
          approved_by: null,
          executed: false,
          created_at: new Date().toISOString(),
        });
        await writeAuditLog(db, auth, {
          action: 'ROLE_CHANGE_REQUESTED',
          resourceType: 'pending_approval',
          resourceId: approvalId,
          metadata: { target_user_id: id, role: body.role },
        });
        res.status(202).json({ pending_approval_id: approvalId });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/admin/approvals/:id/approve',
    requirePermission('role:assign'),
    requireRecentAuth(600),
    validate({ params: IdParamSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.pendingApprovals).doc(id);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const ap = snap.data() as {
          id: string;
          target_user_id: string;
          new_role: UserDoc['role'];
          requested_by: string;
          executed: boolean;
        };
        if (ap.requested_by === auth.userId) {
          throw new AppError('RBAC_FORBIDDEN', { detail: 'two_person_rule_requires_second_admin' });
        }
        if (!ap.executed) {
          await db.collection(COLLECTIONS.users).doc(ap.target_user_id).update({
            role: ap.new_role,
            updated_at: new Date().toISOString(),
          });
          await deps.firebaseAdmin.setCustomClaims(ap.target_user_id, { role: ap.new_role });
          await ref.update({
            approved_by: auth.userId,
            executed: true,
            approved_at: new Date().toISOString(),
          });
          await deps.authContext.invalidate(ap.target_user_id);
        }
        res.status(200).json({ id, approved: true, executed: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/admin/practitioners/:id/license',
    requirePermission('license:manage'),
    requireRecentAuth(600),
    validate({ params: IdParamSchema, body: AdminSetLicenseStatusRequestSchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as {
          license_status: PractitionerDoc['license_status'];
          reason: string;
          license_expires_at?: string;
        };
        const db = requireDb(deps);
        const nowIso = new Date().toISOString();
        const ref = db.collection(COLLECTIONS.practitioners).doc(id);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        await ref.update({
          license_status: body.license_status,
          license_status_changed_at: nowIso,
          ...(body.license_expires_at ? { license_expires_at: body.license_expires_at } : {}),
        });
        await deps.firebaseAdmin.setCustomClaims(id, { licenseStatus: body.license_status });
        await deps.authContext.invalidate(id);

        await writeAuditLog(db, auth, {
          action: 'LICENSE_STATUS_UPDATED',
          resourceType: 'practitioner',
          resourceId: id,
          reason: body.reason,
          metadata: { license_status: body.license_status },
        });
        res.status(200).json({
          id,
          license_status: body.license_status,
          license_status_changed_at: nowIso,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/admin/facilities', requirePermission('facility:manage'), async (_req, res, next) => {
    try {
      const db = requireDb(deps);
      const snap = await db.collection(COLLECTIONS.facilities).limit(200).get();
      res.status(200).json({ data: snap.docs.map((d) => d.data() as FacilityDoc) });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/admin/facilities',
    requirePermission('facility:manage'),
    validate({ body: AdminFacilityInputSchema }),
    async (_req, res, next) => {
      try {
        const body = res.locals.validated!.body as {
          name: string;
          type: FacilityDoc['type'];
          address?: string;
          phone?: string;
          license_number?: string;
        };
        const db = requireDb(deps);
        const id = randomUUID();
        const doc: FacilityDoc = {
          id,
          name: body.name,
          type: body.type,
          address: body.address ?? null,
          phone: body.phone ?? null,
          license_number: body.license_number ?? null,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        await db.collection(COLLECTIONS.facilities).doc(id).set(doc);
        res.status(201).json(doc);
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
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as Record<string, unknown>;
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.facilities).doc(id);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        await ref.update(body);
        const updated = (await ref.get()).data() as FacilityDoc;
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
        const { id } = res.locals.validated!.params as { id: string };
        const { practitioner_id } = res.locals.validated!.body as { practitioner_id: string };
        const db = requireDb(deps);
        const ref = db.collection(COLLECTIONS.practitioners).doc(practitioner_id);
        const snap = await ref.get();
        if (!snap.exists) throw new AppError('RESOURCE_NOT_FOUND');
        const pr = snap.data() as PractitionerDoc;
        const facilityIds = [...new Set([...(pr.facility_ids ?? []), id])];
        await ref.update({
          facility_ids: facilityIds,
          active_facility_id: pr.active_facility_id ?? id,
        });
        await deps.authContext.invalidate(practitioner_id);
        res.status(200).json({ facility_id: id, practitioner_id, added: true });
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
        const query = res.locals.validated!.query as {
          action?: string;
          outcome?: string;
          limit: number;
        };
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.systemLogs)
          .orderBy('seq', 'desc')
          .limit(query.limit)
          .get();

        let rows = snap.docs.map((d) => d.data() as SystemLogDoc);
        if (query.action) rows = rows.filter((r) => r.action.includes(query.action!));
        if (query.outcome) rows = rows.filter((r) => r.outcome === query.outcome);

        res.status(200).json({
          data: rows.map((r) => ({
            id: r.id,
            occurred_at: r.occurred_at,
            actor: { id: r.actor_id, name: r.actor_name, role: r.actor_role },
            action: r.action,
            resource_type: r.resource_type,
            resource_id: r.resource_id,
            patient_mrn_last4: r.patient_mrn_last4,
            outcome: r.outcome,
            reason: r.reason,
            ip: r.ip,
          })),
          next_cursor: null,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/admin/audit-events/export', requirePermission('audit:read'), async (_req, res, next) => {
    try {
      const db = requireDb(deps);
      const snap = await db
        .collection(COLLECTIONS.systemLogs)
        .orderBy('seq', 'desc')
        .limit(1000)
        .get();
      const lines = ['seq,id,occurred_at,actor_id,actor_role,action,resource_type,outcome'];
      for (const d of snap.docs) {
        const r = d.data() as SystemLogDoc;
        lines.push(
          [r.seq, r.id, r.occurred_at, r.actor_id ?? '', r.actor_role ?? '', r.action, r.resource_type, r.outcome].join(','),
        );
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send(lines.join('\n'));
    } catch (err) {
      next(err);
    }
  });

  router.get('/admin/audit-integrity', requirePermission('audit:read'), async (_req, res, next) => {
    try {
      const db = requireDb(deps);
      const result = await verifyAuditChain(db);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/admin/emergency-sessions',
    requirePermission('emergency_session:review'),
    validate({ query: AdminEmergencySessionsQuerySchema }),
    async (_req, res, next) => {
      try {
        const query = res.locals.validated!.query as { review_status?: string; limit: number };
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.emergencySessions)
          .orderBy('started_at', 'desc')
          .limit(query.limit)
          .get();
        let rows = snap.docs.map((d) => d.data() as EmergencySessionDoc);
        if (query.review_status) rows = rows.filter((r) => r.review_status === query.review_status);

        res.status(200).json({
          data: rows.map((r) => ({
            id: r.id,
            paramedic: { id: r.paramedic_id, name: r.paramedic_name },
            patient_mrn_last4: r.patient_mrn_last4,
            method: r.method,
            low_confidence: r.low_confidence,
            match_score_band: r.match_score_band,
            started_at: r.started_at,
            reason_code: r.reason_code,
            review_status: r.review_status,
          })),
          next_cursor: null,
        });
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
        const body = res.locals.validated!.body as {
          outcome: 'appropriate' | 'inappropriate';
          note: string;
        };
        const db = requireDb(deps);
        const reviewedAt = new Date().toISOString();
        await db.collection(COLLECTIONS.emergencySessions).doc(id).update({
          review_status: body.outcome,
          review_note: body.note,
          reviewed_by: auth.userId,
          reviewed_at: reviewedAt,
        });
        res.status(200).json({ id, review_status: body.outcome, reviewed_at: reviewedAt });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/admin/security-flags', requirePermission('audit:read'), async (_req, res, next) => {
    try {
      const db = requireDb(deps);
      const snap = await db.collection(COLLECTIONS.securityFlags).limit(100).get();
      res.status(200).json({ data: snap.docs.map((d) => d.data()) });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/admin/drug-requests/:id/resolve',
    requirePermission('drug_catalog:manage'),
    validate({ params: IdParamSchema, body: AdminResolveDrugRequestSchema }),
    async (_req, res, next) => {
      try {
        const { id } = res.locals.validated!.params as { id: string };
        const body = res.locals.validated!.body as { action: 'added' | 'rejected' };
        res.status(200).json({ id, status: body.action });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/admin/metrics', requirePermission('audit:read'), async (_req, res, next) => {
    try {
      const db = requireDb(deps);
      const [patSnap, rxSnap, bioSnap] = await Promise.all([
        db.collection(COLLECTIONS.patients).get(),
        db.collection(COLLECTIONS.prescriptions).get(),
        db
          .collection(COLLECTIONS.biometricTemplates)
          .where('status', '==', 'active')
          .get(),
      ]);
      const rxs = rxSnap.docs.map((d) => d.data() as PrescriptionDoc);
      const dispensedCount = rxs.filter((r) => r.status === 'dispensed').length;
      const enrolledPatients = new Set(bioSnap.docs.map((d) => String(d.data().patient_id))).size;

      res.status(200).json({
        active_patients: patSnap.size,
        rx_issued_7d: rxs.length,
        dispense_rate: rxs.length > 0 ? Number((dispensedCount / rxs.length).toFixed(3)) : 0,
        override_rate_by_doctor: [],
        face_enrolment_coverage:
          patSnap.size > 0 ? Number((enrolledPatients / patSnap.size).toFixed(3)) : 0,
        ai_red_flags_7d: 0,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
