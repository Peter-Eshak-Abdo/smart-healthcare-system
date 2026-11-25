import canonicalizeModule from 'canonicalize';

const canonicalizeFn = canonicalizeModule as unknown as (input: unknown) => string | undefined;

export function toCanonicalJson(payload: unknown): string {
  const result = canonicalizeFn(payload);
  if (result === undefined) {
    throw new Error('Cannot canonicalize payload to RFC 8785 JSON');
  }
  return result;
}
