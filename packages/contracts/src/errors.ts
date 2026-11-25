import { z } from 'zod';

/**
 * Canonical ErrorCode enum — exact match to docs/00-INDEX.md §7.
 * Never invent an error code outside 00-INDEX.md §7.
 */
export const ErrorCodeEnum = z.enum([
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_SESSION_REVOKED',
  'AUTH_MFA_REQUIRED',
  'AUTH_STEP_UP_REQUIRED',
  'AUTH_STEP_UP_INVALID',
  'ACCOUNT_SUSPENDED',
  'LICENSE_NOT_VALID',
  'RBAC_FORBIDDEN',
  'ACCESS_GRANT_REQUIRED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_CONFLICT',
  'CONFLICT_VERSION',
  'RATE_LIMITED',
  'RX_NOT_FOUND',
  'RX_SIGNATURE_INVALID',
  'RX_EXPIRED',
  'RX_CANCELLED',
  'RX_ALREADY_DISPENSED',
  'RX_QUANTITY_EXCEEDED',
  'RX_LEASE_HELD',
  'RX_ALERT_OVERRIDE_REQUIRED',
  'RX_PRESCRIBER_INVALID',
  'PICKUP_TOKEN_INVALID',
  'EMERG_NO_MATCH',
  'EMERG_SESSION_EXPIRED',
  'EMERG_CONTACTS_NOT_SHARED',
  'BIO_NO_FACE',
  'BIO_MULTIPLE_FACES',
  'BIO_LOW_QUALITY',
  'BIO_LIVENESS_FAILED',
  'BIO_CONSENT_REQUIRED',
  'BIO_ALREADY_ENROLLED',
  'AI_SERVICE_UNAVAILABLE',
  'AI_TIMEOUT',
  'FEATURE_NOT_IMPLEMENTED',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  AUTH_TOKEN_MISSING: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_SESSION_REVOKED: 401,
  AUTH_MFA_REQUIRED: 403,
  AUTH_STEP_UP_REQUIRED: 403,
  AUTH_STEP_UP_INVALID: 401,
  ACCOUNT_SUSPENDED: 403,
  LICENSE_NOT_VALID: 403,
  RBAC_FORBIDDEN: 403,
  ACCESS_GRANT_REQUIRED: 403,
  RESOURCE_NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  CONFLICT_VERSION: 409,
  RATE_LIMITED: 429,
  RX_NOT_FOUND: 404,
  RX_SIGNATURE_INVALID: 422,
  RX_EXPIRED: 409,
  RX_CANCELLED: 409,
  RX_ALREADY_DISPENSED: 409,
  RX_QUANTITY_EXCEEDED: 409,
  RX_LEASE_HELD: 409,
  RX_ALERT_OVERRIDE_REQUIRED: 422,
  RX_PRESCRIBER_INVALID: 409,
  PICKUP_TOKEN_INVALID: 401,
  EMERG_NO_MATCH: 200,
  EMERG_SESSION_EXPIRED: 410,
  EMERG_CONTACTS_NOT_SHARED: 403,
  BIO_NO_FACE: 422,
  BIO_MULTIPLE_FACES: 422,
  BIO_LOW_QUALITY: 422,
  BIO_LIVENESS_FAILED: 422,
  BIO_CONSENT_REQUIRED: 403,
  BIO_ALREADY_ENROLLED: 409,
  AI_SERVICE_UNAVAILABLE: 503,
  AI_TIMEOUT: 504,
  FEATURE_NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

export const FieldErrorSchema = z
  .object({
    path: z.string(),
    code: z.string(),
    message: z.string(),
    alert_key: z.string().optional(),
  })
  .strict();

export type FieldError = z.infer<typeof FieldErrorSchema>;

export const ProblemDetailsSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int().min(100).max(599),
    code: ErrorCodeEnum,
    detail: z.string().optional(),
    instance: z.string(),
    request_id: z.string().uuid(),
    errors: z.array(FieldErrorSchema).optional(),
  })
  .strict();

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
