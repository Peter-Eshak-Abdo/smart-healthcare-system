import { generateKeyPairSync, randomUUID, sign as cryptoSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryRedis } from '../../src/integrations/redis.js';
import { aad, createFieldCipher } from '../../src/security/crypto/field-cipher.js';
import { createKeyring } from '../../src/security/crypto/keyring.js';
import { createSigner } from '../../src/security/crypto/signer.js';
import {
  buildStepUpSignedPayload,
  createStepUpService,
  validateP256Spki,
} from '../../src/security/step-up.js';
import { validateEgyptianNationalId } from '../../src/shared/egyptian-id.js';
import { AppError } from '../../src/shared/errors.js';
import { decodeCursor, encodeCursor } from '../../src/shared/pagination.js';
import { createTestEnv } from '../helpers/keys.js';

describe('crypto and input security primitives', () => {
  const env = createTestEnv();
  const keyring = createKeyring(env);
  const cipher = createFieldCipher(keyring);
  const signer = createSigner(keyring);

  it('encrypts/decrypts AES-256-GCM fields with strict AAD binding', () => {
    const rowId = randomUUID();
    const envl = cipher.encrypt('29001011200018', aad('patients', 'id_document_enc', rowId));
    expect(envl.startsWith('v1.k1.')).toBe(true);
    expect(cipher.decrypt(envl, aad('patients', 'id_document_enc', rowId))).toBe('29001011200018');

    expect(() =>
      cipher.decrypt(envl, aad('patients', 'id_document_enc', randomUUID())),
    ).toThrow();
    expect(() => cipher.decrypt(envl, aad('profiles', 'phone_enc', rowId))).toThrow();
  });

  it('computes normalized deterministic blind index', () => {
    const a = cipher.blindIndex('  sh-7k2m 9q4d ', 'id_document');
    const b = cipher.blindIndex('SH-7K2M9Q4D', 'id_document');
    expect(a.equals(b)).toBe(true);
  });

  it('signs and verifies canonical RFC 8785 Rx payload with Ed25519', () => {
    const payload = { v: 1, rx_id: randomUUID(), items: [{ id: '1', quantity: 14 }] };
    const signed = signer.signRx(payload);
    expect(signer.verifyRx(payload, signed.signature, signed.kid)).toBe(true);
    expect(
      signer.verifyRx({ ...payload, items: [{ id: '1', quantity: 99 }] }, signed.signature, signed.kid),
    ).toBe(false);
  });

  it('issues P-256 step-up challenge, verifies DER signature, and rejects replay', async () => {
    const redis = new InMemoryRedis();
    const stepUp = createStepUpService(keyring, signer, redis);

    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const spkiDer = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
    expect(validateP256Spki(spkiDer.toString('base64'))).toBeInstanceOf(Buffer);

    const userId = randomUUID();
    const deviceId = randomUUID();
    const ch = await stepUp.createChallenge({
      userId,
      deviceId,
      purpose: 'logout_all',
      publicKeySpki: spkiDer,
    });

    const msg = buildStepUpSignedPayload(ch.nonce_b64, 'logout_all', deviceId);
    const sig = cryptoSign('sha256', msg, privateKey);
    const verified = await stepUp.verifyChallenge({
      userId,
      challengeId: ch.challenge_id,
      signatureB64: sig.toString('base64'),
    });

    expect(verified.purpose).toBe('logout_all');
    await expect(
      stepUp.verifyToken(verified.step_up_token, userId, 'logout_all'),
    ).resolves.toBeUndefined();
    // Single-use replay blocked
    await expect(
      stepUp.verifyToken(verified.step_up_token, userId, 'logout_all'),
    ).rejects.toThrow(AppError);
  });

  it('validates Egyptian 14-digit National ID against DOB and governorate', () => {
    expect(() => validateEgyptianNationalId('29001011200018', '1990-01-01')).not.toThrow();
    expect(() => validateEgyptianNationalId('29001011200018', '1991-01-01')).toThrow(AppError);
    expect(() => validateEgyptianNationalId('29001019900018', '1990-01-01')).toThrow(AppError);
    expect(() => validateEgyptianNationalId('1234', '1990-01-01')).toThrow(AppError);
  });

  it('rejects tampered pagination cursors', () => {
    const cursor = encodeCursor({ t: '2026-11-24T00:00:00Z', id: randomUUID() }, keyring.blindIndexKey);
    expect(decodeCursor(cursor, keyring.blindIndexKey).t).toBe('2026-11-24T00:00:00Z');
    expect(() => decodeCursor(`${cursor}tamper`, keyring.blindIndexKey)).toThrow(AppError);
  });
});
