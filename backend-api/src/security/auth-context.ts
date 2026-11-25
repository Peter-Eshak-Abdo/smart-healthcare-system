import type { AccountStatus, AppRole, LicenseStatus } from '@smarthealth/contracts';
import type { Firestore } from 'firebase-admin/firestore';
import type { Redis } from 'ioredis';
import {
  COLLECTIONS,
  type PractitionerDoc,
  type UserDoc,
} from '../firebase/firestore-types.js';
import type { VerifiedClaims } from './jwt.js';
import type { Permission } from './permissions.js';

export interface AuthContextRecord {
  userId: string;
  role: AppRole;
  status: AccountStatus;
  sessionEpoch: number;
  fullName: string;
  preferredLocale: 'ar' | 'en';
  practitionerType: 'doctor' | 'pharmacist' | 'paramedic' | null;
  licenseNumber: string | null;
  licenseStatus: LicenseStatus | null;
  licenseExpiresAt: string | null;
  licenceValid: boolean;
  specialtyCode: string | null;
  facilityIds: string[];
}

export interface AuthLocals extends AuthContextRecord {
  claims: VerifiedClaims;
  permissions: ReadonlySet<Permission>;
}

export interface AuthContextService {
  load(userId: string): Promise<AuthContextRecord | null>;
  invalidate(userId: string): Promise<void>;
}

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
}

function isLicenceValid(
  status: LicenseStatus | null,
  expiresAt: string | null,
): boolean {
  if (status !== 'verified') return false;
  if (!expiresAt) return true;
  const today = new Date().toISOString().slice(0, 10);
  return expiresAt >= today;
}

export function createAuthContextService(
  db: Firestore,
  redis: Redis | RedisLike | null,
): AuthContextService {
  return {
    async load(userId: string): Promise<AuthContextRecord | null> {
      const cacheKey = `authctx:${userId}`;
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as AuthContextRecord;
        }
      }

      const userSnap = await db.collection(COLLECTIONS.users).doc(userId).get();
      if (!userSnap.exists) return null;
      const user = userSnap.data() as UserDoc;

      let prac: PractitionerDoc | null = null;
      if (user.role === 'doctor' || user.role === 'pharmacist' || user.role === 'paramedic') {
        const pracSnap = await db.collection(COLLECTIONS.practitioners).doc(userId).get();
        if (pracSnap.exists) {
          prac = pracSnap.data() as PractitionerDoc;
        }
      }

      const mapped: AuthContextRecord = {
        userId: user.id,
        role: user.role,
        status: user.status,
        sessionEpoch: user.session_epoch ?? 0,
        fullName: user.full_name,
        preferredLocale: user.preferred_locale ?? 'ar',
        practitionerType: prac?.practitioner_type ?? null,
        licenseNumber: prac?.license_number ?? null,
        licenseStatus: prac?.license_status ?? null,
        licenseExpiresAt: prac?.license_expires_at ?? null,
        licenceValid: isLicenceValid(
          prac?.license_status ?? null,
          prac?.license_expires_at ?? null,
        ),
        specialtyCode: prac?.specialty_code ?? null,
        facilityIds: prac?.facility_ids ?? [],
      };

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(mapped), 'EX', 60);
      }
      return mapped;
    },

    async invalidate(userId: string): Promise<void> {
      if (redis) {
        await redis.del(`authctx:${userId}`);
      }
    },
  };
}
