// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'سمارت هيلث';

  @override
  String get appTagline => 'هوية واحدة. ملف واحد. أمان كامل.';

  @override
  String get navCommonLanguage => 'English';

  @override
  String get navCommonBack => 'رجوع';

  @override
  String get navCommonRetry => 'جرّب تاني';

  @override
  String get navCommonCancel => 'إلغاء';

  @override
  String get navCommonSave => 'احفظ';

  @override
  String get navCommonLogout => 'تسجيل الخروج';

  @override
  String get authLoginTitle => 'أهلاً بيك في سمارت هيلث';

  @override
  String get authPhoneOrEmail => 'البريد الإلكتروني أو رقم الموبايل';

  @override
  String get authPassword => 'كلمة السر';

  @override
  String get authSignInBtn => 'دخول';

  @override
  String get authOfflineCardBtn => 'افتح كارت الطوارئ بدون نت';

  @override
  String get modePatient => 'المريض';

  @override
  String get modeParamedic => 'الإسعاف والطوارئ';

  @override
  String get modePharmacist => 'الصيدلي';

  @override
  String get tabHome => 'الرئيسية';

  @override
  String get tabHistory => 'السجل';

  @override
  String get tabAssistant => 'المساعد';

  @override
  String get tabProfile => 'ملفي';

  @override
  String get patientGenerateCode => 'اعمل كود مشاركة للدكتور';

  @override
  String get patientCodeValidity =>
      'الكود شغال لمدة 15 دقيقة وبيفتح قراءة وكتابة.';

  @override
  String get patientRevokeGrant => 'اقفل الإذن';

  @override
  String get patientFaceBanner =>
      'فعّل بصمة الوش عشان الإسعاف يوصلك في الطوارئ';

  @override
  String get patientFaceEnrolCta => 'سجّل بصمة الوش';

  @override
  String get patientFaceHint => 'حرّك راسك يمين بسيط';

  @override
  String get patientActiveRx => 'الروشتات الفعّالة';

  @override
  String get patientShowQr => 'ورّي الصيدلي الكود';

  @override
  String get patientEmergencyContacts => 'جهات اتصال الطوارئ';

  @override
  String get patientLargeFont => 'تكبير الخط (سهولة القراءة)';

  @override
  String get patientHistoryAll => 'الكل';

  @override
  String get patientHistoryVisits => 'زيارات';

  @override
  String get patientHistoryDiagnoses => 'تشخيصات';

  @override
  String get patientHistoryMeds => 'أدوية';

  @override
  String get patientRestrictedToggle => 'إخفاء عن الدكتور (مقيد)';

  @override
  String get assistantTitle => 'المساعد الطبي الذكي';

  @override
  String get assistantDisclaimer =>
      'ده توجيه مبدئي ومش تشخيص طبي. لو الأعراض زادت روح لأقرب دكتور.';

  @override
  String get assistantPlaceholder => 'احكيلي حاسس بإيه النهارده...';

  @override
  String get assistantSend => 'ابعت';

  @override
  String get assistantRecommendedSpecialty => 'التخصص المقترح';

  @override
  String get emergencyTakeoverTitle => 'حالة طارئة — اتصل بالإسعاف 123 فوراً';

  @override
  String get emergencyCall123 => 'اتصل بـ 123 دلوقتي';

  @override
  String get emergencyOfflineCardTitle => 'كارت الطوارئ الطبي';

  @override
  String get emergencyOfflineNotice =>
      'مفيش نت — البيانات دي من آخر مزامنة محفوظة مشفّرة';

  @override
  String get erModeFace => 'مسح الوجه (AI)';

  @override
  String get erModeQr => 'كارت الطوارئ QR';

  @override
  String get erModeId => 'الرقم القومي';

  @override
  String get erScanButton => 'مسح فوري';

  @override
  String get erCloseSession => 'اقفل جلسة الطوارئ';

  @override
  String get erExtendSession => 'تمديد الجلسة';

  @override
  String get erCallContact => 'اتصل بجهة الطوارئ';

  @override
  String get erUnregisteredTitle => 'مريض غير مسجل — بروتوكول طوارئ سريع';

  @override
  String get erUnregisteredBody =>
      'مفيش ملف متسجل. استخدم الرقم القومي أو كمل الإسعاف الفوري.';

  @override
  String get rxVerifyScan => 'امسح كود الروشتة SH1.';

  @override
  String get rxManualTitle => 'تحقق يدوي برقم الروشتة';

  @override
  String get rxTamperBlock => 'الروشتة دي مش سليمة — ماتصرفهاش';

  @override
  String get rxAlreadyDispensed => 'الروشتة اتصرفت بالكامل قبل كده';

  @override
  String get rxOfflineWarn => 'مفيش نت: الصرف بيحتاج اتصال مباشر بالسيرفر.';

  @override
  String get rxDispenseBtn => 'تأكيد الصرف';
}
