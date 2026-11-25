import 'package:local_auth/local_auth.dart';

import '../network/api_client.dart';
import 'device_key_service.dart';

/// Biometric step-up MFA helper using `local_auth` + device P-256 signature.
class StepUpService {
  StepUpService({
    required this._api,
    required this._deviceKey,
    LocalAuthentication? localAuth,
  }) : _localAuth = localAuth ?? LocalAuthentication();

  final ApiClient _api;
  final DeviceKeyService _deviceKey;
  final LocalAuthentication _localAuth;

  Future<String?> runBiometricStepUp({required String reason}) async {
    final bool supported = await _localAuth.isDeviceSupported();
    if (!supported) return null;

    final bool authenticated = await _localAuth.authenticate(
      localizedReason: reason,
      options: const AuthenticationOptions(
        biometricOnly: false,
        stickyAuth: true,
      ),
    );
    if (!authenticated) return null;

    final String deviceId = await _deviceKey.getOrCreateDeviceId();
    final Map<String, Object?> ch = await _api.postJson(
      '/v1/auth/step-up/challenge',
      body: <String, Object?>{'device_id': deviceId},
    );
    final String challengeToken = ch['challenge_token']?.toString() ?? '';
    if (challengeToken.isEmpty) return null;

    final String signatureB64 = await _deviceKey.signChallenge(challengeToken);
    final Map<String, Object?> verified = await _api.postJson(
      '/v1/auth/step-up/verify',
      body: <String, Object?>{
        'device_id': deviceId,
        'challenge_token': challengeToken,
        'signature_b64': signatureB64,
      },
    );
    return verified['step_up_token']?.toString();
  }
}
