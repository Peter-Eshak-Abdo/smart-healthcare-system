import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildCanonicalRxPayload,
  generatePaperCode,
  issuePickupToken,
  verifyPickupToken,
} from '../../src/modules/prescriptions/signing.js';
import { createKeyring } from '../../src/security/crypto/keyring.js';
import { createSigner } from '../../src/security/crypto/signer.js';
import { createTestEnv } from '../helpers/keys.js';

describe('Stage 4 prescription signing & pickup tokens', () => {
  const env = createTestEnv();
  const keyring = createKeyring(env);
  const signer = createSigner(keyring);

  it('builds canonical JCS payload with sorted items and detects any field tampering', () => {
    const rxId = randomUUID();
    const itemA = 'bbbbbbbb-0000-4000-8000-000000000001';
    const itemB = 'aaaaaaaa-0000-4000-8000-000000000002';

    const hdr = {
      id: rxId,
      rx_number: 'RX-2026-000001',
      patient_id: randomUUID(),
      doctor_id: randomUUID(),
      facility_id: randomUUID(),
      issued_at: '2026-11-24T10:00:00Z',
      expires_at: '2026-12-24T10:00:00Z',
    };

    const p1 = buildCanonicalRxPayload(
      hdr,
      [
        {
          id: itemA,
          drug_id: 'd1',
          dose: '1 tablet',
          route: 'oral',
          frequency: 'once_daily',
          frequency_interval_hours: null,
          duration_days: 30,
          quantity: 30,
          quantity_unit: 'tablet',
          substitution_allowed: true,
        },
        {
          id: itemB,
          drug_id: 'd2',
          dose: '1 capsule',
          route: 'oral',
          frequency: 'twice_daily',
          frequency_interval_hours: null,
          duration_days: 7,
          quantity: 14,
          quantity_unit: 'capsule',
          substitution_allowed: false,
        },
      ],
      'EG-MD-123456',
    );

    const signed = signer.signRx(p1);
    expect(signer.verifyRx(p1, signed.signature, signed.kid)).toBe(true);

    // Item sorting invariant: itemB precedes itemA alphabetically
    const itemsArr = p1.items as Array<{ id: string }>;
    expect(itemsArr[0]?.id).toBe(itemB);
    expect(itemsArr[1]?.id).toBe(itemA);

    // Tampered quantity fails signature verification
    const tampered = {
      ...p1,
      items: [{ ...itemsArr[0], quantity: 99 }, itemsArr[1]],
    };
    expect(signer.verifyRx(tampered, signed.signature, signed.kid)).toBe(false);
  });

  it('issues SH1. pickup token and rejects expired or forged tokens', () => {
    const issued = issuePickupToken(signer, keyring.rxKey, {
      prescriptionId: randomUUID(),
      rxNumber: 'RX-2026-000123',
      issuedAt: '2026-11-24T10:00:00Z',
      prescriberLicense: 'EG-MD-123456',
      items: [],
      ttlSeconds: 300,
    });

    expect(issued.pickup_token.startsWith('SH1.')).toBe(true);
    const verified = verifyPickupToken(issued.pickup_token, keyring.rxPublicKeys);
    expect(verified?.rn).toBe('RX-2026-000123');

    const forged = `${issued.pickup_token.slice(0, -4)}AAAA`;
    expect(verifyPickupToken(forged, keyring.rxPublicKeys)).toBeNull();

    const expired = issuePickupToken(signer, keyring.rxKey, {
      prescriptionId: randomUUID(),
      rxNumber: 'RX-2026-000123',
      issuedAt: '2026-11-24T10:00:00Z',
      prescriberLicense: 'EG-MD-123456',
      items: [],
      ttlSeconds: -10,
    });
    expect(verifyPickupToken(expired.pickup_token, keyring.rxPublicKeys)).toBeNull();
  });

  it('generates unambiguous 6-character paper verification code', () => {
    const code = generatePaperCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });
});
