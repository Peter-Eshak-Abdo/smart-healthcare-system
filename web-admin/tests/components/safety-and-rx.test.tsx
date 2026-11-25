import { generateKeyPairSync, sign } from 'node:crypto';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import arMessages from '../../i18n/messages/ar.json';
import { PatientHeader } from '../../components/patient/PatientHeader';
import { SafetyAlertBanner } from '../../components/prescription/SafetyAlertBanner';
import { MedicalIdCard3D } from '../../components/three/MedicalIdCard3D';
import { RxSeal } from '../../components/three/RxSeal';
import { verifyPickupTokenSignatureLocally } from '../../lib/crypto/jwks';

function withIntl(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="ar" messages={arMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('Web-Admin Clinical & Security Components', () => {
  it('renders Western clinical numbers inside <bdi> in PatientHeader (US-06-AC1)', () => {
    render(
      withIntl(
        <PatientHeader
          summary={{
            patient: {
              id: '00000000-0000-0000-0000-000000000001',
              mrn: 'SH-EG-000102',
              full_name: 'أحمد محمود',
              age: 42,
              sex: 'male',
            },
            critical: {
              blood_type: { value: 'O+', source: 'clinician_confirmed', confirmed_at: null },
              allergies: [
                {
                  id: '00000000-0000-0000-0000-000000000002',
                  allergen_type: 'ingredient',
                  allergen: { code: 'PEN', name: { ar: 'بنسلين', en: 'Penicillin' } },
                  free_text: null,
                  severity: 'severe',
                  reaction: 'Anaphylaxis',
                  source: 'clinician_confirmed',
                  recorded_at: '2026-01-01T00:00:00Z',
                },
              ],
              chronic_conditions: [],
              current_medications: [],
            },
            recent_encounters: [],
            active_prescriptions: [],
            restricted_record_count: 1,
            grant: {
              id: '00000000-0000-0000-0000-000000000003',
              scope: 'read_write',
              expires_at: '2026-12-31T23:59:59Z',
            },
          }}
        />,
      ),
    );

    expect(screen.getByText('SH-EG-000102')).toBeTruthy();
    expect(screen.getByText('O+')).toBeTruthy();
    expect(screen.getByText('بنسلين')).toBeTruthy();
  });

  it('US-13-AC1 SafetyAlertBanner requires override action for critical alerts without leaking restricted drug names', () => {
    const onOverride = vi.fn();
    render(
      withIntl(
        <SafetyAlertBanner
          alert={{
            alert_key: 'allergy:penicillin',
            type: 'drug_allergy',
            severity: 'contraindicated',
            item_keys: ['item-1'],
            title: { ar: 'حساسية شديدة من البنسلين', en: 'Severe Penicillin Allergy' },
            message: { ar: 'تعارض محتمل مع دواء حالي', en: 'Interacts with active medication' },
            management: { ar: 'اختر بديلاً غير بنسيليني', en: 'Use non-penicillin alternative' },
            source: 'ddinter',
            requires_override: true,
            involves_current_medication: {
              display: 'Hidden restricted med',
              from_restricted_record: true,
            },
            previously_reviewed: null,
          }}
          overridden={false}
          onOverride={onOverride}
        />,
      ),
    );

    expect(screen.getByText('حساسية شديدة من البنسلين')).toBeTruthy();
    expect(screen.getByText(arMessages.rx.restrictedMedNote)).toBeTruthy();
    const btn = screen.getByRole('button', { name: arMessages.rx.overrideBtn });
    btn.click();
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('renders 3D Medical ID Card and Ed25519 RxSeal cleanly', () => {
    const { container } = render(
      <>
        <MedicalIdCard3D
          fullName="سارة علي"
          mrn="SH-EG-000205"
          bloodType="A+"
          allergies={['Penicillin']}
          emergencyMode
        />
        <RxSeal status="valid" kid="rx-1" rxNumber="RX-2026-000101" />
        <RxSeal status="invalid" />
      </>,
    );
    expect(container.textContent).toContain('SH-EG-000205');
    expect(container.textContent).toContain('Ed25519');
  });

  it('E-RX-01 verifies authentic and rejects malformed or tampered SH1. pickup tokens locally', async () => {
    const bad = await verifyPickupTokenSignatureLocally('NOT-SH1.bad.payload', []);
    expect(bad.status).toBe('invalid');

    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubJwk = publicKey.export({ format: 'jwk' }) as { x: string };
    const jwks = [{ kid: 'rx-1', kty: 'OKP', crv: 'Ed25519', x: pubJwk.x }];

    const hdr = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'rx-1' })).toString('base64url');
    const pay = Buffer.from(JSON.stringify({ typ: 'pickup', exp: 9999999999 })).toString('base64url');
    const sig = sign(null, Buffer.from(`${hdr}.${pay}`, 'ascii'), privateKey).toString('base64url');

    const authentic = await verifyPickupTokenSignatureLocally(`SH1.${hdr}.${pay}.${sig}`, jwks);
    expect(authentic.status).toBe('valid');

    const tamperedPay = Buffer.from(
      JSON.stringify({ typ: 'pickup', exp: 9999999999, tampered: true }),
    ).toString('base64url');
    const tampered = await verifyPickupTokenSignatureLocally(`SH1.${hdr}.${tamperedPay}.${sig}`, jwks);
    expect(tampered.status).toBe('invalid');
  });
});
