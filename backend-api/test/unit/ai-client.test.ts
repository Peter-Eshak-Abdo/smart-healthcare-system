import { jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  AiClient,
  type InternalFaceAnalyzeResponse,
  mapFaceAnalysisFailure,
} from '../../src/integrations/ai-client.js';
import { createKeyring } from '../../src/security/crypto/keyring.js';
import { createInternalJwtSigner } from '../../src/security/internal-jwt.js';
import { createTestEnv } from '../helpers/keys.js';

function baseFaceResult(
  overrides: Partial<InternalFaceAnalyzeResponse> = {},
): InternalFaceAnalyzeResponse {
  return {
    face_detected: true,
    face_count: 1,
    selected_face: { bbox: [0, 0, 100, 100], det_score: 0.95 },
    quality: {
      score: 0.8,
      blur: 0.1,
      brightness: 128,
      yaw: 0,
      pitch: 0,
      passed: true,
      hints: [],
    },
    liveness: {
      mode: 'active',
      score: 0.92,
      passed: true,
      checks: { pad_model: 0.92, challenge_completed: true, frame_consistency: true },
    },
    template: { vector: [0.1, 0.2], dim: 512 },
    model_version: 'buffalo_l-arcface-r50@1',
    transform_key_version: 1,
    timings_ms: { decode: 5, detect: 10, liveness: 10, embed: 15, total: 40 },
    ...overrides,
  };
}

describe('AiClient and biometric failure mapping', () => {
  it('signs short-lived EdDSA internal JWT verifiable by ai-service public key', async () => {
    const env = createTestEnv();
    const keyring = createKeyring(env);
    const signer = createInternalJwtSigner(keyring);

    const token = await signer.sign({ scope: 'clinical', rid: 'req-123' });
    const { payload } = await jwtVerify(token, keyring.internalJwtKey.publicKey, {
      issuer: 'backend-api',
      audience: 'ai-service',
      algorithms: ['EdDSA'],
    });
    expect(payload.scope).toBe('clinical');
    expect(payload.rid).toBe('req-123');
    expect(typeof payload.jti).toBe('string');
  });

  it('maps face analysis failures deterministically to canonical BIO_* codes', () => {
    expect(mapFaceAnalysisFailure(baseFaceResult({ face_detected: false, face_count: 0 })).code).toBe(
      'BIO_NO_FACE',
    );
    expect(mapFaceAnalysisFailure(baseFaceResult({ face_count: 2 })).code).toBe(
      'BIO_MULTIPLE_FACES',
    );
    expect(
      mapFaceAnalysisFailure(
        baseFaceResult({
          quality: {
            score: 0.2,
            blur: 0.9,
            brightness: 50,
            yaw: 0,
            pitch: 0,
            passed: false,
            hints: ['blurry'],
          },
        }),
      ).code,
    ).toBe('BIO_LOW_QUALITY');
    expect(
      mapFaceAnalysisFailure(
        baseFaceResult({
          liveness: {
            mode: 'active',
            score: 0.3,
            passed: false,
            checks: { pad_model: 0.3, challenge_completed: false, frame_consistency: true },
          },
        }),
      ).code,
    ).toBe('BIO_LIVENESS_FAILED');
  });

  it('returns AI_SERVICE_UNAVAILABLE when ai-service host is unreachable', async () => {
    const env = createTestEnv({ AI_SERVICE_URL: 'http://127.0.0.1:59999' });
    const keyring = createKeyring(env);
    const client = new AiClient(env, createInternalJwtSigner(keyring));

    await expect(
      client.checkClinicalInteractions({
        proposed: [{ key: 'i1', drug_id: 'd1' }],
        current: [],
        allergies: [],
        conditions: [],
        locale: 'en',
      }),
    ).rejects.toMatchObject({ code: 'AI_SERVICE_UNAVAILABLE' });
  });
});
