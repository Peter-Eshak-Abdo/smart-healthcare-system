import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTestEnv } from './helpers/keys.js';

describe('system endpoints', () => {
  const env = createTestEnv({
    MIN_CLIENT_VERSION_ANDROID: '1.2.0',
  });
  const app = buildApp(env);

  it('GET /v1/health returns liveness ok', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      version: '1.0.0',
      commit: 'test-sha',
    });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /v1/.well-known/rx-jwks.json exposes Ed25519 verification key', async () => {
    const res = await request(app).get('/v1/.well-known/rx-jwks.json');
    expect(res.status).toBe(200);
    expect(res.body.keys).toHaveLength(1);
    expect(res.body.keys[0]).toMatchObject({
      kty: 'OKP',
      crv: 'Ed25519',
      kid: 'rx-2026-11',
      use: 'sig',
      alg: 'EdDSA',
    });
  });

  it('GET /v1/.well-known/emergency-card-jwks.json exposes Ed25519 verification key', async () => {
    const res = await request(app).get('/v1/.well-known/emergency-card-jwks.json');
    expect(res.status).toBe(200);
    expect(res.body.keys[0]).toMatchObject({
      kty: 'OKP',
      crv: 'Ed25519',
      kid: 'ec-2026-11',
    });
  });

  it('GET /v1/config/mobile returns versions and emergency phone', async () => {
    const res = await request(app).get('/v1/config/mobile');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      min_version: { android: '1.2.0', ios: '1.0.0' },
      emergency_phone: '123',
      feature_flags: { er_intake: false, passkey: false },
    });
  });

  it('enforces minimum X-Client version with 426 Upgrade Required', async () => {
    const res = await request(app)
      .get('/v1/me')
      .set('X-Client', 'mobile-android/1.0.0')
      .set('Accept-Language', 'ar');
    expect(res.status).toBe(426);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.status).toBe(426);
  });
});
