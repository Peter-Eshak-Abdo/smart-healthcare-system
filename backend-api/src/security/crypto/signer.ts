import { createHash, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto';
import { SignJWT } from 'jose';
import { toCanonicalJson } from './jcs.js';
import type { Ed25519KeyPair, Keyring } from './keyring.js';

export interface SignedArtifact {
  signature: Buffer;
  kid: string;
  sha256: Buffer;
}

export interface Signer {
  signRx(payload: Record<string, unknown>): SignedArtifact;
  verifyRx(payload: Record<string, unknown>, signature: Buffer, kid: string): boolean;
  signCompactJws(
    pair: Ed25519KeyPair,
    headerTyp: string | undefined,
    payloadBytes: Buffer,
  ): string;
  signStepUpJwt(claims: { sub: string; did: string; pur: string; jti: string }): Promise<string>;
}

function base64Url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

export function createSigner(keyring: Keyring): Signer {
  return {
    signRx(payload: Record<string, unknown>): SignedArtifact {
      const canonical = toCanonicalJson(payload);
      const data = Buffer.from(canonical, 'utf8');
      const sha256 = createHash('sha256').update(data).digest();
      const pair = keyring.rxKey;
      const signature = cryptoSign(null, data, pair.privateKey);
      return { signature, kid: pair.kid, sha256 };
    },

    verifyRx(payload: Record<string, unknown>, signature: Buffer, kid: string): boolean {
      const pair = keyring.rxPublicKeys.find((k) => k.kid === kid);
      if (!pair) return false;
      const canonical = toCanonicalJson(payload);
      return cryptoVerify(null, Buffer.from(canonical, 'utf8'), pair.publicKey, signature);
    },

    signCompactJws(pair: Ed25519KeyPair, headerTyp: string | undefined, payloadBytes: Buffer): string {
      const header: Record<string, string> = { alg: 'EdDSA', kid: pair.kid };
      if (headerTyp) {
        header.typ = headerTyp;
      }
      const headerB64 = base64Url(JSON.stringify(header));
      const payloadB64 = base64Url(payloadBytes);
      const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'ascii');
      const sig = cryptoSign(null, signingInput, pair.privateKey);
      return `${headerB64}.${payloadB64}.${base64Url(sig)}`;
    },

    async signStepUpJwt(claims: { sub: string; did: string; pur: string; jti: string }): Promise<string> {
      const pair = keyring.internalJwtKey;
      return new SignJWT({
        sub: claims.sub,
        did: claims.did,
        pur: claims.pur,
        jti: claims.jti,
      })
        .setProtectedHeader({ alg: 'EdDSA', kid: pair.kid })
        .setIssuer('backend-api')
        .setAudience('backend-api-stepup')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(pair.privateKey);
    },
  };
}
