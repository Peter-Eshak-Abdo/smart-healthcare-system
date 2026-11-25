import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

export interface CursorPayload {
  t: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload, hmacKey: Buffer): string {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', hmacKey).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}

export function decodeCursor(cursor: string, hmacKey: Buffer): CursorPayload {
  const parts = cursor.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new AppError('VALIDATION_FAILED', { detail: 'invalid_cursor' });
  }
  const [raw, sig] = parts;
  const expected = createHmac('sha256', hmacKey).update(raw).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new AppError('VALIDATION_FAILED', { detail: 'invalid_cursor' });
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (typeof parsed.t !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('Malformed cursor payload');
    }
    return { t: parsed.t, id: parsed.id };
  } catch {
    throw new AppError('VALIDATION_FAILED', { detail: 'invalid_cursor' });
  }
}
