import type { AccountStatus, AppRole, LicenseStatus } from '@smarthealth/contracts';
import { sql } from 'kysely';
import type { Redis } from 'ioredis';
import type { DbPools } from '../db/pool.js';
import { withSystemTx } from '../db/with-user-tx.js';
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
  pools: DbPools,
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

      const record = await withSystemTx(pools, async (tx) => {
        const res = await sql<{
          id: string;
          role: AppRole;
          status: AccountStatus;
          session_epoch: number;
          full_name: string;
          preferred_locale: 'ar' | 'en';
          practitioner_type: 'doctor' | 'pharmacist' | 'paramedic' | null;
          license_number: string | null;
          license_status: LicenseStatus | null;
          license_expires_at: string | null;
          specialty_code: string | null;
          facility_ids: string[] | null;
        }>`
          select
            p.id,
            p.role,
            p.status,
            p.session_epoch,
            p.full_name,
            p.preferred_locale,
            pr.practitioner_type,
            pr.license_number,
            pr.license_status,
            pr.license_expires_at::text as license_expires_at,
            pr.specialty_code,
            coalesce(
              (select array_agg(pf.facility_id::text)
                 from app.practitioner_facilities pf
                where pf.practitioner_id = p.id and pf.ended_at is null),
              array[]::text[]
            ) as facility_ids
          from app.profiles p
          left join app.practitioners pr on pr.id = p.id
          where p.id = ${userId}::uuid
        `.execute(tx);

        const row = res.rows[0];
        if (!row) return null;

        const mapped: AuthContextRecord = {
          userId: row.id,
          role: row.role,
          status: row.status,
          sessionEpoch: row.session_epoch,
          fullName: row.full_name,
          preferredLocale: row.preferred_locale,
          practitionerType: row.practitioner_type,
          licenseNumber: row.license_number,
          licenseStatus: row.license_status,
          licenseExpiresAt: row.license_expires_at,
          licenceValid: isLicenceValid(row.license_status, row.license_expires_at),
          specialtyCode: row.specialty_code,
          facilityIds: row.facility_ids ?? [],
        };
        return mapped;
      });

      if (record && redis) {
        await redis.set(cacheKey, JSON.stringify(record), 'EX', 30);
      }
      return record;
    },

    async invalidate(userId: string): Promise<void> {
      if (redis) {
        await redis.del(`authctx:${userId}`);
      }
    },
  };
}
