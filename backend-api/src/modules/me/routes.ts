import { PatchMeRequestSchema } from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { validate } from '../../middleware/validate.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { STAFF_ROLES } from '../../security/permissions.js';
import { writeAuditLog } from '../../security/audit.js';
import { isMinorPatient } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';
import { getAuthSupabasePort } from '../auth/routes.js';

export function meRoutes(deps: AppDeps): Router {
  const router = Router();
  const sbPort = getAuthSupabasePort(deps);

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  async function buildMeDto(auth: NonNullable<Express.Locals['auth']>) {
    const pools = requirePools();
    const accountInfo = await sbPort.getUserEmailAndMfa(auth.userId).catch(() => ({
      email: null,
      phone: null,
      mfaEnrolled: false,
    }));

    return withUserTx(pools, auth, async (tx) => {
      const profile = await tx
        .selectFrom('app.profiles')
        .select(['id', 'role', 'status', 'full_name', 'phone_enc', 'preferred_locale'])
        .where('id', '=', auth.userId)
        .executeTakeFirstOrThrow();

      let decryptedPhone = accountInfo.phone;
      if (profile.phone_enc) {
        decryptedPhone = deps.fieldCipher.decrypt(
          profile.phone_enc,
          aad('profiles', 'phone_enc', profile.id),
        );
      }

      let patientSummary: { mrn: string | null; onboarded: boolean; is_minor: boolean } | null =
        null;
      if (profile.role === 'patient') {
        const pat = await tx
          .selectFrom('app.patients')
          .select(['mrn', 'date_of_birth'])
          .where('id', '=', auth.userId)
          .executeTakeFirst();
        patientSummary = pat
          ? { mrn: pat.mrn, onboarded: true, is_minor: isMinorPatient(pat.date_of_birth) }
          : { mrn: null, onboarded: false, is_minor: false };
      }

      let practitionerSummary = null;
      if (
        profile.role === 'doctor' ||
        profile.role === 'pharmacist' ||
        profile.role === 'paramedic'
      ) {
        const pr = await tx
          .selectFrom('app.practitioners')
          .select([
            'practitioner_type',
            'license_number',
            'license_status',
            'specialty_code',
          ])
          .where('id', '=', auth.userId)
          .executeTakeFirst();

        if (pr) {
          let specialty = null;
          if (pr.specialty_code) {
            const sp = await tx
              .selectFrom('ref.specialties')
              .select(['code', 'name_en', 'name_ar'])
              .where('code', '=', pr.specialty_code)
              .executeTakeFirst();
            if (sp) {
              specialty = {
                code: sp.code,
                name: { en: sp.name_en, ar: sp.name_ar },
              };
            }
          }

          const facs = await sql<{ id: string; name: string; type: 'hospital' | 'clinic' | 'pharmacy' | 'ambulance_service' }>`
            select f.id, f.name, f.type
              from app.practitioner_facilities pf
              join app.facilities f on f.id = pf.facility_id
             where pf.practitioner_id = ${auth.userId}::uuid
               and pf.ended_at is null
               and f.is_active
             order by pf.started_at asc
          `.execute(tx);

          practitionerSummary = {
            type: pr.practitioner_type,
            license_number: pr.license_number,
            license_status: pr.license_status,
            specialty,
            facilities: facs.rows,
            active_facility_id: facs.rows[0]?.id ?? null,
          };
        }
      }

      return {
        id: profile.id,
        role: profile.role,
        status: profile.status,
        full_name: profile.full_name,
        email: accountInfo.email,
        phone: decryptedPhone,
        preferred_locale: profile.preferred_locale,
        mfa: {
          enrolled: accountInfo.mfaEnrolled || (STAFF_ROLES.has(profile.role) && auth.claims.aal === 'aal2'),
          aal: auth.claims.aal,
        },
        patient: patientSummary,
        practitioner: practitionerSummary,
        permissions: [...auth.permissions],
      };
    });
  }

  router.get('/me', async (_req, res, next) => {
    try {
      const auth = res.locals.auth!;
      const dto = await buildMeDto(auth);
      res.status(200).json(dto);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/me', validate({ body: PatchMeRequestSchema }), async (_req, res, next) => {
    try {
      const auth = res.locals.auth!;
      const body = res.locals.validated!.body as {
        full_name?: string;
        phone?: string;
        preferred_locale?: 'ar' | 'en';
      };

      if (body.phone) {
        await sbPort.requestPhoneChange(auth.userId, body.phone);
        res.status(202).json({ pending: 'phone_verification' });
        return;
      }

      const pools = requirePools();
      await withUserTx(pools, auth, async (tx) => {
        const updates: Record<string, unknown> = {};
        if (body.full_name !== undefined) updates.full_name = body.full_name;
        if (body.preferred_locale !== undefined) updates.preferred_locale = body.preferred_locale;

        await tx
          .updateTable('app.profiles')
          .set(updates)
          .where('id', '=', auth.userId)
          .execute();

        await writeAuditLog(tx, auth, {
          action: 'PROFILE_UPDATED',
          resourceType: 'profile',
          resourceId: auth.userId,
          metadata: { fields: Object.keys(updates) },
        });
      });

      await deps.authContext.invalidate(auth.userId);
      const dto = await buildMeDto(auth);
      res.status(200).json(dto);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
