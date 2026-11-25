import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/firebase_config.dart';
import '../network/api_client.dart';
import '../platform/platform_services.dart';
import '../security/device_key_service.dart';
import '../security/encrypted_storage.dart';
import '../security/step_up_service.dart';
import '../theme/app_theme.dart';

enum AppPortalMode { patient, paramedic, pharmacist }

final localeProvider = StateProvider<Locale>((Ref ref) => const Locale('ar'));
final themeModeProvider =
    StateProvider<ShThemeMode>((Ref ref) => ShThemeMode.light);
final largeFontProvider = StateProvider<bool>((Ref ref) => false);
final activeRoleModeProvider =
    StateProvider<AppPortalMode>((Ref ref) => AppPortalMode.patient);

const String _envApiBase = String.fromEnvironment('API_BASE_URL');

final encryptedStorageProvider =
    Provider<EncryptedStorage>((Ref ref) => EncryptedStorage());

final deviceKeyServiceProvider =
    Provider<DeviceKeyService>((Ref ref) => DeviceKeyService());

final apiClientProvider = Provider<ApiClient>((Ref ref) {
  final String baseUrl = _envApiBase.isNotEmpty
      ? _envApiBase
      : PlatformServices.defaultApiBaseUrl();
  return ApiClient(
    baseUrl: baseUrl,
    tokenProvider: FirebaseConfig.currentIdToken,
    localeProvider: () => ref.read(localeProvider).languageCode,
  );
});

final stepUpServiceProvider = Provider<StepUpService>((Ref ref) {
  return StepUpService(
    api: ref.read(apiClientProvider),
    deviceKey: ref.read(deviceKeyServiceProvider),
  );
});
