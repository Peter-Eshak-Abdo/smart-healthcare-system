import type { Locale } from '@smarthealth/contracts';
import type { AuthLocals } from '../security/auth-context.js';
import type { ValidatedData } from '../middleware/validate.js';

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      locale: Locale;
      auth?: AuthLocals;
      validated?: ValidatedData;
      idempotencyKey?: string;
    }
  }
}

export {};
