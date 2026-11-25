// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'SmartHealth';

  @override
  String get appTagline => 'One identity. One record. Fully secure.';

  @override
  String get navCommonLanguage => 'العربية';

  @override
  String get navCommonBack => 'Back';

  @override
  String get navCommonRetry => 'Try again';

  @override
  String get navCommonCancel => 'Cancel';

  @override
  String get navCommonSave => 'Save';

  @override
  String get navCommonLogout => 'Sign out';

  @override
  String get authLoginTitle => 'Welcome to SmartHealth';

  @override
  String get authPhoneOrEmail => 'Email or mobile number';

  @override
  String get authPassword => 'Password';

  @override
  String get authSignInBtn => 'Sign in';

  @override
  String get authOfflineCardBtn => 'Open Offline Emergency Card';

  @override
  String get modePatient => 'Patient';

  @override
  String get modeParamedic => 'Paramedic ER';

  @override
  String get modePharmacist => 'Pharmacist';

  @override
  String get tabHome => 'Home';

  @override
  String get tabHistory => 'History';

  @override
  String get tabAssistant => 'AI Care';

  @override
  String get tabProfile => 'Profile';

  @override
  String get patientGenerateCode => 'Generate Doctor Share Code';

  @override
  String get patientCodeValidity =>
      'Valid for 15 minutes with clinical chart access.';

  @override
  String get patientRevokeGrant => 'Revoke';

  @override
  String get patientFaceBanner =>
      'Enroll face recognition for emergency paramedic lookup';

  @override
  String get patientFaceEnrolCta => 'Enroll Face ID';

  @override
  String get patientFaceHint => 'Turn your head slightly';

  @override
  String get patientActiveRx => 'Active Prescriptions';

  @override
  String get patientShowQr => 'Show Pickup QR';

  @override
  String get patientEmergencyContacts => 'Emergency Contacts';

  @override
  String get patientLargeFont => 'Large Accessible Font';

  @override
  String get patientHistoryAll => 'All';

  @override
  String get patientHistoryVisits => 'Visits';

  @override
  String get patientHistoryDiagnoses => 'Diagnoses';

  @override
  String get patientHistoryMeds => 'Medications';

  @override
  String get patientRestrictedToggle => 'Hide from doctors (Restricted)';

  @override
  String get assistantTitle => 'AI Medical Guidance';

  @override
  String get assistantDisclaimer =>
      'Initial guidance only, not a medical diagnosis. See a doctor if symptoms worsen.';

  @override
  String get assistantPlaceholder => 'Describe what you feel today...';

  @override
  String get assistantSend => 'Send';

  @override
  String get assistantRecommendedSpecialty => 'Recommended Specialty';

  @override
  String get emergencyTakeoverTitle =>
      'Emergency Alert — Call Ambulance 123 Now';

  @override
  String get emergencyCall123 => 'Call 123 Immediately';

  @override
  String get emergencyOfflineCardTitle => 'Medical Emergency ID Card';

  @override
  String get emergencyOfflineNotice =>
      'Offline — displaying encrypted locally cached emergency data';

  @override
  String get erModeFace => 'Face AI Scan';

  @override
  String get erModeQr => 'Emergency QR';

  @override
  String get erModeId => 'National ID';

  @override
  String get erScanButton => 'Capture & Identify';

  @override
  String get erCloseSession => 'Close ER Session';

  @override
  String get erExtendSession => 'Extend Session';

  @override
  String get erCallContact => 'Call Contact';

  @override
  String get erUnregisteredTitle => 'Unregistered Patient — ER Intake Protocol';

  @override
  String get erUnregisteredBody =>
      'No matching SmartHealth profile. Proceed with emergency ID fallback or direct stabilization.';

  @override
  String get rxVerifyScan => 'Scan SH1. Pickup QR';

  @override
  String get rxManualTitle => 'Manual Rx Verification';

  @override
  String get rxTamperBlock => 'Signature Invalid — Do NOT Dispense';

  @override
  String get rxAlreadyDispensed => 'Prescription already fully dispensed';

  @override
  String get rxOfflineWarn => 'Offline: dispensing requires a live connection.';

  @override
  String get rxDispenseBtn => 'Confirm Dispense';

  @override
  String get authDownloadAndroidApk => 'Download Android App (APK)';

  @override
  String get platformCameraUnavailable =>
      'Camera preview is unavailable on this device. Use National ID or run on mobile/web.';

  @override
  String get platformScannerUnavailable =>
      'Live QR camera scanner is unavailable on this platform. Enter the SH1. token manually below.';
}
