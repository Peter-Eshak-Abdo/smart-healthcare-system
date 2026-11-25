import { z } from 'zod';
import {
  AccountStatusSchema,
  AppRoleSchema,
  createPageResponseSchema,
  DateSchema,
  FacilityTypeSchema,
  LicenseStatusSchema,
  PaginationQuerySchema,
  PhoneE164Schema,
  TimestampSchema,
  UuidSchema,
} from './common.js';

export const AdminUsersQuerySchema = PaginationQuerySchema.extend({
  role: AppRoleSchema.optional(),
  status: AccountStatusSchema.optional(),
  query: z.string().trim().min(1).max(100).optional(),
}).strict();

export const AdminUserPractitionerSummarySchema = z
  .object({
    type: AppRoleSchema,
    license_number: z.string(),
    license_status: LicenseStatusSchema,
    license_expires_at: DateSchema,
    specialty_code: z.string().nullable(),
  })
  .strict();

export const AdminUserDtoSchema = z
  .object({
    id: UuidSchema,
    full_name: z.string(),
    email: z.string().email().nullable(),
    role: AppRoleSchema,
    status: AccountStatusSchema,
    created_at: TimestampSchema,
    practitioner: AdminUserPractitionerSummarySchema.nullable(),
  })
  .strict();

export const AdminUsersResponseSchema = createPageResponseSchema(AdminUserDtoSchema);

export const AdminInvitePractitionerSchema = z
  .object({
    license_number: z.string().trim().min(3).max(64),
    license_authority: z.string().trim().max(120).nullable().optional(),
    license_expires_at: DateSchema,
    specialty_code: z.string().trim().max(64).nullable().optional(),
    facility_ids: z.array(UuidSchema).min(1),
  })
  .strict();

export const AdminInviteUserRequestSchema = z
  .object({
    email: z.string().email(),
    full_name: z.string().trim().min(2).max(120),
    role: z.enum(['doctor', 'pharmacist', 'paramedic', 'admin']),
    practitioner: AdminInvitePractitionerSchema.optional(),
  })
  .strict()
  .refine(
    (v) => v.role === 'admin' || v.practitioner !== undefined,
    'practitioner details required for clinical staff roles',
  );

export const AdminInviteUserResponseSchema = z
  .object({
    id: UuidSchema,
    invite_sent: z.literal(true),
  })
  .strict();

export const AdminSetUserStatusRequestSchema = z
  .object({
    status: z.enum(['suspended', 'active', 'deactivated']),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const AdminSetUserStatusResponseSchema = z
  .object({
    id: UuidSchema,
    status: AccountStatusSchema,
  })
  .strict();

export const AdminSetUserRoleRequestSchema = z
  .object({
    role: AppRoleSchema,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const AdminSetUserRoleResponseSchema = z.union([
  z
    .object({
      id: UuidSchema,
      role: AppRoleSchema,
    })
    .strict(),
  z
    .object({
      pending_approval_id: UuidSchema,
    })
    .strict(),
]);

export const AdminApprovalResponseSchema = z
  .object({
    id: UuidSchema,
    approved: z.boolean(),
    executed: z.boolean(),
  })
  .strict();

export const AdminSetLicenseStatusRequestSchema = z
  .object({
    license_status: LicenseStatusSchema,
    reason: z.string().trim().min(3).max(500),
    license_expires_at: DateSchema.optional(),
  })
  .strict();

export const AdminSetLicenseStatusResponseSchema = z
  .object({
    id: UuidSchema,
    license_status: LicenseStatusSchema,
    license_status_changed_at: TimestampSchema,
  })
  .strict();

export const AdminFacilityInputSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    type: FacilityTypeSchema,
    address: z.string().trim().max(300).optional(),
    phone: PhoneE164Schema.optional(),
    license_number: z.string().trim().max(64).optional(),
  })
  .strict();

export const AdminFacilityPatchSchema = AdminFacilityInputSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const AdminFacilityDtoSchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    type: FacilityTypeSchema,
    address: z.string().nullable(),
    phone: z.string().nullable(),
    license_number: z.string().nullable(),
    is_active: z.boolean(),
  })
  .strict();

export const AdminFacilitiesResponseSchema = z
  .object({
    data: z.array(AdminFacilityDtoSchema),
  })
  .strict();

export const AdminAddFacilityMemberRequestSchema = z
  .object({
    practitioner_id: UuidSchema,
    role_at_facility: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

export const AdminAddFacilityMemberResponseSchema = z
  .object({
    facility_id: UuidSchema,
    practitioner_id: UuidSchema,
    added: z.literal(true),
  })
  .strict();

export const AdminAuditQuerySchema = PaginationQuerySchema.extend({
  actor_id: UuidSchema.optional(),
  action: z.string().trim().max(80).optional(),
  patient_mrn: z.string().trim().max(32).optional(),
  outcome: z.enum(['success', 'denied', 'error']).optional(),
  from: TimestampSchema.optional(),
  to: TimestampSchema.optional(),
}).strict();

export const AdminAuditEventDtoSchema = z
  .object({
    id: z.string(),
    occurred_at: TimestampSchema,
    actor: z
      .object({
        id: UuidSchema.nullable(),
        name: z.string().nullable(),
        role: z.string().nullable(),
      })
      .strict(),
    action: z.string(),
    resource_type: z.string(),
    resource_id: UuidSchema.nullable(),
    patient_mrn_last4: z.string().nullable(),
    outcome: z.enum(['success', 'denied', 'error']),
    reason: z.string().nullable(),
    ip: z.string().nullable(),
  })
  .strict();

export const AdminAuditEventsResponseSchema = createPageResponseSchema(AdminAuditEventDtoSchema);

export const AdminAuditIntegrityResponseSchema = z
  .object({
    verified_at: TimestampSchema,
    last_event_id: z.string().nullable(),
    status: z.enum(['ok', 'broken']),
    broken_at_event_id: z.string().nullable().optional(),
  })
  .strict();

export const AdminEmergencySessionsQuerySchema = PaginationQuerySchema.extend({
  review_status: z.enum(['pending', 'appropriate', 'inappropriate']).optional(),
}).strict();

export const AdminEmergencySessionDtoSchema = z
  .object({
    id: UuidSchema,
    paramedic: z
      .object({
        id: UuidSchema,
        name: z.string(),
      })
      .strict(),
    patient_mrn_last4: z.string().nullable(),
    method: z.enum(['face', 'emergency_card_qr', 'manual_search']),
    low_confidence: z.boolean(),
    match_score_band: z.string(),
    started_at: TimestampSchema,
    reason_code: z.string().nullable(),
    review_status: z.enum(['pending', 'appropriate', 'inappropriate']),
  })
  .strict();

export const AdminEmergencySessionsResponseSchema = createPageResponseSchema(
  AdminEmergencySessionDtoSchema,
);

export const AdminReviewEmergencySessionRequestSchema = z
  .object({
    outcome: z.enum(['appropriate', 'inappropriate']),
    note: z.string().trim().min(3).max(1000),
  })
  .strict();

export const AdminReviewEmergencySessionResponseSchema = z
  .object({
    id: UuidSchema,
    review_status: z.enum(['appropriate', 'inappropriate']),
    reviewed_at: TimestampSchema,
  })
  .strict();

export const AdminSecurityFlagDtoSchema = z
  .object({
    id: UuidSchema,
    user_id: UuidSchema,
    flag_type: z.string(),
    details: z.record(z.unknown()),
    created_at: TimestampSchema,
    resolved_at: TimestampSchema.nullable(),
  })
  .strict();

export const AdminSecurityFlagsResponseSchema = z
  .object({
    data: z.array(AdminSecurityFlagDtoSchema),
  })
  .strict();

export const AdminResolveDrugRequestSchema = z
  .object({
    action: z.enum(['added', 'rejected']),
    drug_id: UuidSchema.optional(),
  })
  .strict();

export const AdminResolveDrugResponseSchema = z
  .object({
    id: UuidSchema,
    status: z.enum(['added', 'rejected']),
  })
  .strict();

export const AdminMetricsResponseSchema = z
  .object({
    active_patients: z.number().int().nonnegative(),
    rx_issued_7d: z.number().int().nonnegative(),
    dispense_rate: z.number().min(0).max(1),
    override_rate_by_doctor: z.array(
      z
        .object({
          doctor_id: UuidSchema,
          doctor_name: z.string(),
          override_rate: z.number().min(0).max(1),
        })
        .strict(),
    ),
    face_enrolment_coverage: z.number().min(0).max(1),
    ai_red_flags_7d: z.number().int().nonnegative(),
  })
  .strict();
