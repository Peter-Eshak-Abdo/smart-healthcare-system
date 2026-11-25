import { AppError } from '../shared/errors.js';

interface PgLikeError {
  code?: string;
  message?: string;
  constraint?: string;
}

function asPgError(err: unknown): PgLikeError | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return err as PgLikeError;
  }
  return null;
}

/**
 * Maps PostgreSQL SQLSTATE codes to canonical AppError codes per docs/role-02-database.md §8.
 */
export function mapPgError(err: unknown): AppError | null {
  const pg = asPgError(err);
  if (!pg?.code) return null;
  const msg = pg.message ?? '';

  switch (pg.code) {
    case '42501': {
      if (msg.includes('verified licence required') || msg.includes('verified license required') || msg.includes('licence')) {
        return new AppError('LICENSE_NOT_VALID', { cause: err });
      }
      if (msg.includes('active grant') || msg.includes('grant')) {
        return new AppError('ACCESS_GRANT_REQUIRED', { cause: err });
      }
      return new AppError('RBAC_FORBIDDEN', { cause: err });
    }
    case '23505': {
      if (msg.includes('id_already_registered') || pg.constraint === 'patients_id_document_bidx_key') {
        return new AppError('VALIDATION_FAILED', {
          statusOverride: 409,
          detail: 'id_already_registered',
          cause: err,
        });
      }
      if (msg.includes('already_onboarded') || pg.constraint === 'patients_pkey') {
        return new AppError('VALIDATION_FAILED', {
          statusOverride: 409,
          detail: 'already_onboarded',
          cause: err,
        });
      }
      return new AppError('CONFLICT_VERSION', { detail: 'unique_violation', cause: err });
    }
    case '23514': {
      if (pg.constraint === 'quantity_dispensed_within_bounds' || msg.includes('quantity_dispensed_within_bounds')) {
        return new AppError('RX_QUANTITY_EXCEEDED', { cause: err });
      }
      if (msg.includes('prescription is cancelled')) {
        return new AppError('RX_CANCELLED', { cause: err });
      }
      if (msg.includes('prescription is expired')) {
        return new AppError('RX_EXPIRED', { cause: err });
      }
      if (msg.includes('maximum 5 emergency contacts')) {
        return new AppError('VALIDATION_FAILED', {
          detail: 'max_emergency_contacts_exceeded',
          cause: err,
        });
      }
      if (msg.includes('committed without signature')) {
        return new AppError('INTERNAL_ERROR', { cause: err });
      }
      return new AppError('VALIDATION_FAILED', { detail: 'constraint_violation', cause: err });
    }
    case 'P0001': {
      if (msg.includes('already_extended')) {
        return new AppError('CONFLICT_VERSION', { detail: 'already_extended', cause: err });
      }
      return new AppError('VALIDATION_FAILED', { detail: msg || 'validation_failed', cause: err });
    }
    case 'P0002': {
      if (msg.includes('rx_not_found')) {
        return new AppError('RX_NOT_FOUND', { cause: err });
      }
      return new AppError('RESOURCE_NOT_FOUND', { cause: err });
    }
    case 'P0003':
      return new AppError('EMERG_SESSION_EXPIRED', { cause: err });
    case 'P0004':
      return new AppError('EMERG_CONTACTS_NOT_SHARED', { cause: err });
    case 'P0005':
      return new AppError('BIO_CONSENT_REQUIRED', { cause: err });
    case '40P01':
    case '40001':
      return new AppError('CONFLICT_VERSION', { detail: 'concurrency_conflict', cause: err });
    default:
      return null;
  }
}
