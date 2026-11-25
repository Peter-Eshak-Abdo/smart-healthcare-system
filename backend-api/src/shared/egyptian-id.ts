import { AppError } from './errors.js';

const VALID_GOVERNORATES = new Set([
  '01',
  '02',
  '03',
  '04',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '31',
  '32',
  '33',
  '34',
  '35',
  '88',
]);

/**
 * Validates Egyptian 14-digit National ID and cross-checks DOB per E-ID-02.
 */
export function validateEgyptianNationalId(nationalId: string, dateOfBirth: string): void {
  const trimmed = nationalId.trim();
  if (!/^\d{14}$/.test(trimmed)) {
    throw new AppError('VALIDATION_FAILED', {
      detail: 'invalid_national_id',
      errors: [
        {
          path: 'id_document_number',
          code: 'custom',
          message: 'Egyptian National ID must be exactly 14 digits',
        },
      ],
    });
  }

  const centuryDigit = trimmed[0];
  if (centuryDigit !== '2' && centuryDigit !== '3') {
    throw new AppError('VALIDATION_FAILED', {
      detail: 'invalid_national_id_century',
      errors: [
        {
          path: 'id_document_number',
          code: 'custom',
          message: 'Invalid century digit in National ID',
        },
      ],
    });
  }

  const expectedCenturyPrefix = centuryDigit === '2' ? '19' : '20';
  const idYear = `${expectedCenturyPrefix}${trimmed.slice(1, 3)}`;
  const idMonth = trimmed.slice(3, 5);
  const idDay = trimmed.slice(5, 7);
  const idDob = `${idYear}-${idMonth}-${idDay}`;

  if (idDob !== dateOfBirth) {
    throw new AppError('VALIDATION_FAILED', {
      detail: 'dob_mismatch_with_national_id',
      errors: [
        {
          path: 'date_of_birth',
          code: 'custom',
          message: 'Date of birth does not match Egyptian National ID',
        },
      ],
    });
  }

  const govCode = trimmed.slice(7, 9);
  if (!VALID_GOVERNORATES.has(govCode)) {
    throw new AppError('VALIDATION_FAILED', {
      detail: 'invalid_national_id_governorate',
      errors: [
        {
          path: 'id_document_number',
          code: 'custom',
          message: 'Invalid governorate code in National ID',
        },
      ],
    });
  }
}

export function calculateAge(dateOfBirth: string | Date, now: Date = new Date()): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(`${dateOfBirth}T00:00:00Z`) : dateOfBirth;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function isMinorPatient(dateOfBirth: string | Date, now: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, now) < 16;
}
