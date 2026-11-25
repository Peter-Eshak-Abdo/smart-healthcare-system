'use client';

import type { ProblemDetails } from '@smarthealth/contracts';
import { getFirebaseIdToken } from '@/lib/firebase/client';
import { ApiRequestError } from './errors';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  locale?: 'ar' | 'en';
  idempotencyKey?: string;
  ifMatch?: string;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: ApiCallOptions = {}): Promise<T> {
  const token = await getFirebaseIdToken();

  const headers = new Headers({
    'X-Client': `web/${APP_VERSION}`,
    'Accept-Language':
      opts.locale ??
      (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar'),
    'X-Request-Id': crypto.randomUUID(),
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (opts.idempotencyKey) {
    headers.set('Idempotency-Key', opts.idempotencyKey);
  }
  if (opts.ifMatch) {
    headers.set('If-Match', opts.ifMatch);
  }
  if (opts.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('json') ? ((await res.json()) as unknown) : undefined;

  if (!res.ok) {
    throw new ApiRequestError(res.status, (data as Partial<ProblemDetails> | undefined) ?? {});
  }
  return data as T;
}
