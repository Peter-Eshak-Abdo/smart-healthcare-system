import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../network/api_client.dart';
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

const String _defaultApiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000',
);

final encryptedStorageProvider =
    Provider<EncryptedStorage>((Ref ref) => EncryptedStorage());

final deviceKeyServiceProvider =
    Provider<DeviceKeyService>((Ref ref) => DeviceKeyService());

final apiClientProvider = Provider<ApiClient>((Ref ref) {
  return ApiClient(
    baseUrl: _defaultApiBase,
    tokenProvider: () async {
      try {
        return Supabase.instance.client.auth.currentSession?.accessToken;
      } catch (_) {
        return null;
      }
    },
    localeProvider: () => ref.read(localeProvider).languageCode,
  );
});

final stepUpServiceProvider = Provider<StepUpService>((Ref ref) {
  return StepUpService(
    api: ref.read(apiClientProvider),
    deviceKey: ref.read(deviceKeyServiceProvider),
  );
});
