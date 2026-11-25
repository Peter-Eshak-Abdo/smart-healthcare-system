import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appName.
  ///
  /// In ar, this message translates to:
  /// **'سمارت هيلث'**
  String get appName;

  /// No description provided for @appTagline.
  ///
  /// In ar, this message translates to:
  /// **'هوية واحدة. ملف واحد. أمان كامل.'**
  String get appTagline;

  /// No description provided for @navCommonLanguage.
  ///
  /// In ar, this message translates to:
  /// **'English'**
  String get navCommonLanguage;

  /// No description provided for @navCommonBack.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get navCommonBack;

  /// No description provided for @navCommonRetry.
  ///
  /// In ar, this message translates to:
  /// **'جرّب تاني'**
  String get navCommonRetry;

  /// No description provided for @navCommonCancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get navCommonCancel;

  /// No description provided for @navCommonSave.
  ///
  /// In ar, this message translates to:
  /// **'احفظ'**
  String get navCommonSave;

  /// No description provided for @navCommonLogout.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get navCommonLogout;

  /// No description provided for @authLoginTitle.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً بيك في سمارت هيلث'**
  String get authLoginTitle;

  /// No description provided for @authPhoneOrEmail.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني أو رقم الموبايل'**
  String get authPhoneOrEmail;

  /// No description provided for @authPassword.
  ///
  /// In ar, this message translates to:
  /// **'كلمة السر'**
  String get authPassword;

  /// No description provided for @authSignInBtn.
  ///
  /// In ar, this message translates to:
  /// **'دخول'**
  String get authSignInBtn;

  /// No description provided for @authOfflineCardBtn.
  ///
  /// In ar, this message translates to:
  /// **'افتح كارت الطوارئ بدون نت'**
  String get authOfflineCardBtn;

  /// No description provided for @modePatient.
  ///
  /// In ar, this message translates to:
  /// **'المريض'**
  String get modePatient;

  /// No description provided for @modeParamedic.
  ///
  /// In ar, this message translates to:
  /// **'الإسعاف والطوارئ'**
  String get modeParamedic;

  /// No description provided for @modePharmacist.
  ///
  /// In ar, this message translates to:
  /// **'الصيدلي'**
  String get modePharmacist;

  /// No description provided for @tabHome.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get tabHome;

  /// No description provided for @tabHistory.
  ///
  /// In ar, this message translates to:
  /// **'السجل'**
  String get tabHistory;

  /// No description provided for @tabAssistant.
  ///
  /// In ar, this message translates to:
  /// **'المساعد'**
  String get tabAssistant;

  /// No description provided for @tabProfile.
  ///
  /// In ar, this message translates to:
  /// **'ملفي'**
  String get tabProfile;

  /// No description provided for @patientGenerateCode.
  ///
  /// In ar, this message translates to:
  /// **'اعمل كود مشاركة للدكتور'**
  String get patientGenerateCode;

  /// No description provided for @patientCodeValidity.
  ///
  /// In ar, this message translates to:
  /// **'الكود شغال لمدة 15 دقيقة وبيفتح قراءة وكتابة.'**
  String get patientCodeValidity;

  /// No description provided for @patientRevokeGrant.
  ///
  /// In ar, this message translates to:
  /// **'اقفل الإذن'**
  String get patientRevokeGrant;

  /// No description provided for @patientFaceBanner.
  ///
  /// In ar, this message translates to:
  /// **'فعّل بصمة الوش عشان الإسعاف يوصلك في الطوارئ'**
  String get patientFaceBanner;

  /// No description provided for @patientFaceEnrolCta.
  ///
  /// In ar, this message translates to:
  /// **'سجّل بصمة الوش'**
  String get patientFaceEnrolCta;

  /// No description provided for @patientFaceHint.
  ///
  /// In ar, this message translates to:
  /// **'حرّك راسك يمين بسيط'**
  String get patientFaceHint;

  /// No description provided for @patientActiveRx.
  ///
  /// In ar, this message translates to:
  /// **'الروشتات الفعّالة'**
  String get patientActiveRx;

  /// No description provided for @patientShowQr.
  ///
  /// In ar, this message translates to:
  /// **'ورّي الصيدلي الكود'**
  String get patientShowQr;

  /// No description provided for @patientEmergencyContacts.
  ///
  /// In ar, this message translates to:
  /// **'جهات اتصال الطوارئ'**
  String get patientEmergencyContacts;

  /// No description provided for @patientLargeFont.
  ///
  /// In ar, this message translates to:
  /// **'تكبير الخط (سهولة القراءة)'**
  String get patientLargeFont;

  /// No description provided for @patientHistoryAll.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get patientHistoryAll;

  /// No description provided for @patientHistoryVisits.
  ///
  /// In ar, this message translates to:
  /// **'زيارات'**
  String get patientHistoryVisits;

  /// No description provided for @patientHistoryDiagnoses.
  ///
  /// In ar, this message translates to:
  /// **'تشخيصات'**
  String get patientHistoryDiagnoses;

  /// No description provided for @patientHistoryMeds.
  ///
  /// In ar, this message translates to:
  /// **'أدوية'**
  String get patientHistoryMeds;

  /// No description provided for @patientRestrictedToggle.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء عن الدكتور (مقيد)'**
  String get patientRestrictedToggle;

  /// No description provided for @assistantTitle.
  ///
  /// In ar, this message translates to:
  /// **'المساعد الطبي الذكي'**
  String get assistantTitle;

  /// No description provided for @assistantDisclaimer.
  ///
  /// In ar, this message translates to:
  /// **'ده توجيه مبدئي ومش تشخيص طبي. لو الأعراض زادت روح لأقرب دكتور.'**
  String get assistantDisclaimer;

  /// No description provided for @assistantPlaceholder.
  ///
  /// In ar, this message translates to:
  /// **'احكيلي حاسس بإيه النهارده...'**
  String get assistantPlaceholder;

  /// No description provided for @assistantSend.
  ///
  /// In ar, this message translates to:
  /// **'ابعت'**
  String get assistantSend;

  /// No description provided for @assistantRecommendedSpecialty.
  ///
  /// In ar, this message translates to:
  /// **'التخصص المقترح'**
  String get assistantRecommendedSpecialty;

  /// No description provided for @emergencyTakeoverTitle.
  ///
  /// In ar, this message translates to:
  /// **'حالة طارئة — اتصل بالإسعاف 123 فوراً'**
  String get emergencyTakeoverTitle;

  /// No description provided for @emergencyCall123.
  ///
  /// In ar, this message translates to:
  /// **'اتصل بـ 123 دلوقتي'**
  String get emergencyCall123;

  /// No description provided for @emergencyOfflineCardTitle.
  ///
  /// In ar, this message translates to:
  /// **'كارت الطوارئ الطبي'**
  String get emergencyOfflineCardTitle;

  /// No description provided for @emergencyOfflineNotice.
  ///
  /// In ar, this message translates to:
  /// **'مفيش نت — البيانات دي من آخر مزامنة محفوظة مشفّرة'**
  String get emergencyOfflineNotice;

  /// No description provided for @erModeFace.
  ///
  /// In ar, this message translates to:
  /// **'مسح الوجه (AI)'**
  String get erModeFace;

  /// No description provided for @erModeQr.
  ///
  /// In ar, this message translates to:
  /// **'كارت الطوارئ QR'**
  String get erModeQr;

  /// No description provided for @erModeId.
  ///
  /// In ar, this message translates to:
  /// **'الرقم القومي'**
  String get erModeId;

  /// No description provided for @erScanButton.
  ///
  /// In ar, this message translates to:
  /// **'مسح فوري'**
  String get erScanButton;

  /// No description provided for @erCloseSession.
  ///
  /// In ar, this message translates to:
  /// **'اقفل جلسة الطوارئ'**
  String get erCloseSession;

  /// No description provided for @erExtendSession.
  ///
  /// In ar, this message translates to:
  /// **'تمديد الجلسة'**
  String get erExtendSession;

  /// No description provided for @erCallContact.
  ///
  /// In ar, this message translates to:
  /// **'اتصل بجهة الطوارئ'**
  String get erCallContact;

  /// No description provided for @erUnregisteredTitle.
  ///
  /// In ar, this message translates to:
  /// **'مريض غير مسجل — بروتوكول طوارئ سريع'**
  String get erUnregisteredTitle;

  /// No description provided for @erUnregisteredBody.
  ///
  /// In ar, this message translates to:
  /// **'مفيش ملف متسجل. استخدم الرقم القومي أو كمل الإسعاف الفوري.'**
  String get erUnregisteredBody;

  /// No description provided for @rxVerifyScan.
  ///
  /// In ar, this message translates to:
  /// **'امسح كود الروشتة SH1.'**
  String get rxVerifyScan;

  /// No description provided for @rxManualTitle.
  ///
  /// In ar, this message translates to:
  /// **'تحقق يدوي برقم الروشتة'**
  String get rxManualTitle;

  /// No description provided for @rxTamperBlock.
  ///
  /// In ar, this message translates to:
  /// **'الروشتة دي مش سليمة — ماتصرفهاش'**
  String get rxTamperBlock;

  /// No description provided for @rxAlreadyDispensed.
  ///
  /// In ar, this message translates to:
  /// **'الروشتة اتصرفت بالكامل قبل كده'**
  String get rxAlreadyDispensed;

  /// No description provided for @rxOfflineWarn.
  ///
  /// In ar, this message translates to:
  /// **'مفيش نت: الصرف بيحتاج اتصال مباشر بالسيرفر.'**
  String get rxOfflineWarn;

  /// No description provided for @rxDispenseBtn.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الصرف'**
  String get rxDispenseBtn;

  /// No description provided for @authDownloadAndroidApk.
  ///
  /// In ar, this message translates to:
  /// **'حمّل تطبيق الأندرويد (APK)'**
  String get authDownloadAndroidApk;

  /// No description provided for @platformCameraUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'الكاميرا مش متاحة على الجهاز ده. استخدم الرقم القومي أو افتح من الموبايل.'**
  String get platformCameraUnavailable;

  /// No description provided for @platformScannerUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'ماسح QR المباشر مش متاح على النظام ده. اكتب كود الروشتة SH1. يدوي تحت.'**
  String get platformScannerUnavailable;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
