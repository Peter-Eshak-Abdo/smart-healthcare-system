import { createHash, randomInt, randomUUID, verify as cryptoVerify } from 'node:crypto';
import type { Ed25519KeyPair } from '../../security/crypto/keyring.js';
import { toCanonicalJson } from '../../security/crypto/jcs.js';
import type { Signer } from '../../security/crypto/signer.js';

const CROCKFORD_SAFE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface CanonicalRxItem {
  id: string;
  drug_id: string;
  dose: string;
  route: string;
  frequency: string;
  frequency_interval_hours: number | null;
  duration_days: number;
  quantity: number;
  quantity_unit: string;
  substitution_allowed: boolean;
}

export interface CanonicalRxHeader {
  id: string;
  rx_number: string;
  patient_id: string;
  doctor_id: string;
  facility_id: string;
  issued_at: string | Date;
  expires_at: string | Date;
}

export function buildCanonicalRxPayload(
  rx: CanonicalRxHeader,
  items: CanonicalRxItem[],
  prescriberLicense: string,
): Record<string, unknown> {
  const sortedItems = [...items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => ({
      id: item.id,
      drug_id: item.drug_id,
      dose: item.dose,
      route: item.route,
      frequency: item.frequency,
      frequency_interval_hours: item.frequency_interval_hours ?? null,
      duration_days: item.duration_days,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      substitution_allowed: item.substitution_allowed,
    }));

  return {
    v: 1,
    rx_id: rx.id,
    rx_number: rx.rx_number,
    patient_id: rx.patient_id,
    prescriber_id: rx.doctor_id,
    prescriber_license: prescriberLicense,
    facility_id: rx.facility_id,
    issued_at: new Date(rx.issued_at).toISOString(),
    expires_at: new Date(rx.expires_at).toISOString(),
    items: sortedItems,
  };
}

export function generatePaperCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CROCKFORD_SAFE[randomInt(0, CROCKFORD_SAFE.length)]!;
  }
  return code;
}

export interface PickupTokenClaims {
  typ: 'pickup';
  rx: string;
  rn: string;
  iss_at: string;
  pr_lic: string;
  items_hash: string;
  jti: string;
  exp: number;
}

export function issuePickupToken(
  signer: Signer,
  rxKey: Ed25519KeyPair,
  data: {
    prescriptionId: string;
    rxNumber: string;
    issuedAt: string;
    prescriberLicense: string;
    items: CanonicalRxItem[];
    ttlSeconds?: number;
  },
): { pickup_token: string; expires_at: string; qr_payload: string } {
  const ttl = data.ttlSeconds ?? 300;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const itemsHash = createHash('sha256')
    .update(toCanonicalJson([...data.items].sort((a, b) => a.id.localeCompare(b.id))), 'utf8')
    .digest('base64url');

  const claims: PickupTokenClaims = {
    typ: 'pickup',
    rx: data.prescriptionId,
    rn: data.rxNumber,
    iss_at: new Date(data.issuedAt).toISOString(),
    pr_lic: data.prescriberLicense,
    items_hash: itemsHash,
    jti: randomUUID(),
    exp,
  };

  const compactJws = signer.signCompactJws(
    rxKey,
    'pickup+jwt',
    Buffer.from(JSON.stringify(claims), 'utf8'),
  );
  const full = `SH1.${compactJws}`;
  return {
    pickup_token: full,
    expires_at: new Date(exp * 1000).toISOString(),
    qr_payload: full,
  };
}

export function verifyPickupToken(
  token: string,
  publicKeys: Ed25519KeyPair[],
): PickupTokenClaims | null {
  if (!token.startsWith('SH1.')) return null;
  const jws = token.slice(4);
  const parts = jws.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'EdDSA' || !header.kid) return null;
    const keyPair = publicKeys.find((k) => k.kid === header.kid);
    if (!keyPair) return null;

    const valid = cryptoVerify(
      null,
      Buffer.from(`${headerB64}.${payloadB64}`, 'ascii'),
      keyPair.publicKey,
      Buffer.from(sigB64, 'base64url'),
    );
    if (!valid) return null;

    const claims = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as PickupTokenClaims;
    if (claims.typ !== 'pickup' || !claims.rx || !claims.jti || typeof claims.exp !== 'number') {
      return null;
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
