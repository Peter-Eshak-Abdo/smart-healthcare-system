import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { ErrorCodeEnum, FieldErrorSchema, ProblemDetailsSchema } from '../src/errors.js';
import {
  AccessGrantsResponseSchema,
  AccessLogQuerySchema,
  AccessLogResponseSchema,
  CreateShareCodeRequestSchema,
  CreateShareCodeResponseSchema,
  GrantIdParamSchema,
} from '../src/schemas/access.js';
import {
  AdminAddFacilityMemberRequestSchema,
  AdminAddFacilityMemberResponseSchema,
  AdminApprovalResponseSchema,
  AdminAuditEventsResponseSchema,
  AdminAuditIntegrityResponseSchema,
  AdminAuditQuerySchema,
  AdminEmergencySessionsQuerySchema,
  AdminEmergencySessionsResponseSchema,
  AdminFacilitiesResponseSchema,
  AdminFacilityDtoSchema,
  AdminFacilityInputSchema,
  AdminFacilityPatchSchema,
  AdminInviteUserRequestSchema,
  AdminInviteUserResponseSchema,
  AdminMetricsResponseSchema,
  AdminResolveDrugRequestSchema,
  AdminResolveDrugResponseSchema,
  AdminReviewEmergencySessionRequestSchema,
  AdminReviewEmergencySessionResponseSchema,
  AdminSecurityFlagsResponseSchema,
  AdminSetLicenseStatusRequestSchema,
  AdminSetLicenseStatusResponseSchema,
  AdminSetUserRoleRequestSchema,
  AdminSetUserRoleResponseSchema,
  AdminSetUserStatusRequestSchema,
  AdminSetUserStatusResponseSchema,
  AdminUsersQuerySchema,
  AdminUsersResponseSchema,
} from '../src/schemas/admin.js';
import {
  DeviceIdParamSchema,
  RegisterAccountRequestSchema,
  RegisterAccountResponseSchema,
  RegisterDeviceRequestSchema,
  RegisterDeviceResponseSchema,
  StepUpChallengeRequestSchema,
  StepUpChallengeResponseSchema,
  StepUpVerifyRequestSchema,
  StepUpVerifyResponseSchema,
} from '../src/schemas/auth.js';
import {
  BiometricChallengeQuerySchema,
  BiometricChallengeResponseSchema,
  BiometricEnrollResponseSchema,
} from '../src/schemas/biometric.js';
import {
  AppRoleSchema,
  BloodTypeSchema,
  HealthResponseSchema,
  IdParamSchema,
  LocalizedTextSchema,
  PageMetaSchema,
  PaginationQuerySchema,
  SexSchema,
} from '../src/schemas/common.js';
import {
  ConditionDtoSchema,
  CreateAddendumRequestSchema,
  CreateAddendumResponseSchema,
  CreateConditionRequestSchema,
  CreateDiagnosisRequestSchema,
  CreateDiagnosisResponseSchema,
  CreateEncounterRequestSchema,
  CreateEncounterResponseSchema,
  DoctorPatientsQuerySchema,
  DoctorPatientsResponseSchema,
  DoctorPatientSummaryResponseSchema,
  DoctorUpdateBloodTypeRequestSchema,
  EnteredInErrorRequestSchema,
  EnteredInErrorResponseSchema,
  PatchConditionRequestSchema,
  PatchEncounterRequestSchema,
  PatchEncounterResponseSchema,
  PatientAllergyParamSchema,
  PatientConditionParamSchema,
  PatientIdParamSchema,
  RedeemShareCodeRequestSchema,
  RedeemShareCodeResponseSchema,
  VerifyAllergyRequestSchema,
} from '../src/schemas/doctor.js';
import { MeResponseSchema, PatchMePendingResponseSchema, PatchMeRequestSchema } from '../src/schemas/me.js';
import {
  AllergyDtoSchema,
  ConsentRequestSchema,
  ConsentResponseSchema,
  CreateAllergyRequestSchema,
  CriticalInfoResponseSchema,
  EmergencyCardResponseSchema,
  EmergencyContactDtoSchema,
  EmergencyContactInputSchema,
  EmergencyContactPatchSchema,
  EmergencyContactsResponseSchema,
  EncounterIdParamSchema,
  MedicalHistoryQuerySchema,
  MedicalHistoryResponseSchema,
  PatientEncounterDetailSchema,
  PatientOnboardingRequestSchema,
  PatientOnboardingResponseSchema,
  PatientPrescriptionsQuerySchema,
  PatientPrescriptionsResponseSchema,
  UpdateBloodTypeRequestSchema,
  UpdateBloodTypeResponseSchema,
  UpdateEncounterVisibilityRequestSchema,
  UpdateEncounterVisibilityResponseSchema,
} from '../src/schemas/patients.js';
import {
  RefAllergensResponseSchema,
  RefDrugsQuerySchema,
  RefDrugsResponseSchema,
  RefIcd10ResponseSchema,
  RefSearchQuerySchema,
  RefSpecialtiesResponseSchema,
} from '../src/schemas/ref.js';
import {
  JwksResponseSchema,
  MobileConfigResponseSchema,
  ReadyResponseSchema,
} from '../src/schemas/system.js';
import {
  CancelPrescriptionRequestSchema,
  CheckPrescriptionsRequestSchema,
  CheckPrescriptionsResponseSchema,
  DoctorPrescriptionsQuerySchema,
  DoctorPrescriptionsResponseSchema,
  IssuePrescriptionRequestSchema,
  PickupTokenResponseSchema,
  PrescriptionDetailSchema,
} from '../src/schemas/prescriptions.js';
import {
  AcquireLeaseRequestSchema,
  AcquireLeaseResponseSchema,
  DispenseRequestSchema,
  DispenseResponseSchema,
  PharmacyFaceVerifyResponseSchema,
  PharmacyGetPrescriptionResponseSchema,
  PharmacyHistoryQuerySchema,
  PharmacyHistoryResponseSchema,
  PharmacyPrescriptionQuerySchema,
  VerifyPrescriptionRequestSchema,
  VerifyPrescriptionResponseSchema,
} from '../src/schemas/pharmacy.js';
import {
  EmergencyConfirmCandidateRequestSchema,
  EmergencyIdentifyCardRequestSchema,
  EmergencyIdentifyManualRequestSchema,
  EmergencyIdentifyResponseSchema,
  EmergencyProfileResponseSchema,
  EmergencySessionContactsResponseSchema,
  EmergencySessionParamSchema,
  ExtendEmergencySessionRequestSchema,
  ExtendEmergencySessionResponseSchema,
  OfflineEmergencyEventsRequestSchema,
  OfflineEmergencyEventsResponseSchema,
} from '../src/schemas/emergency.js';
import {
  AssistantMessageResponseSchema,
  AssistantSessionDetailResponseSchema,
  AssistantSessionParamSchema,
  CreateAssistantSessionRequestSchema,
  CreateAssistantSessionResponseSchema,
  SendAssistantMessageRequestSchema,
} from '../src/schemas/assistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../openapi');
const outFile = path.join(outDir, 'smarthealth.v1.yaml');

const PROBLEM_RESPONSE = {
  description: 'RFC 9457 Problem Details error',
  content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
};

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { 'application/json': { schema } },
});

export function buildOpenApiDocument(): Record<string, unknown> {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  registry.register('ErrorCode', ErrorCodeEnum);
  registry.register('FieldError', FieldErrorSchema);
  registry.register('ProblemDetails', ProblemDetailsSchema);
  registry.register('LocalizedText', LocalizedTextSchema);
  registry.register('AppRole', AppRoleSchema);
  registry.register('Sex', SexSchema);
  registry.register('BloodType', BloodTypeSchema);
  registry.register('PageMeta', PageMetaSchema);
  registry.register('HealthResponse', HealthResponseSchema);

  const authSec = [{ BearerAuth: [] }];

  // System endpoints
  registry.registerPath({
    method: 'get',
    path: '/v1/health',
    summary: 'Service liveness check',
    tags: ['System'],
    responses: {
      200: { description: 'Service is alive', ...jsonBody(HealthResponseSchema) },
      500: PROBLEM_RESPONSE,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/ready',
    summary: 'Service dependency readiness check',
    tags: ['System'],
    responses: {
      200: { description: 'Ready', ...jsonBody(ReadyResponseSchema) },
      503: PROBLEM_RESPONSE,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/.well-known/rx-jwks.json',
    summary: 'Ed25519 JWKS for verifying prescriptions and pickup tokens',
    tags: ['System'],
    responses: { 200: { description: 'JWKS', ...jsonBody(JwksResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/.well-known/emergency-card-jwks.json',
    summary: 'Ed25519 JWKS for verifying offline emergency medical ID cards',
    tags: ['System'],
    responses: { 200: { description: 'JWKS', ...jsonBody(JwksResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/config/mobile',
    summary: 'Mobile client minimum versions and feature flags',
    tags: ['System'],
    responses: { 200: { description: 'Mobile config', ...jsonBody(MobileConfigResponseSchema) } },
  });

  // Auth & Step-up
  registry.registerPath({
    method: 'post',
    path: '/v1/auth/register',
    summary: 'Self-service account registration (patient active immediately; clinical staff pending licence review)',
    tags: ['Auth'],
    request: { body: jsonBody(RegisterAccountRequestSchema) },
    responses: {
      201: { description: 'Account created', ...jsonBody(RegisterAccountResponseSchema) },
      409: PROBLEM_RESPONSE,
      422: PROBLEM_RESPONSE,
      429: PROBLEM_RESPONSE,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/auth/devices',
    summary: 'Register device P-256 public key for biometric step-up',
    tags: ['Auth'],
    security: authSec,
    request: { body: jsonBody(RegisterDeviceRequestSchema) },
    responses: {
      201: { description: 'Device registered', ...jsonBody(RegisterDeviceResponseSchema) },
      403: PROBLEM_RESPONSE,
      409: PROBLEM_RESPONSE,
      422: PROBLEM_RESPONSE,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/auth/devices/{deviceId}',
    summary: 'Revoke registered device',
    tags: ['Auth'],
    security: authSec,
    request: { params: DeviceIdParamSchema },
    responses: { 204: { description: 'Revoked' }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/auth/step-up/challenge',
    summary: 'Request biometric step-up signing challenge',
    tags: ['Auth'],
    security: authSec,
    request: { body: jsonBody(StepUpChallengeRequestSchema) },
    responses: { 200: { description: 'Challenge', ...jsonBody(StepUpChallengeResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/auth/step-up/verify',
    summary: 'Verify device signature and obtain step-up token',
    tags: ['Auth'],
    security: authSec,
    request: { body: jsonBody(StepUpVerifyRequestSchema) },
    responses: { 200: { description: 'Step-up token', ...jsonBody(StepUpVerifyResponseSchema) }, 401: PROBLEM_RESPONSE, 410: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/auth/logout-all',
    summary: 'Revoke all sessions across devices',
    tags: ['Auth'],
    security: authSec,
    responses: { 204: { description: 'All sessions revoked' }, 403: PROBLEM_RESPONSE },
  });

  // Me
  registry.registerPath({
    method: 'get',
    path: '/v1/me',
    summary: 'Get authenticated user profile, roles, and permissions',
    tags: ['Account'],
    security: authSec,
    responses: { 200: { description: 'Account summary', ...jsonBody(MeResponseSchema) }, 401: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/me',
    summary: 'Update self profile fields',
    tags: ['Account'],
    security: authSec,
    request: { body: jsonBody(PatchMeRequestSchema) },
    responses: {
      200: { description: 'Updated profile', ...jsonBody(MeResponseSchema) },
      202: { description: 'Phone change pending OTP', ...jsonBody(PatchMePendingResponseSchema) },
      422: PROBLEM_RESPONSE,
    },
  });

  // Patient endpoints
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/onboarding',
    summary: 'Complete patient identity onboarding',
    tags: ['Patient'],
    security: authSec,
    request: { body: jsonBody(PatientOnboardingRequestSchema) },
    responses: { 201: { description: 'Onboarded', ...jsonBody(PatientOnboardingResponseSchema) }, 409: PROBLEM_RESPONSE, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/consents',
    summary: 'Grant or withdraw patient consent',
    tags: ['Patient'],
    security: authSec,
    request: { body: jsonBody(ConsentRequestSchema) },
    responses: { 201: { description: 'Recorded', ...jsonBody(ConsentResponseSchema) }, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/critical-info',
    summary: 'Read own critical health summary',
    tags: ['Patient'],
    security: authSec,
    responses: { 200: { description: 'Critical info', ...jsonBody(CriticalInfoResponseSchema) } },
  });
  registry.registerPath({
    method: 'put',
    path: '/v1/patients/me/blood-type',
    summary: 'Update patient-reported blood type',
    tags: ['Patient'],
    security: authSec,
    request: { body: jsonBody(UpdateBloodTypeRequestSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(UpdateBloodTypeResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/allergies',
    summary: 'Report an allergy',
    tags: ['Patient'],
    security: authSec,
    request: { body: jsonBody(CreateAllergyRequestSchema) },
    responses: { 201: { description: 'Created', ...jsonBody(AllergyDtoSchema) }, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/patients/me/allergies/{id}',
    summary: 'Delete patient-reported allergy',
    tags: ['Patient'],
    security: authSec,
    request: { params: IdParamSchema },
    responses: { 204: { description: 'Deleted' }, 403: PROBLEM_RESPONSE, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/medical-history',
    summary: 'List patient medical history timeline',
    tags: ['Patient'],
    security: authSec,
    request: { query: MedicalHistoryQuerySchema },
    responses: { 200: { description: 'History page', ...jsonBody(MedicalHistoryResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/encounters/{encounterId}',
    summary: 'Get encounter detail (excludes notes_internal)',
    tags: ['Patient'],
    security: authSec,
    request: { params: EncounterIdParamSchema },
    responses: { 200: { description: 'Encounter detail', ...jsonBody(PatientEncounterDetailSchema) }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/patients/me/encounters/{encounterId}/visibility',
    summary: 'Toggle encounter restricted visibility',
    tags: ['Patient'],
    security: authSec,
    request: { params: EncounterIdParamSchema, body: jsonBody(UpdateEncounterVisibilityRequestSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(UpdateEncounterVisibilityResponseSchema) }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/prescriptions',
    summary: 'List patient prescriptions',
    tags: ['Patient'],
    security: authSec,
    request: { query: PatientPrescriptionsQuerySchema },
    responses: { 200: { description: 'Prescriptions page', ...jsonBody(PatientPrescriptionsResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/emergency-contacts',
    summary: 'List emergency contacts',
    tags: ['Patient'],
    security: authSec,
    responses: { 200: { description: 'Contacts', ...jsonBody(EmergencyContactsResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/emergency-contacts',
    summary: 'Create emergency contact',
    tags: ['Patient'],
    security: authSec,
    request: { body: jsonBody(EmergencyContactInputSchema) },
    responses: { 201: { description: 'Created', ...jsonBody(EmergencyContactDtoSchema) }, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/patients/me/emergency-contacts/{id}',
    summary: 'Update emergency contact',
    tags: ['Patient'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(EmergencyContactPatchSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(EmergencyContactDtoSchema) }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/patients/me/emergency-contacts/{id}',
    summary: 'Soft-delete emergency contact',
    tags: ['Patient'],
    security: authSec,
    request: { params: IdParamSchema },
    responses: { 204: { description: 'Deleted' }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/emergency-card',
    summary: 'Issue signed offline Emergency Medical ID card JWS',
    tags: ['Patient'],
    security: authSec,
    responses: { 200: { description: 'Signed emergency card', ...jsonBody(EmergencyCardResponseSchema) } },
  });

  // Access & Biometric
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/share-codes',
    summary: 'Create short-lived doctor share code',
    tags: ['Access'],
    security: authSec,
    request: { body: jsonBody(CreateShareCodeRequestSchema) },
    responses: { 201: { description: 'Share code', ...jsonBody(CreateShareCodeResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/access-grants',
    summary: 'List patient access grants',
    tags: ['Access'],
    security: authSec,
    responses: { 200: { description: 'Grants', ...jsonBody(AccessGrantsResponseSchema) } },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/patients/me/access-grants/{grantId}',
    summary: 'Revoke doctor access grant',
    tags: ['Access'],
    security: authSec,
    request: { params: GrantIdParamSchema },
    responses: { 204: { description: 'Revoked' }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/access-log',
    summary: 'Read patient privacy audit log',
    tags: ['Access'],
    security: authSec,
    request: { query: AccessLogQuerySchema },
    responses: { 200: { description: 'Access log', ...jsonBody(AccessLogResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/biometric/challenge',
    summary: 'Issue biometric active liveness challenge',
    tags: ['Biometrics'],
    security: authSec,
    request: { query: BiometricChallengeQuerySchema },
    responses: { 200: { description: 'Challenge', ...jsonBody(BiometricChallengeResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/biometrics/face',
    summary: 'Enroll patient face template via liveness frames',
    tags: ['Biometrics'],
    security: authSec,
    responses: { 201: { description: 'Enrolled', ...jsonBody(BiometricEnrollResponseSchema) }, 403: PROBLEM_RESPONSE, 409: PROBLEM_RESPONSE, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/patients/me/biometrics/face',
    summary: 'Delete patient face biometric templates',
    tags: ['Biometrics'],
    security: authSec,
    responses: { 204: { description: 'Deleted' }, 403: PROBLEM_RESPONSE },
  });

  // Doctor endpoints
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/access/redeem',
    summary: 'Redeem patient share code for access grant',
    tags: ['Doctor'],
    security: authSec,
    request: { body: jsonBody(RedeemShareCodeRequestSchema) },
    responses: { 201: { description: 'Grant issued', ...jsonBody(RedeemShareCodeResponseSchema) }, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/doctor/patients',
    summary: 'Search patients with active grants for current doctor',
    tags: ['Doctor'],
    security: authSec,
    request: { query: DoctorPatientsQuerySchema },
    responses: { 200: { description: 'Patients', ...jsonBody(DoctorPatientsResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/doctor/patients/{patientId}/summary',
    summary: 'Read clinical patient summary',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientIdParamSchema },
    responses: { 200: { description: 'Patient summary', ...jsonBody(DoctorPatientSummaryResponseSchema) }, 403: PROBLEM_RESPONSE, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/doctor/patients/{patientId}/history',
    summary: 'Read clinical medical history (masks external restricted records)',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientIdParamSchema, query: MedicalHistoryQuerySchema },
    responses: { 200: { description: 'History', ...jsonBody(MedicalHistoryResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/patients/{patientId}/encounters',
    summary: 'Create new encounter',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientIdParamSchema, body: jsonBody(CreateEncounterRequestSchema) },
    responses: { 201: { description: 'Encounter created', ...jsonBody(CreateEncounterResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/doctor/encounters/{encounterId}',
    summary: 'Update or close encounter',
    tags: ['Doctor'],
    security: authSec,
    request: { params: EncounterIdParamSchema, body: jsonBody(PatchEncounterRequestSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(PatchEncounterResponseSchema) }, 409: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/encounters/{encounterId}/addenda',
    summary: 'Append immutable addendum to encounter',
    tags: ['Doctor'],
    security: authSec,
    request: { params: EncounterIdParamSchema, body: jsonBody(CreateAddendumRequestSchema) },
    responses: { 201: { description: 'Addendum added', ...jsonBody(CreateAddendumResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/encounters/{encounterId}/entered-in-error',
    summary: 'Mark encounter entered in error',
    tags: ['Doctor'],
    security: authSec,
    request: { params: EncounterIdParamSchema, body: jsonBody(EnteredInErrorRequestSchema) },
    responses: { 200: { description: 'Marked entered in error', ...jsonBody(EnteredInErrorResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/encounters/{encounterId}/diagnoses',
    summary: 'Record encounter diagnosis',
    tags: ['Doctor'],
    security: authSec,
    request: { params: EncounterIdParamSchema, body: jsonBody(CreateDiagnosisRequestSchema) },
    responses: { 201: { description: 'Diagnosis created', ...jsonBody(CreateDiagnosisResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/patients/{patientId}/conditions',
    summary: 'Record clinician-confirmed chronic condition',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientIdParamSchema, body: jsonBody(CreateConditionRequestSchema) },
    responses: { 201: { description: 'Condition created', ...jsonBody(ConditionDtoSchema) } },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/doctor/patients/{patientId}/conditions/{id}',
    summary: 'Update condition status',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientConditionParamSchema, body: jsonBody(PatchConditionRequestSchema) },
    responses: { 200: { description: 'Condition updated', ...jsonBody(ConditionDtoSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/doctor/patients/{patientId}/allergies',
    summary: 'Record clinician-confirmed allergy',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientIdParamSchema, body: jsonBody(CreateAllergyRequestSchema) },
    responses: { 201: { description: 'Allergy created', ...jsonBody(AllergyDtoSchema) } },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/doctor/patients/{patientId}/allergies/{id}',
    summary: 'Confirm or refute patient allergy',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientAllergyParamSchema, body: jsonBody(VerifyAllergyRequestSchema) },
    responses: { 200: { description: 'Allergy updated', ...jsonBody(AllergyDtoSchema) } },
  });
  registry.registerPath({
    method: 'put',
    path: '/v1/doctor/patients/{patientId}/blood-type',
    summary: 'Confirm patient blood type',
    tags: ['Doctor'],
    security: authSec,
    request: { params: PatientIdParamSchema, body: jsonBody(DoctorUpdateBloodTypeRequestSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(UpdateBloodTypeResponseSchema) } },
  });

  // Reference data
  registry.registerPath({
    method: 'get',
    path: '/v1/ref/drugs',
    summary: 'Search active drug catalog or generic equivalents',
    tags: ['Reference'],
    security: authSec,
    request: { query: RefDrugsQuerySchema },
    responses: { 200: { description: 'Drugs', ...jsonBody(RefDrugsResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/ref/icd10',
    summary: 'Search ICD-10 diagnostic codes',
    tags: ['Reference'],
    security: authSec,
    request: { query: RefSearchQuerySchema },
    responses: { 200: { description: 'ICD-10 codes', ...jsonBody(RefIcd10ResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/ref/allergens',
    summary: 'Search ingredients and drug classes for allergy coding',
    tags: ['Reference'],
    security: authSec,
    request: { query: RefSearchQuerySchema },
    responses: { 200: { description: 'Allergens', ...jsonBody(RefAllergensResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/ref/specialties',
    summary: 'List medical specialties',
    tags: ['Reference'],
    security: authSec,
    responses: { 200: { description: 'Specialties', ...jsonBody(RefSpecialtiesResponseSchema) } },
  });

  // Admin endpoints
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/users',
    summary: 'List platform users (non-PHI)',
    tags: ['Admin'],
    security: authSec,
    request: { query: AdminUsersQuerySchema },
    responses: { 200: { description: 'Users', ...jsonBody(AdminUsersResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/admin/users',
    summary: 'Invite clinical staff or admin user',
    tags: ['Admin'],
    security: authSec,
    request: { body: jsonBody(AdminInviteUserRequestSchema) },
    responses: { 201: { description: 'Invited', ...jsonBody(AdminInviteUserResponseSchema) }, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/admin/users/{id}/status',
    summary: 'Suspend, reactivate, or deactivate user',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminSetUserStatusRequestSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(AdminSetUserStatusResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/admin/users/{id}/role',
    summary: 'Change user role (two-person approval for admin promotion)',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminSetUserRoleRequestSchema) },
    responses: {
      200: { description: 'Role updated', ...jsonBody(AdminSetUserRoleResponseSchema) },
      202: { description: 'Pending second admin approval', ...jsonBody(AdminSetUserRoleResponseSchema) },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/admin/approvals/{id}/approve',
    summary: 'Approve sensitive pending admin action',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema },
    responses: { 200: { description: 'Approved', ...jsonBody(AdminApprovalResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/admin/practitioners/{id}/license',
    summary: 'Update practitioner license status',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminSetLicenseStatusRequestSchema) },
    responses: { 200: { description: 'Updated', ...jsonBody(AdminSetLicenseStatusResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/facilities',
    summary: 'List facilities',
    tags: ['Admin'],
    security: authSec,
    responses: { 200: { description: 'Facilities', ...jsonBody(AdminFacilitiesResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/admin/facilities',
    summary: 'Create facility',
    tags: ['Admin'],
    security: authSec,
    request: { body: jsonBody(AdminFacilityInputSchema) },
    responses: { 201: { description: 'Facility created', ...jsonBody(AdminFacilityDtoSchema) } },
  });
  registry.registerPath({
    method: 'patch',
    path: '/v1/admin/facilities/{id}',
    summary: 'Update facility',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminFacilityPatchSchema) },
    responses: { 200: { description: 'Facility updated', ...jsonBody(AdminFacilityDtoSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/admin/facilities/{id}/members',
    summary: 'Add practitioner membership to facility',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminAddFacilityMemberRequestSchema) },
    responses: { 201: { description: 'Member added', ...jsonBody(AdminAddFacilityMemberResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/audit-events',
    summary: 'Search immutable system audit log',
    tags: ['Admin'],
    security: authSec,
    request: { query: AdminAuditQuerySchema },
    responses: { 200: { description: 'Audit log page', ...jsonBody(AdminAuditEventsResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/audit-events/export',
    summary: 'Export non-PHI audit events CSV',
    tags: ['Admin'],
    security: authSec,
    request: { query: AdminAuditQuerySchema },
    responses: { 200: { description: 'CSV export' } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/audit-integrity',
    summary: 'Verify SHA-256 hash chain integrity of audit log',
    tags: ['Admin'],
    security: authSec,
    responses: { 200: { description: 'Integrity result', ...jsonBody(AdminAuditIntegrityResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/emergency-sessions',
    summary: 'List break-glass emergency sessions for compliance review',
    tags: ['Admin'],
    security: authSec,
    request: { query: AdminEmergencySessionsQuerySchema },
    responses: { 200: { description: 'Emergency sessions', ...jsonBody(AdminEmergencySessionsResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/admin/emergency-sessions/{id}/review',
    summary: 'Record compliance review on emergency session',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminReviewEmergencySessionRequestSchema) },
    responses: { 200: { description: 'Reviewed', ...jsonBody(AdminReviewEmergencySessionResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/security-flags',
    summary: 'List active abuse/liveness security flags',
    tags: ['Admin'],
    security: authSec,
    request: { query: PaginationQuerySchema },
    responses: { 200: { description: 'Security flags', ...jsonBody(AdminSecurityFlagsResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/admin/drug-requests/{id}/resolve',
    summary: 'Resolve missing drug catalogue request',
    tags: ['Admin'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AdminResolveDrugRequestSchema) },
    responses: { 200: { description: 'Resolved', ...jsonBody(AdminResolveDrugResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/admin/metrics',
    summary: 'Aggregate platform metrics',
    tags: ['Admin'],
    security: authSec,
    responses: { 200: { description: 'KPI metrics', ...jsonBody(AdminMetricsResponseSchema) } },
  });

  // Patient Prescriptions detail + pickup token
  registry.registerPath({
    method: 'get',
    path: '/v1/patients/me/prescriptions/{id}',
    summary: 'Get patient prescription details',
    tags: ['Patient'],
    security: authSec,
    request: { params: IdParamSchema },
    responses: { 200: { description: 'Prescription detail', ...jsonBody(PrescriptionDetailSchema) }, 404: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/patients/me/prescriptions/{id}/pickup-tokens',
    summary: 'Generate signed single-use prescription pickup QR token',
    tags: ['Patient'],
    security: authSec,
    request: { params: IdParamSchema },
    responses: { 201: { description: 'Pickup token', ...jsonBody(PickupTokenResponseSchema) }, 403: PROBLEM_RESPONSE, 409: PROBLEM_RESPONSE },
  });

  // Prescriptions (Doctor)
  registry.registerPath({
    method: 'post',
    path: '/v1/prescriptions/check',
    summary: 'Run deterministic drug interaction & allergy check on draft Rx',
    tags: ['Prescriptions'],
    security: authSec,
    request: { body: jsonBody(CheckPrescriptionsRequestSchema) },
    responses: { 200: { description: 'Safety alerts', ...jsonBody(CheckPrescriptionsResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/prescriptions',
    summary: 'Issue signed E-Prescription',
    tags: ['Prescriptions'],
    security: authSec,
    request: { body: jsonBody(IssuePrescriptionRequestSchema) },
    responses: { 201: { description: 'Issued prescription', ...jsonBody(PrescriptionDetailSchema) }, 422: PROBLEM_RESPONSE, 409: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/prescriptions/{id}/cancel',
    summary: 'Cancel remaining prescription items',
    tags: ['Prescriptions'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(CancelPrescriptionRequestSchema) },
    responses: { 200: { description: 'Updated prescription', ...jsonBody(PrescriptionDetailSchema) }, 409: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/doctor/prescriptions',
    summary: 'List doctor issued prescriptions',
    tags: ['Prescriptions'],
    security: authSec,
    request: { query: DoctorPrescriptionsQuerySchema },
    responses: { 200: { description: 'Prescriptions', ...jsonBody(DoctorPrescriptionsResponseSchema) } },
  });

  // Pharmacy
  registry.registerPath({
    method: 'post',
    path: '/v1/pharmacy/prescriptions/verify',
    summary: 'Verify prescription via pickup token or paper code + presence proof',
    tags: ['Pharmacy'],
    security: authSec,
    request: { body: jsonBody(VerifyPrescriptionRequestSchema) },
    responses: { 200: { description: 'Verification result', ...jsonBody(VerifyPrescriptionResponseSchema) }, 401: PROBLEM_RESPONSE, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/pharmacy/prescriptions/{id}',
    summary: 'Read verified prescription for dispensing',
    tags: ['Pharmacy'],
    security: authSec,
    request: { params: IdParamSchema, query: PharmacyPrescriptionQuerySchema },
    responses: { 200: { description: 'Pharmacy Rx context', ...jsonBody(PharmacyGetPrescriptionResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/pharmacy/prescriptions/{id}/lease',
    summary: 'Acquire soft dispensing lease',
    tags: ['Pharmacy'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(AcquireLeaseRequestSchema) },
    responses: { 201: { description: 'Lease acquired', ...jsonBody(AcquireLeaseResponseSchema) }, 409: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/pharmacy/prescriptions/{id}/lease',
    summary: 'Release dispensing lease',
    tags: ['Pharmacy'],
    security: authSec,
    request: { params: IdParamSchema },
    responses: { 204: { description: 'Released' } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/pharmacy/prescriptions/{id}/dispensations',
    summary: 'Dispense full or partial prescription items atomically',
    tags: ['Pharmacy'],
    security: authSec,
    request: { params: IdParamSchema, body: jsonBody(DispenseRequestSchema) },
    responses: { 201: { description: 'Dispensed', ...jsonBody(DispenseResponseSchema) }, 409: PROBLEM_RESPONSE, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/pharmacy/face-verifications',
    summary: '1:1 presence face check at pharmacy counter',
    tags: ['Pharmacy'],
    security: authSec,
    responses: { 200: { description: 'Face verification result', ...jsonBody(PharmacyFaceVerifyResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/pharmacy/dispensations',
    summary: 'List pharmacy dispensing history',
    tags: ['Pharmacy'],
    security: authSec,
    request: { query: PharmacyHistoryQuerySchema },
    responses: { 200: { description: 'History', ...jsonBody(PharmacyHistoryResponseSchema) } },
  });

  // Emergency
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/identify',
    summary: 'Identify unresponsive patient via face biometrics',
    tags: ['Emergency'],
    security: authSec,
    responses: { 200: { description: 'Identification outcome', ...jsonBody(EmergencyIdentifyResponseSchema) }, 422: PROBLEM_RESPONSE, 503: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/identify/confirm',
    summary: 'Confirm candidate from possible_match tokens',
    tags: ['Emergency'],
    security: authSec,
    request: { body: jsonBody(EmergencyConfirmCandidateRequestSchema) },
    responses: { 200: { description: 'Session opened', ...jsonBody(EmergencyIdentifyResponseSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/identify/card',
    summary: 'Identify patient via signed Emergency Medical ID QR card',
    tags: ['Emergency'],
    security: authSec,
    request: { body: jsonBody(EmergencyIdentifyCardRequestSchema) },
    responses: { 200: { description: 'Session opened', ...jsonBody(EmergencyIdentifyResponseSchema) }, 422: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/identify/manual',
    summary: 'Identify patient via national ID or passport fallback',
    tags: ['Emergency'],
    security: authSec,
    request: { body: jsonBody(EmergencyIdentifyManualRequestSchema) },
    responses: { 200: { description: 'Match or no_match', ...jsonBody(EmergencyIdentifyResponseSchema) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/emergency/sessions/{sessionId}/profile',
    summary: 'Read strict closed Emergency Profile for active session',
    tags: ['Emergency'],
    security: authSec,
    request: { params: EmergencySessionParamSchema },
    responses: { 200: { description: 'Closed emergency profile', ...jsonBody(EmergencyProfileResponseSchema) }, 410: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/emergency/sessions/{sessionId}/contacts',
    summary: 'Read emergency contacts for active session (audited)',
    tags: ['Emergency'],
    security: authSec,
    request: { params: EmergencySessionParamSchema },
    responses: { 200: { description: 'Contacts', ...jsonBody(EmergencySessionContactsResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/sessions/{sessionId}/extend',
    summary: 'Extend emergency session once during active transport',
    tags: ['Emergency'],
    security: authSec,
    request: { params: EmergencySessionParamSchema, body: jsonBody(ExtendEmergencySessionRequestSchema) },
    responses: { 200: { description: 'Extended', ...jsonBody(ExtendEmergencySessionResponseSchema) }, 409: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/sessions/{sessionId}/close',
    summary: 'Close active emergency session',
    tags: ['Emergency'],
    security: authSec,
    request: { params: EmergencySessionParamSchema },
    responses: { 204: { description: 'Closed' } },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/emergency/offline-events',
    summary: 'Sync offline signed emergency card access audit events',
    tags: ['Emergency'],
    security: authSec,
    request: { body: jsonBody(OfflineEmergencyEventsRequestSchema) },
    responses: { 202: { description: 'Accepted', ...jsonBody(OfflineEmergencyEventsResponseSchema) } },
  });

  // Assistant
  registry.registerPath({
    method: 'post',
    path: '/v1/assistant/sessions',
    summary: 'Start patient symptom guidance session',
    tags: ['Assistant'],
    security: authSec,
    request: { body: jsonBody(CreateAssistantSessionRequestSchema) },
    responses: { 201: { description: 'Session created', ...jsonBody(CreateAssistantSessionResponseSchema) }, 403: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'post',
    path: '/v1/assistant/sessions/{sessionId}/messages',
    summary: 'Send symptom message for red-flag check and AI guidance',
    tags: ['Assistant'],
    security: authSec,
    request: { params: AssistantSessionParamSchema, body: jsonBody(SendAssistantMessageRequestSchema) },
    responses: { 200: { description: 'Triage response', ...jsonBody(AssistantMessageResponseSchema) }, 429: PROBLEM_RESPONSE },
  });
  registry.registerPath({
    method: 'get',
    path: '/v1/assistant/sessions/{sessionId}',
    summary: 'Read assistant session transcript',
    tags: ['Assistant'],
    security: authSec,
    request: { params: AssistantSessionParamSchema },
    responses: { 200: { description: 'Session transcript', ...jsonBody(AssistantSessionDetailResponseSchema) } },
  });
  registry.registerPath({
    method: 'delete',
    path: '/v1/assistant/sessions/{sessionId}',
    summary: 'Hard-delete assistant session and messages',
    tags: ['Assistant'],
    security: authSec,
    request: { params: AssistantSessionParamSchema },
    responses: { 204: { description: 'Deleted' } },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'SmartHealth API',
      version: '1.0.0',
      description: 'SmartHealth Digital Healthcare Platform API v1',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Local dev' },
      { url: 'https://api-staging.smarthealth.app', description: 'Staging' },
    ],
  }) as unknown as Record<string, unknown>;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(outDir, { recursive: true });
  const doc = buildOpenApiDocument();
  fs.writeFileSync(outFile, yaml.dump(doc, { noRefs: true, sortKeys: false }), 'utf8');
  process.stdout.write(`Generated ${outFile}\n`);
}
