import {
  ERROR_HTTP_STATUS,
  type ErrorCode,
  type FieldError,
  type Locale,
} from '@smarthealth/contracts';
import { ZodError } from 'zod';

function mapFirestoreError(err: unknown): AppError | null {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return null;
  }
  const code = (err as { code?: unknown }).code;
  // gRPC status codes used by Firestore Admin SDK: 6 = ALREADY_EXISTS, 9 = FAILED_PRECONDITION, 10 = ABORTED
  if (code === 6) {
    return new AppError('CONFLICT_VERSION', { statusOverride: 409, detail: 'already_exists' });
  }
  if (code === 9 || code === 10) {
    return new AppError('CONFLICT_VERSION', { detail: 'firestore_transaction_conflict' });
  }
  return null;
}

export interface AppErrorOptions {
  detail?: string;
  errors?: FieldError[];
  extra?: Record<string, unknown>;
  audit?: boolean;
  statusOverride?: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: string | undefined;
  readonly errors?: FieldError[] | undefined;
  readonly extra?: Record<string, unknown> | undefined;
  readonly audit: boolean;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.detail ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = options.statusOverride ?? ERROR_HTTP_STATUS[code];
    this.detail = options.detail;
    this.errors = options.errors;
    this.extra = options.extra;
    this.audit =
      options.audit ??
      (code === 'RBAC_FORBIDDEN' ||
        code === 'ACCESS_GRANT_REQUIRED' ||
        code === 'LICENSE_NOT_VALID' ||
        code === 'ACCOUNT_SUSPENDED');
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const TITLES: Record<ErrorCode, { en: string; ar: string }> = {
  AUTH_TOKEN_MISSING: {
    en: 'Authentication token is missing',
    ar: 'مطلوب تسجيل الدخول للمتابعة',
  },
  AUTH_TOKEN_INVALID: {
    en: 'Invalid authentication token',
    ar: 'بيانات الدخول غير صالحة',
  },
  AUTH_TOKEN_EXPIRED: {
    en: 'Your session has expired',
    ar: 'انتهت مدة الجلسة، سجل دخول من جديد',
  },
  AUTH_SESSION_REVOKED: {
    en: 'Your session was revoked',
    ar: 'تم إنهاء الجلسة، برجاء إعادة تسجيل الدخول',
  },
  AUTH_MFA_REQUIRED: {
    en: 'Two-factor authentication (TOTP) required',
    ar: 'مطلوب تأكيد التحقق بخطوتين',
  },
  AUTH_STEP_UP_REQUIRED: {
    en: 'Biometric or re-authentication step-up required',
    ar: 'مطلوب تأكيد الهوية لإتمام العملية',
  },
  AUTH_STEP_UP_INVALID: {
    en: 'Step-up verification failed or expired',
    ar: 'فشل تأكيد الهوية أو انتهت صلاحيته',
  },
  ACCOUNT_SUSPENDED: {
    en: 'Account is not active',
    ar: 'الحساب غير نشط أو موقوف مؤقتاً',
  },
  LICENSE_NOT_VALID: {
    en: 'Practitioner license is not active or verified',
    ar: 'الترخيص المهني غير مفعل أو منتهي الصلاحية',
  },
  RBAC_FORBIDDEN: {
    en: 'You are not allowed to perform this action',
    ar: 'غير مسموح لك بالوصول لهذا الإجراء',
  },
  ACCESS_GRANT_REQUIRED: {
    en: 'Active patient access grant is required',
    ar: 'مطلوب إذن وصول نشط من المريض',
  },
  RESOURCE_NOT_FOUND: {
    en: 'Resource not found',
    ar: 'البيانات المطلوبة غير موجودة',
  },
  VALIDATION_FAILED: {
    en: 'Input validation failed',
    ar: 'راجع البيانات المدخلة وحاول مرة أخرى',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    en: 'Idempotency-Key header is required',
    ar: 'رمز تأكيد الطلب مطلوب لإتمام العملية',
  },
  IDEMPOTENCY_KEY_CONFLICT: {
    en: 'Idempotency key conflict',
    ar: 'يوجد تعارض مع طلب سابق بنفس الرمز',
  },
  CONFLICT_VERSION: {
    en: 'Resource version conflict',
    ar: 'تم تحديث السجل بواسطة مستخدم آخر، أعد التحميل',
  },
  RATE_LIMITED: {
    en: 'Too many requests, please try again later',
    ar: 'محاولات كثيرة جداً، استنى شوية وحاول تاني',
  },
  RX_NOT_FOUND: {
    en: 'Prescription not found',
    ar: 'الروشتة غير موجودة',
  },
  RX_SIGNATURE_INVALID: {
    en: 'Prescription digital signature failed verification',
    ar: 'التوقيع الإلكتروني للروشتة غير سليم',
  },
  RX_EXPIRED: {
    en: 'Prescription has expired',
    ar: 'صلاحية الروشتة انتهت',
  },
  RX_CANCELLED: {
    en: 'Prescription was cancelled',
    ar: 'الروشتة ملغاة ولا يمكن صرفها',
  },
  RX_ALREADY_DISPENSED: {
    en: 'Prescription has already been fully dispensed',
    ar: 'تم صرف الروشتة بالكامل بالفعل',
  },
  RX_QUANTITY_EXCEEDED: {
    en: 'Requested quantity exceeds remaining quantity',
    ar: 'الكمية المطلوبة أكبر من المتبقي في الروشتة',
  },
  RX_LEASE_HELD: {
    en: 'Prescription is currently locked by another pharmacy',
    ar: 'الروشتة قيد الصرف حالياً في صيدلية أخرى',
  },
  RX_ALERT_OVERRIDE_REQUIRED: {
    en: 'Clinical alert override justification required',
    ar: 'لازم تكتب سبب طبي لتجاوز التحذير الدوائي',
  },
  RX_PRESCRIBER_INVALID: {
    en: 'Prescriber license has been revoked or flagged',
    ar: 'ترخيص الطبيب المصدر للروشتة غير ساري',
  },
  PICKUP_TOKEN_INVALID: {
    en: 'Prescription pickup token is invalid or expired',
    ar: 'رمز استلام الروشتة غير صالح أو منتهي',
  },
  EMERG_NO_MATCH: {
    en: 'No matching patient found',
    ar: 'مفيش ملف مطابق، جرب كارت الطوارئ أو الرقم القومي',
  },
  EMERG_SESSION_EXPIRED: {
    en: 'Emergency session has expired',
    ar: 'انتهت جلسة الطوارئ',
  },
  EMERG_CONTACTS_NOT_SHARED: {
    en: 'Patient has not shared emergency contacts',
    ar: 'المريض لم يشارك جهات اتصال الطوارئ',
  },
  BIO_NO_FACE: {
    en: 'No face detected in image',
    ar: 'مفيش وش واضح في الصورة، قرب وشك في الإضاءة',
  },
  BIO_MULTIPLE_FACES: {
    en: 'Multiple faces detected in frame',
    ar: 'في أكتر من شخص في الكادر، صور المريض لوحده',
  },
  BIO_LOW_QUALITY: {
    en: 'Image quality is too low for matching',
    ar: 'الإضاءة ضعيفة أو الصورة مهزوزة، جرب تاني',
  },
  BIO_LIVENESS_FAILED: {
    en: 'Liveness check did not pass',
    ar: 'التحقق الحيوي منعدم، جرب قدام كاميرا مباشرة',
  },
  BIO_CONSENT_REQUIRED: {
    en: 'Biometric enrollment consent is required',
    ar: 'موافقة البصمة البيومترية مطلوبة الأول',
  },
  BIO_ALREADY_ENROLLED: {
    en: 'Face is already enrolled under another account',
    ar: 'بصمة الوجه مسجلة بالفعل لحساب آخر',
  },
  AI_SERVICE_UNAVAILABLE: {
    en: 'AI clinical assistant service is temporarily unavailable',
    ar: 'خدمة المساعد الطبي غير متاحة مؤقتاً',
  },
  AI_TIMEOUT: {
    en: 'AI service timed out',
    ar: 'استغرق الرد وقت أطول من المتاح، حاول تاني',
  },
  FEATURE_NOT_IMPLEMENTED: {
    en: 'This feature is not enabled',
    ar: 'هذه الميزة غير مفعلة حالياً',
  },
  INTERNAL_ERROR: {
    en: 'Internal server error',
    ar: 'حصلت مشكلة تقنية عندنا، بنحاول نحلها',
  },
};

export function getErrorTitle(code: ErrorCode, locale: Locale): string {
  return TITLES[code][locale] ?? TITLES[code].en;
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  if (err instanceof ZodError) {
    return new AppError('VALIDATION_FAILED', {
      detail: 'request_validation_failed',
      errors: err.issues.map((issue) => ({
        path: issue.path.join('.') || 'body',
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  const fsMapped = mapFirestoreError(err);
  if (fsMapped) {
    return fsMapped;
  }
  return new AppError('INTERNAL_ERROR', { cause: err });
}
