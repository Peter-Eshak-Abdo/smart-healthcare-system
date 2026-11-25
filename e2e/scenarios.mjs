#!/usr/bin/env node
import process from 'node:process';
import assert from 'node:assert/strict';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:4000';

async function checkHealthAndJwks() {
  const health = await fetch(`${API_BASE}/v1/health`, {
    headers: { 'X-Client': 'e2e/1.0.0' },
  });
  assert.equal(health.status, 200, 'health endpoint must return 200');

  const rxJwks = await fetch(`${API_BASE}/v1/.well-known/rx-jwks.json`, {
    headers: { 'X-Client': 'e2e/1.0.0' },
  });
  assert.equal(rxJwks.status, 200, 'rx-jwks endpoint must return 200');
  const rxKeys = await rxJwks.json();
  assert.ok(Array.isArray(rxKeys.keys), 'rx-jwks keys must be an array');

  const ecJwks = await fetch(`${API_BASE}/v1/.well-known/emergency-card-jwks.json`, {
    headers: { 'X-Client': 'e2e/1.0.0' },
  });
  assert.equal(ecJwks.status, 200, 'emergency-card-jwks must return 200');
}

async function runAuthenticatedFlows() {
  const patientToken = process.env.E2E_PATIENT_TOKEN;
  const doctorToken = process.env.E2E_DOCTOR_TOKEN;
  const pharmToken = process.env.E2E_PHARMACIST_TOKEN;
  const adminToken = process.env.E2E_ADMIN_TOKEN;
  if (!patientToken || !doctorToken || !pharmToken || !adminToken) {
    console.log('Skipping live authenticated E2E scenario: role JWT env vars not set.');
    return;
  }

  // Verify zero unauthenticated PHI access (P1)
  const unauthRes = await fetch(`${API_BASE}/v1/patients/me/critical-info`, {
    headers: { 'X-Client': 'e2e/1.0.0' },
  });
  assert.equal(unauthRes.status, 401, 'unauthenticated clinical read must return 401');

  // Verify admin audit chain integrity endpoint
  const chainRes = await fetch(`${API_BASE}/v1/admin/audit-integrity`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'X-Client': 'e2e/1.0.0',
    },
  });
  assert.equal(chainRes.status, 200);
  const chainBody = await chainRes.json();
  assert.equal(chainBody.status, 'ok', 'audit chain must verify clean');
}

await checkHealthAndJwks();
await runAuthenticatedFlows();
console.log('E2E checks completed cleanly.');
