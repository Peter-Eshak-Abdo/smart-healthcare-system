import type { ProblemDetails } from '@smarthealth/contracts';
import { ApiRequestError } from './errors';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export async function serverApiFetch<T>(
  path: string,
  accessToken: string,
  locale: 'ar' | 'en' = 'ar',
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Client': `web/${APP_VERSION}`,
      'Accept-Language': locale,
      'X-Request-Id': crypto.randomUUID(),
    },
  });

  const data = (await res.json().catch(() => ({}))) as Partial<ProblemDetails> & T;
  if (!res.ok) {
    throw new ApiRequestError(res.status, data);
  }
  return data as T;
}
