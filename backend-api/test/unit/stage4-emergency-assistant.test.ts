import { EmergencyProfileResponseSchema } from '@smarthealth/contracts';
import { randomUUID } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { evaluateRedFlagsFallback } from '../../src/modules/assistant/red-flags.js';
import { decideMatch, verifyEmergencyCardPayload } from '../../src/modules/emergency/routes.js';
import { createKeyring } from '../../src/security/crypto/keyring.js';
import { createSigner } from '../../src/security/crypto/signer.js';
import { createTestEnv } from '../helpers/keys.js';

describe('Stage 4 emergency closed schema, card verification, and assistant fallback', () => {
  const env = createTestEnv();
  const keyring = createKeyring(env);
  const signer = createSigner(keyring);

  it('decides face match bands deterministically', () => {
    expect(decideMatch(undefined, 0, env)).toBe('no_match');
    expect(decideMatch(0.39, 0.2, env)).toBe('no_match');
    expect(decideMatch(0.45, 0.2, env)).toBe('possible_match');
    expect(decideMatch(0.55, 0.04, env)).toBe('possible_match');
    expect(decideMatch(0.55, 0.08, env)).toBe('match');
  });

  it('rejects any extra unexpected field on EmergencyProfileResponseSchema (strict closed schema)', () => {
    const valid = {
      session: {
        id: randomUUID(),
        expires_at: '2026-11-24T09:20:00Z',
        low_confidence: false,
        method: 'face' as const,
      },
      patient: {
        full_name: 'Mona Adel',
        age: 36,
        sex: 'female' as const,
        mrn_last4: '9Q4D',
      },
      blood_type: { value: 'O+' as const, verified: true },
      allergies: [{ name: 'Penicillins', severity: 'anaphylaxis' as const, verified: true }],
      chronic_conditions: [{ name: 'Asthma', since_year: 2015 }],
      current_medications: [{ name: 'Salbutamol', dose_text: '2 puffs' }],
      has_shared_contacts: true,
      generated_at: '2026-11-24T08:21:00Z',
    };

    expect(() => EmergencyProfileResponseSchema.strict().parse(valid)).not.toThrow();
    expect(() =>
      EmergencyProfileResponseSchema.strict().parse({
        ...valid,
        diagnoses: [{ icd10_code: 'F32.9' }],
      }),
    ).toThrow();
  });

  it('verifies uncompressed & deflate-compressed SHEC1. emergency cards and blocks tampered ones', () => {
    const claims = Buffer.from(
      JSON.stringify({
        typ: 'emergency_card',
        mrn: 'SH-7K2M9Q4D',
        n: 'Mona Adel',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      'utf8',
    );
    const jws = signer.signCompactJws(keyring.emergencyCardKey, 'emergency_card', claims);
    expect(verifyEmergencyCardPayload(`SHEC1.${jws}`, keyring.emergencyCardPublicKeys)).toEqual({
      mrn: 'SH-7K2M9Q4D',
      expired: false,
    });

    const zipped = signer.signCompactJws(
      keyring.emergencyCardKey,
      'emergency_card+deflate',
      deflateRawSync(claims),
    );
    expect(verifyEmergencyCardPayload(`SHEC1.${zipped}`, keyring.emergencyCardPublicKeys)?.mrn).toBe(
      'SH-7K2M9Q4D',
    );

    expect(
      verifyEmergencyCardPayload(`SHEC1.${jws.slice(0, -3)}xxx`, keyring.emergencyCardPublicKeys),
    ).toBeNull();
  });

  it('evaluates red-flags fallback accurately offline', () => {
    const cardiac = evaluateRedFlagsFallback('عندي ألم في الصدر مع عرق شديد');
    expect(cardiac.matched).toBe(true);
    expect(cardiac.level).toBe('emergency');
    expect(cardiac.ruleIds).toContain('RF-CARDIAC-01');

    const benign = evaluateRedFlagsFallback('عندي كحة خفيفة');
    expect(benign.matched).toBe(false);
    expect(benign.level).toBe('soon');
  });
});
