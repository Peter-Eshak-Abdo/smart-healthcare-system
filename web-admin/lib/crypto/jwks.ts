'use client';

interface JwkEntry {
  kid: string;
  kty: string;
  crv: string;
  x: string;
}

const JWKS_CACHE_KEY = 'smarthealth:rx-jwks:v1';

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

export async function fetchRxJwks(apiBase: string): Promise<JwkEntry[]> {
  try {
    const res = await fetch(`${apiBase}/v1/.well-known/rx-jwks.json`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { keys?: JwkEntry[] };
      if (Array.isArray(json.keys)) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(JWKS_CACHE_KEY, JSON.stringify(json.keys));
        }
        return json.keys;
      }
    }
  } catch {
    // Offline fallback uses public JWKS cached in sessionStorage (zero PHI)
  }

  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(JWKS_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as JwkEntry[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

export async function verifyPickupTokenSignatureLocally(
  token: string,
  keys: JwkEntry[],
): Promise<{ status: 'valid' | 'invalid' | 'expired' | 'unverifiable'; claims?: Record<string, unknown> }> {
  if (!token.startsWith('SH1.')) return { status: 'invalid' };
  const parts = token.slice(4).split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { status: 'invalid' };
  }
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  let sigBytes: Uint8Array;
  try {
    header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerB64))) as {
      alg?: string;
      kid?: string;
    };
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as Record<
      string,
      unknown
    >;
    sigBytes = fromBase64Url(sigB64);
  } catch {
    return { status: 'invalid' };
  }

  if (header.alg !== 'EdDSA' || !header.kid || sigBytes.length !== 64) {
    return { status: 'invalid' };
  }
  if (sigBytes.every((b) => b === 0)) {
    return { status: 'invalid' };
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    return keys.length === 0 ? { status: 'unverifiable' } : { status: 'invalid' };
  }
  if (fromBase64Url(jwk.x).every((b) => b === 0)) {
    return { status: 'invalid' };
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { kty: 'OKP', crv: 'Ed25519', x: jwk.x },
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const msgBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBuf = Uint8Array.from(sigBytes);
    const msgBuf = Uint8Array.from(msgBytes);
    const ok = await crypto.subtle.verify('Ed25519', cryptoKey, sigBuf, msgBuf);
    if (!ok) return { status: 'invalid' };

    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
      return { status: 'expired', claims };
    }
    return { status: 'valid', claims };
  } catch {
    return { status: 'unverifiable' };
  }
}
