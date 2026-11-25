import { AsyncLocalStorage } from 'node:async_hooks';
import type { Locale } from '@smarthealth/contracts';

export interface RequestContextStore {
  requestId: string;
  locale: Locale;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function getRequestLocale(): Locale {
  return requestContext.getStore()?.locale ?? 'en';
}
