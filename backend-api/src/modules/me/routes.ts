import { PatchMeRequestSchema } from '@smarthealth/contracts';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type FacilityDoc,
  type PatientDoc,
  type PractitionerDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { STAFF_ROLES } from '../../security/permissions.js';
import { isMinorPatient } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';

export function meRoutes(deps: AppDeps): Router {
  const router = Router();

  async function buildMeDto(auth: NonNullable<Express.Locals['auth']>) {
    const db = requireDb(deps);
    const accountInfo = await deps.firebaseAdmin.getUserEmailAndMfa(auth.userId).catch(() => ({
      email: null,
      phone: null,
      mfaEnrolled: false,
    }));

    const userSnap = await db.collection(COLLECTIONS.users).doc(auth.userId).get();
    if (!userSnap.exists) {
      throw new AppError('RESOURCE_NOT_FOUND', { detail: 'profile_not_found' });
    }
    const profile = userSnap.data() as UserDoc & { phone_enc?: string | null };

    let decryptedPhone = accountInfo.phone ?? profile.phone ?? null;
    if (profile.phone_enc) {
      decryptedPhone = deps.fieldCipher.decrypt(
        profile.phone_enc,
        aad('users', 'phone_enc', profile.id),
      );
    }

    let patientSummary: { mrn: string | null; onboarded: boolean; is_minor: boolean } | null = null;
    if (profile.role === 'patient') {
      const patSnap = await db.collection(COLLECTIONS.patients).doc(auth.userId).get();
      if (patSnap.exists) {
        const pat = patSnap.data() as PatientDoc;
        patientSummary = {
          mrn: pat.mrn,
          onboarded: true,
          is_minor: isMinorPatient(pat.date_of_birth),
        };
      } else {
        patientSummary = { mrn: null, onboarded: false, is_minor: false };
      }
    }

    let practitionerSummary = null;
    if (
      profile.role === 'doctor' ||
      profile.role === 'pharmacist' ||
      profile.role === 'paramedic'
    ) {
      const prSnap = await db.collection(COLLECTIONS.practitioners).doc(auth.userId).get();
      if (prSnap.exists) {
        const pr = prSnap.data() as PractitionerDoc;
        let specialty: { code: string; name: { en: string; ar: string } } | null = null;
        if (pr.specialty_code) {
          const spSnap = await db
            .collection(COLLECTIONS.specialtiesReference)
            .doc(pr.specialty_code)
            .get();
          if (spSnap.exists) {
            const sp = spSnap.data() as { code: string; name_en: string; name_ar: string };
            specialty = { code: sp.code, name: { en: sp.name_en, ar: sp.name_ar } };
          }
        }

        const facilities: Array<{ id: string; name: string; type: FacilityDoc['type'] }> = [];
        for (const facId of pr.facility_ids ?? []) {
          const fSnap = await db.collection(COLLECTIONS.facilities).doc(facId).get();
          if (fSnap.exists) {
            const f = fSnap.data() as FacilityDoc;
            if (f.is_active) {
              facilities.push({ id: f.id, name: f.name, type: f.type });
            }
          }
        }

        practitionerSummary = {
          type: pr.practitioner_type,
          license_number: pr.license_number,
          license_status: pr.license_status,
          specialty,
          facilities,
          active_facility_id: pr.active_facility_id ?? facilities[0]?.id ?? null,
        };
      }
    }

    return {
      id: profile.id,
      role: profile.role,
      status: profile.status,
      full_name: profile.full_name,
      email: accountInfo.email ?? profile.email,
      phone: decryptedPhone,
      preferred_locale: profile.preferred_locale,
      mfa: {
        enrolled:
          accountInfo.mfaEnrolled || (STAFF_ROLES.has(profile.role) && auth.claims.aal === 'aal2'),
        aal: auth.claims.aal,
      },
      patient: patientSummary,
      practitioner: practitionerSummary,
      permissions: [...auth.permissions],
    };
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
        await deps.firebaseAdmin.requestPhoneChange(auth.userId, body.phone);
        res.status(202).json({ pending: 'phone_verification' });
        return;
      }

      const db = requireDb(deps);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.full_name !== undefined) updates.full_name = body.full_name;
      if (body.preferred_locale !== undefined) updates.preferred_locale = body.preferred_locale;

      await db.collection(COLLECTIONS.users).doc(auth.userId).update(updates);
      await writeAuditLog(db, auth, {
        action: 'PROFILE_UPDATED',
        resourceType: 'profile',
        resourceId: auth.userId,
        metadata: { fields: Object.keys(updates) },
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
