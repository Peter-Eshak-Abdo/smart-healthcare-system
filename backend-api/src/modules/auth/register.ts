import { randomInt } from 'node:crypto';
import type {
  LicenseStatus,
  RegisterAccountRequest,
  RegisterAccountResponse,
} from '@smarthealth/contracts';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { AppDeps } from '../../app-deps.js';
import {
  COLLECTIONS,
  type ConsentDoc,
  type FacilityDoc,
  type PatientDoc,
  type PractitionerDoc,
  type UserDoc,
} from '../../firebase/firestore-types.js';
import { writeAuditLog } from '../../security/audit.js';
import { aad } from '../../security/crypto/field-cipher.js';
import { validateEgyptianNationalId } from '../../shared/egyptian-id.js';
import { AppError } from '../../shared/errors.js';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TERMS_VERSION = '2026-11';

/** Canonical MRN: `SH-` + 8 Crockford base32 chars (docs/00-INDEX §10). */
export function generateMrn(): string {
  let out = 'SH-';
  for (let i = 0; i < 8; i += 1) out += CROCKFORD[randomInt(0, CROCKFORD.length)];
  return out;
}

export function normalizePhone(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw.trim(), 'EG');
  if (!parsed || !parsed.isValid()) {
    throw new AppError('VALIDATION_FAILED', {
      detail: 'invalid_phone',
      errors: [{ path: 'phone', code: 'custom', message: 'invalid_phone' }],
    });
  }
  return parsed.number;
}

function isPractitionerRole(
  role: RegisterAccountRequest['role'],
): role is 'doctor' | 'pharmacist' | 'paramedic' {
  return role === 'doctor' || role === 'pharmacist' || role === 'paramedic';
}

/** Staff licences auto-verify only when explicitly enabled AND never in staging/production. */
export function shouldAutoVerifyStaff(env: AppDeps['env']): boolean {
  const flag = String((env as Record<string, unknown>).DEV_AUTO_VERIFY_STAFF ?? '') === 'true';
  return flag && (env.APP_ENV === 'local' || env.APP_ENV === 'test');
}

function mapFirebaseAuthError(err: unknown): AppError | null {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/email-already-exists':
      return new AppError('CONFLICT_VERSION', {
        detail: 'email_already_registered',
        errors: [{ path: 'email', code: 'custom', message: 'email_already_registered' }],
      });
    case 'auth/phone-number-already-exists':
      return new AppError('CONFLICT_VERSION', {
        detail: 'phone_already_registered',
        errors: [{ path: 'phone', code: 'custom', message: 'phone_already_registered' }],
      });
    case 'auth/invalid-password':
      return new AppError('VALIDATION_FAILED', {
        detail: 'weak_password',
        errors: [{ path: 'password', code: 'custom', message: 'weak_password' }],
      });
    case 'auth/invalid-email':
      return new AppError('VALIDATION_FAILED', {
        detail: 'invalid_email',
        errors: [{ path: 'email', code: 'custom', message: 'invalid_email' }],
      });
    case 'auth/invalid-phone-number':
      return new AppError('VALIDATION_FAILED', {
        detail: 'invalid_phone',
        errors: [{ path: 'phone', code: 'custom', message: 'invalid_phone' }],
      });
    default:
      return null;
  }
}

/**
 * Creates the Firebase Auth user, its custom claims and every Firestore profile document
 * atomically (Auth user is deleted again if any Firestore write fails), so the client can
 * immediately `signInWithEmailAndPassword` and receive a token that already carries claims.
 */
export async function registerAccount(
  deps: AppDeps,
  body: RegisterAccountRequest,
): Promise<RegisterAccountResponse> {
  const db = deps.db;
  const fbAuth = deps.fbAuth;
  if (!db || !fbAuth) {
    throw new AppError('INTERNAL_ERROR', { detail: 'firebase_not_configured' });
  }

  const phone = normalizePhone(body.phone);
  if (body.national_id) {
    validateEgyptianNationalId(body.national_id, body.date_of_birth);
  }

  // Duplicate national ID check (blind index) happens before any account is created.
  const idBlindIndex = body.national_id
    ? deps.fieldCipher.blindIndex(`national_id:${body.national_id}`, 'id_document').toString('hex')
    : null;
  if (body.role === 'patient' && idBlindIndex) {
    const dup = await db
      .collection(COLLECTIONS.patients)
      .where('id_document_blind_index', '==', idBlindIndex)
      .limit(1)
      .get();
    if (!dup.empty) {
      throw new AppError('CONFLICT_VERSION', {
        detail: 'duplicate_national_id',
        errors: [{ path: 'national_id', code: 'custom', message: 'duplicate_national_id' }],
      });
    }
  }

  let facility: FacilityDoc | null = null;
  if (isPractitionerRole(body.role) && body.facility_id) {
    const fSnap = await db.collection(COLLECTIONS.facilities).doc(body.facility_id).get();
    if (!fSnap.exists || (fSnap.data() as FacilityDoc).is_active === false) {
      throw new AppError('VALIDATION_FAILED', {
        detail: 'unknown_facility',
        errors: [{ path: 'facility_id', code: 'custom', message: 'unknown_facility' }],
      });
    }
    facility = fSnap.data() as FacilityDoc;
  }

  let uid: string;
  try {
    const created = await fbAuth.createUser({
      email: body.email,
      password: body.password,
      displayName: body.full_name,
      phoneNumber: phone,
      emailVerified: false,
    });
    uid = created.uid;
  } catch (err) {
    throw mapFirebaseAuthError(err) ?? err;
  }

  const nowIso = new Date().toISOString();
  const licenseStatus: LicenseStatus | null = isPractitionerRole(body.role)
    ? shouldAutoVerifyStaff(deps.env)
      ? 'verified'
      : 'pending'
    : null;
  const mrn = body.role === 'patient' ? generateMrn() : null;

  try {
    await fbAuth.setCustomUserClaims(uid, {
      role: body.role,
      status: 'active',
      session_epoch: 0,
      ...(licenseStatus ? { licenseStatus } : {}),
      ...(facility ? { facilityId: facility.id } : {}),
    });

    const batch = db.batch();
    batch.set(db.collection(COLLECTIONS.users).doc(uid), {
      id: uid,
      role: body.role,
      status: 'active',
      session_epoch: 0,
      full_name: body.full_name,
      email: body.email,
      phone,
      preferred_locale: body.preferred_locale,
      created_at: nowIso,
      updated_at: nowIso,
    } satisfies UserDoc);

    if (body.role === 'patient' && body.national_id && idBlindIndex && mrn) {
      batch.set(db.collection(COLLECTIONS.patients).doc(uid), {
        id: uid,
        mrn,
        mrn_last4: mrn.slice(-4),
        id_document_type: 'national_id',
        id_document_blind_index: idBlindIndex,
        id_document_number_enc: deps.fieldCipher.encrypt(
          body.national_id,
          aad('patients', 'id_document_number_enc', uid),
        ),
        date_of_birth: body.date_of_birth,
        sex: body.sex,
        blood_type: body.blood_type ?? 'unknown',
        blood_type_source: 'patient_reported',
        blood_type_confirmed_at: null,
        created_at: nowIso,
      } satisfies PatientDoc);
      const cid = `${uid}_terms_of_service`;
      batch.set(db.collection(COLLECTIONS.consents).doc(cid), {
        id: cid,
        patient_id: uid,
        type: 'terms_of_service',
        version: TERMS_VERSION,
        granted: true,
        recorded_at: nowIso,
      } satisfies ConsentDoc);
    } else if (isPractitionerRole(body.role) && licenseStatus) {
      const expires = new Date();
      expires.setUTCFullYear(expires.getUTCFullYear() + 1);
      batch.set(db.collection(COLLECTIONS.practitioners).doc(uid), {
        id: uid,
        practitioner_type: body.role,
        license_number: body.license_number ?? '',
        license_authority: null,
        license_status: licenseStatus,
        license_expires_at: expires.toISOString().slice(0, 10),
        license_status_changed_at: nowIso,
        specialty_code: body.specialty_code ?? null,
        facility_ids: facility ? [facility.id] : [],
        active_facility_id: facility?.id ?? null,
        created_at: nowIso,
      } satisfies PractitionerDoc);
    }
    await batch.commit();
  } catch (err) {
    // Roll back the Auth user so the email can be used again after fixing the problem.
    await fbAuth.deleteUser(uid).catch(() => undefined);
    throw err;
  }

  await writeAuditLog(
    db,
    { userId: uid, role: body.role, fullName: body.full_name },
    {
      action: 'ACCOUNT_REGISTERED',
      resourceType: 'user',
      resourceId: uid,
      ...(mrn ? { patientId: uid, patientMrnLast4: mrn.slice(-4) } : {}),
      metadata: { role: body.role, license_status: licenseStatus },
    },
  ).catch((err: unknown) => deps.logger.warn({ err }, 'audit log for registration failed'));

  return {
    user_id: uid,
    role: body.role,
    status: 'active',
    license_status: licenseStatus,
    mrn,
    created_at: nowIso,
  };
}
