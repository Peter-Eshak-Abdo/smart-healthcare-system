import type { AppRole } from '@smarthealth/contracts';

export type Permission =
  | 'profile:read:self'
  | 'profile:update:self'
  | 'patient_record:read:self'
  | 'patient_record:read:granted'
  | 'patient_record:write:granted'
  | 'critical_info:read:self'
  | 'emergency_contact:manage:self'
  | 'access_grant:manage:self'
  | 'access_log:read:self'
  | 'biometric:enroll:self'
  | 'biometric:delete:self'
  | 'prescription:read:self'
  | 'prescription:check'
  | 'prescription:create'
  | 'prescription:cancel:own'
  | 'prescription:verify'
  | 'prescription:dispense'
  | 'emergency:identify'
  | 'emergency_profile:read:session'
  | 'emergency_contact:read:session'
  | 'assistant:use'
  | 'user:manage'
  | 'role:assign'
  | 'license:manage'
  | 'facility:manage'
  | 'audit:read'
  | 'emergency_session:review'
  | 'drug_catalog:read'
  | 'drug_catalog:manage';

export const ROLE_PERMISSIONS = {
  patient: [
    'profile:read:self',
    'profile:update:self',
    'patient_record:read:self',
    'critical_info:read:self',
    'emergency_contact:manage:self',
    'access_grant:manage:self',
    'access_log:read:self',
    'biometric:enroll:self',
    'biometric:delete:self',
    'prescription:read:self',
    'assistant:use',
  ],
  doctor: [
    'profile:read:self',
    'profile:update:self',
    'patient_record:read:granted',
    'patient_record:write:granted',
    'prescription:check',
    'prescription:create',
    'prescription:cancel:own',
    'drug_catalog:read',
  ],
  pharmacist: [
    'profile:read:self',
    'profile:update:self',
    'prescription:verify',
    'prescription:dispense',
    'drug_catalog:read',
  ],
  paramedic: [
    'profile:read:self',
    'profile:update:self',
    'emergency:identify',
    'emergency_profile:read:session',
    'emergency_contact:read:session',
  ],
  admin: [
    'profile:read:self',
    'profile:update:self',
    'user:manage',
    'role:assign',
    'license:manage',
    'audit:read',
    'emergency_session:review',
    'facility:manage',
    'drug_catalog:read',
    'drug_catalog:manage',
  ],
} as const satisfies Record<AppRole, readonly Permission[]>;

export const STAFF_ROLES: ReadonlySet<AppRole> = new Set([
  'doctor',
  'pharmacist',
  'paramedic',
  'admin',
]);
