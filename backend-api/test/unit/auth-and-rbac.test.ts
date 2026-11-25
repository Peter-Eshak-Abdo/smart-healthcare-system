import type { AppRole } from '@smarthealth/contracts';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createAppDeps } from '../../src/app-deps.js';
import type { AuthContextRecord } from '../../src/security/auth-context.js';
import { ROLE_PERMISSIONS } from '../../src/security/permissions.js';
import { createTestEnv } from '../helpers/keys.js';

function makeAuthCtx(overrides: Partial<AuthContextRecord> = {}): AuthContextRecord {
  return {
    userId: overrides.userId ?? randomUUID(),
    role: overrides.role ?? 'patient',
    status: overrides.status ?? 'active',
    sessionEpoch: overrides.sessionEpoch ?? 1,
    fullName: overrides.fullName ?? 'Test User',
    preferredLocale: 'ar',
    practitionerType: null,
    licenseNumber: null,
    licenseStatus: null,
    licenseExpiresAt: null,
    licenceValid: false,
    specialtyCode: null,
    facilityIds: [],
    ...overrides,
  };
}

describe('authentication and RBAC guards', () => {
  it('enforces separation of duties: admin role has zero clinical permissions', () => {
    const adminPerms = new Set<string>(ROLE_PERMISSIONS.admin);
    expect(adminPerms.has('patient_record:read:granted')).toBe(false);
    expect(adminPerms.has('patient_record:read:self')).toBe(false);
    expect(adminPerms.has('prescription:create')).toBe(false);
    expect(adminPerms.has('emergency_profile:read:session')).toBe(false);
    expect(adminPerms.has('audit:read')).toBe(true);
  });

  it('rejects missing bearer token with 401 AUTH_TOKEN_MISSING', async () => {
    const env = createTestEnv();
    const app = buildApp(env, { deps: createAppDeps(env) });

    const res = await request(app).get('/v1/me').set('Accept-Language', 'ar');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('rejects staff login without aal2 MFA claim (403 AUTH_MFA_REQUIRED)', async () => {
    const env = createTestEnv();
    const uid = randomUUID();
    const deps = createAppDeps(env, {
      verifyJwt: async () => ({
        sub: uid,
        exp: Math.floor(Date.now() / 1000) + 600,
        iat: Math.floor(Date.now() / 1000),
        aal: 'aal1',
        app_role: 'doctor',
        account_status: 'active',
        session_epoch: 1,
      }),
      authContext: {
        async load() {
          return makeAuthCtx({
            userId: uid,
            role: 'doctor',
            practitionerType: 'doctor',
            licenceValid: true,
            licenseStatus: 'verified',
          });
        },
        async invalidate() {},
      },
    });
    const app = buildApp(env, { deps });

    const res = await request(app).get('/v1/me').set('Authorization', 'Bearer test-jwt');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_MFA_REQUIRED');
  });

  it('rejects revoked session epoch and role mismatch with 401 AUTH_SESSION_REVOKED', async () => {
    const env = createTestEnv();
    const uid = randomUUID();
    const deps = createAppDeps(env, {
      verifyJwt: async () => ({
        sub: uid,
        exp: Math.floor(Date.now() / 1000) + 600,
        iat: Math.floor(Date.now() / 1000),
        aal: 'aal2',
        app_role: 'doctor',
        account_status: 'active',
        session_epoch: 1,
      }),
      authContext: {
        async load() {
          return makeAuthCtx({
            userId: uid,
            role: 'doctor',
            sessionEpoch: 2,
            practitionerType: 'doctor',
            licenceValid: true,
          });
        },
        async invalidate() {},
      },
    });
    const app = buildApp(env, { deps });

    const res = await request(app).get('/v1/me').set('Authorization', 'Bearer test-jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_SESSION_REVOKED');
  });

  it('rejects unverified/revoked practitioner license with 403 LICENSE_NOT_VALID', async () => {
    const env = createTestEnv();
    const uid = randomUUID();
    const deps = createAppDeps(env, {
      verifyJwt: async () => ({
        sub: uid,
        exp: Math.floor(Date.now() / 1000) + 600,
        iat: Math.floor(Date.now() / 1000),
        aal: 'aal2',
        app_role: 'doctor',
        account_status: 'active',
        session_epoch: 1,
      }),
      authContext: {
        async load() {
          return makeAuthCtx({
            userId: uid,
            role: 'doctor',
            practitionerType: 'doctor',
            licenseStatus: 'revoked',
            licenceValid: false,
          });
        },
        async invalidate() {},
      },
    });
    const app = buildApp(env, { deps });

    const res = await request(app).get('/v1/doctor/patients').set('Authorization', 'Bearer test-jwt');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LICENSE_NOT_VALID');
  });

  it('blocks unauthorized roles across patient, doctor, and admin endpoints with 403 RBAC_FORBIDDEN', async () => {
    const roleCases: Array<{ role: AppRole; method: 'get' | 'post'; path: string }> = [
      { role: 'patient', method: 'get', path: '/v1/admin/users' },
      { role: 'patient', method: 'get', path: '/v1/doctor/patients' },
      { role: 'doctor', method: 'get', path: '/v1/admin/audit-events' },
      { role: 'doctor', method: 'get', path: '/v1/patients/me/critical-info' },
      { role: 'admin', method: 'get', path: '/v1/doctor/patients' },
      { role: 'admin', method: 'get', path: '/v1/patients/me/medical-history' },
      { role: 'pharmacist', method: 'get', path: '/v1/admin/users' },
      { role: 'paramedic', method: 'get', path: '/v1/ref/drugs?query=panadol' },
    ];

    for (const tc of roleCases) {
      const env = createTestEnv();
      const uid = randomUUID();
      const deps = createAppDeps(env, {
        verifyJwt: async () => ({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 600,
          iat: Math.floor(Date.now() / 1000),
          auth_time: Math.floor(Date.now() / 1000),
          aal: 'aal2',
          app_role: tc.role,
          account_status: 'active',
          session_epoch: 1,
        }),
        authContext: {
          async load() {
            return makeAuthCtx({
              userId: uid,
              role: tc.role,
              practitionerType:
                tc.role === 'doctor' || tc.role === 'pharmacist' || tc.role === 'paramedic'
                  ? tc.role
                  : null,
              licenceValid: tc.role === 'doctor' || tc.role === 'pharmacist' || tc.role === 'paramedic',
            });
          },
          async invalidate() {},
        },
      });
      const app = buildApp(env, { deps });
      const res = await request(app)[tc.method](tc.path).set('Authorization', 'Bearer test-jwt');
      expect(res.status, `${tc.role} -> ${tc.path}`).toBe(403);
      expect(res.body.code).toBe('RBAC_FORBIDDEN');
    }
  });
});
