import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { Keyring } from './keyring.js';

export interface FieldAad {
  table: string;
  column: string;
  rowId: string;
}

export function aad(table: string, column: string, rowId: string): FieldAad {
  return { table, column, rowId };
}

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export interface FieldCipher {
  encrypt(plain: string, meta: FieldAad): string;
  decrypt(envelope: string, meta: FieldAad): string;
  blindIndex(value: string, domain: string): Buffer;
}

export function createFieldCipher(keyring: Keyring): FieldCipher {
  return {
    encrypt(plain: string, meta: FieldAad): string {
      const kid = keyring.currentKekId;
      const key = keyring.getKek(kid);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(`${meta.table}|${meta.column}|${meta.rowId}`, 'utf8'));
      const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return ['v1', kid, iv.toString('base64url'), ct.toString('base64url'), tag.toString('base64url')].join('.');
    },

    decrypt(envelope: string, meta: FieldAad): string {
      const parts = envelope.split('.');
      if (parts.length !== 5) {
        throw new CryptoError('MALFORMED_ENVELOPE');
      }
      const [version, kid, ivB64, ctB64, tagB64] = parts;
      if (version !== 'v1' || !kid || !ivB64 || !ctB64 || !tagB64) {
        throw new CryptoError('UNSUPPORTED_ENVELOPE');
      }
      const decipher = createDecipheriv(
        'aes-256-gcm',
        keyring.getKek(kid),
        Buffer.from(ivB64, 'base64url'),
      );
      decipher.setAAD(Buffer.from(`${meta.table}|${meta.column}|${meta.rowId}`, 'utf8'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ctB64, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },

    blindIndex(value: string, domain: string): Buffer {
      const normalized = value.normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '');
      return createHmac('sha256', keyring.blindIndexKey)
        .update(`${domain}:${normalized}`, 'utf8')
        .digest();
    },
  };
}
