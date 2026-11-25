import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import type { Keyring } from './crypto/keyring.js';

export type AiScope = 'face' | 'clinical' | 'assistant';

export interface InternalJwtSigner {
  sign(opts: { scope: AiScope; rid?: string }): Promise<string>;
}

export function createInternalJwtSigner(keyring: Keyring): InternalJwtSigner {
  return {
    async sign({ scope, rid }) {
      const pair = keyring.internalJwtKey;
      return new SignJWT({
        jti: randomUUID(),
        scope,
        rid: rid ?? randomUUID(),
      })
        .setProtectedHeader({ alg: 'EdDSA', kid: pair.kid })
        .setIssuer('backend-api')
        .setAudience('ai-service')
        .setIssuedAt()
        .setExpirationTime('30s')
        .sign(pair.privateKey);
    },
  };
}
