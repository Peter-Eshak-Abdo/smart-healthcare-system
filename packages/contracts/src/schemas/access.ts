import { z } from 'zod';
import {
  AccessScopeSchema,
  AppRoleSchema,
  createPageResponseSchema,
  GrantStatusSchema,
  GrantTypeSchema,
  PaginationQuerySchema,
  TimestampSchema,
  UuidSchema,
} from './common.js';

export const CreateShareCodeRequestSchema = z
  .object({
    grant_duration_days: z.number().int().min(1).max(365).default(30),
    scope: AccessScopeSchema.default('read_write'),
  })
  .strict();

export const CreateShareCodeResponseSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/),
    expires_at: TimestampSchema,
    grant_duration_days: z.number().int().min(1).max(365),
    scope: AccessScopeSchema,
  })
  .strict();

export const AccessGrantDtoSchema = z
  .object({
    id: UuidSchema,
    grant_type: GrantTypeSchema,
    practitioner: z
      .object({
        name: z.string(),
        type: AppRoleSchema,
        facility: z.string().nullable(),
      })
      .strict(),
    scope: AccessScopeSchema,
    status: GrantStatusSchema,
    granted_at: TimestampSchema,
    expires_at: TimestampSchema,
  })
  .strict();

export const AccessGrantsResponseSchema = z
  .object({
    data: z.array(AccessGrantDtoSchema),
  })
  .strict();

export const GrantIdParamSchema = z
  .object({
    grantId: UuidSchema,
  })
  .strict();

export const AccessLogQuerySchema = PaginationQuerySchema;

export const AccessLogItemSchema = z
  .object({
    at: TimestampSchema,
    actor: z
      .object({
        name: z.string(),
        role: AppRoleSchema,
        facility: z.string().nullable(),
      })
      .strict(),
    action: z.string(),
    context: z.enum(['grant', 'emergency', 'pharmacy', 'self', 'system']),
  })
  .strict();

export const AccessLogResponseSchema = createPageResponseSchema(AccessLogItemSchema);
