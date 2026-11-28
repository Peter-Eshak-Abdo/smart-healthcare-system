import { describe, expect, it } from 'vitest';
import { RegisterAccountRequestSchema } from '@smarthealth/contracts';

describe('RegisterAccountRequestSchema', () => {
  const basePayload = {
    role: 'patient' as const,
    email: 'patient@example.com',
    phone: '+201001234567',
    password: 'StrongPassword123!',
    confirm_password: 'StrongPassword123!',
    full_name: 'أحمد محمد',
    national_id: '29901011234567',
    date_of_birth: '1999-01-01',
    sex: 'male' as const,
    preferred_locale: 'ar' as const,
    blood_type: 'O+' as const,
  };

  it('accepts a valid patient registration payload', () => {
    const parsed = RegisterAccountRequestSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
  });

  it('rejects when password and confirm_password do not match', () => {
    const parsed = RegisterAccountRequestSchema.safeParse({
      ...basePayload,
      confirm_password: 'DifferentPassword123!',
    });
    expect(parsed.success).toBe(false);
  });

  it('requires license_number for medical practitioners', () => {
    const parsed = RegisterAccountRequestSchema.safeParse({
      ...basePayload,
      role: 'doctor',
    });
    expect(parsed.success).toBe(false);

    const validDoctor = RegisterAccountRequestSchema.safeParse({
      ...basePayload,
      role: 'doctor',
      license_number: 'MED-2026-001',
      specialty_code: 'CARDIO',
    });
    expect(validDoctor.success).toBe(true);
  });
});
