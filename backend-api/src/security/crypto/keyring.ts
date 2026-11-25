import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import type { AppEnv } from '../../config/env.js';

export interface Ed25519KeyPair {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export interface Keyring {
  currentKekId: string;
  getKek(kid: string): Buffer;
  blindIndexKey: Buffer;
  rxKey: Ed25519KeyPair;
  rxPublicKeys: Ed25519KeyPair[];
  emergencyCardKey: Ed25519KeyPair;
  emergencyCardPublicKeys: Ed25519KeyPair[];
  internalJwtKey: Ed25519KeyPair;
}

function decodeKey32(b64: string, name: string): Buffer {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes`);
  }
  return buf;
}

function loadEd25519Pair(kid: string, privatePem: string | undefined, name: string): Ed25519KeyPair {
  if (!privatePem) {
    throw new Error(`Missing ${name} private key in environment`);
  }
  const normalized = privatePem.replace(/\\n/g, '\n');
  const privateKey = createPrivateKey(normalized);
  const publicKey = createPublicKey(privateKey);
  return { kid, privateKey, publicKey };
}

export function createKeyring(env: AppEnv): Keyring {
  const keks = new Map<string, Buffer>();
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith('KEK_K') && typeof v === 'string' && v.length > 0) {
      const kid = k.slice(4).toLowerCase(); // KEK_K1 -> k1
      keks.set(kid, decodeKey32(v, k));
    }
  }

  let rxKeyPair: Ed25519KeyPair | null = null;
  let ecKeyPair: Ed25519KeyPair | null = null;
  let internalKeyPair: Ed25519KeyPair | null = null;
  let bidxKey: Buffer | null = env.BLIND_INDEX_KEY
    ? decodeKey32(env.BLIND_INDEX_KEY, 'BLIND_INDEX_KEY')
    : null;

  const ensureRx = (): Ed25519KeyPair => {
    if (!rxKeyPair) {
      rxKeyPair = loadEd25519Pair(env.RX_SIGNING_KEY_ID, env.RX_SIGNING_PRIVATE_KEY, 'RX_SIGNING_PRIVATE_KEY');
    }
    return rxKeyPair;
  };

  const ensureEc = (): Ed25519KeyPair => {
    if (!ecKeyPair) {
      ecKeyPair = loadEd25519Pair(
        env.EMERGENCY_CARD_SIGNING_KEY_ID,
        env.EMERGENCY_CARD_SIGNING_PRIVATE_KEY,
        'EMERGENCY_CARD_SIGNING_PRIVATE_KEY',
      );
    }
    return ecKeyPair;
  };

  const ensureInternal = (): Ed25519KeyPair => {
    if (!internalKeyPair) {
      internalKeyPair = loadEd25519Pair(
        'internal-1',
        env.INTERNAL_JWT_SIGNING_KEY,
        'INTERNAL_JWT_SIGNING_KEY',
      );
    }
    return internalKeyPair;
  };

  return {
    currentKekId: env.KEK_CURRENT_ID,
    getKek(kid: string): Buffer {
      const key = keks.get(kid);
      if (!key) {
        throw new Error(`KEK not found for kid="${kid}"`);
      }
      return key;
    },
    get blindIndexKey(): Buffer {
      if (!bidxKey) {
        bidxKey = decodeKey32(env.BLIND_INDEX_KEY ?? '', 'BLIND_INDEX_KEY');
      }
      return bidxKey;
    },
    get rxKey(): Ed25519KeyPair {
      return ensureRx();
    },
    get rxPublicKeys(): Ed25519KeyPair[] {
      return env.RX_SIGNING_PRIVATE_KEY ? [ensureRx()] : [];
    },
    get emergencyCardKey(): Ed25519KeyPair {
      return ensureEc();
    },
    get emergencyCardPublicKeys(): Ed25519KeyPair[] {
      return env.EMERGENCY_CARD_SIGNING_PRIVATE_KEY ? [ensureEc()] : [];
    },
    get internalJwtKey(): Ed25519KeyPair {
      return ensureInternal();
    },
  };
}

export function exportPublicJwk(pair: Ed25519KeyPair): {
  kty: 'OKP';
  crv: 'Ed25519';
  kid: string;
  x: string;
  use: 'sig';
  alg: 'EdDSA';
} {
  const jwk = pair.publicKey.export({ format: 'jwk' }) as { x?: string };
  if (!jwk.x) {
    throw new Error(`Failed to export public JWK x parameter for kid=${pair.kid}`);
  }
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    kid: pair.kid,
    x: jwk.x,
    use: 'sig',
    alg: 'EdDSA',
  };
}
