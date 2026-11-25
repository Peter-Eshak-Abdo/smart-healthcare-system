import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

/// Cross-platform hardware capability & safe native wrapper layer across
/// Android, iOS, Web, Windows, macOS, and Linux.
class PlatformServices {
  PlatformServices._();

  static bool get supportsCamera =>
      kIsWeb ||
      defaultTargetPlatform == TargetPlatform.android ||
      defaultTargetPlatform == TargetPlatform.iOS;

  static bool get supportsQrScanner =>
      kIsWeb ||
      defaultTargetPlatform == TargetPlatform.android ||
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.macOS;

  static bool get supportsBiometrics =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.macOS);

  static String defaultApiBaseUrl() {
    if (kIsWeb) return 'http://localhost:4000';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000';
    }
    return 'http://localhost:4000';
  }

  static Future<Uint8List> compressJpegSafely(
    Uint8List bytes, {
    int quality = 82,
  }) async {
    if (!supportsCamera && defaultTargetPlatform != TargetPlatform.macOS) {
      return bytes;
    }
    try {
      return await FlutterImageCompress.compressWithList(bytes, quality: quality);
    } catch (_) {
      return bytes;
    }
  }

  static Future<void> enableEmergencyDisplay() async {
    try {
      await WakelockPlus.enable();
      if (!kIsWeb &&
          (defaultTargetPlatform == TargetPlatform.android ||
              defaultTargetPlatform == TargetPlatform.iOS)) {
        await ScreenBrightness().setApplicationScreenBrightness(1.0);
      }
    } catch (_) {}
  }

  static Future<void> disableEmergencyDisplay() async {
    try {
      await WakelockPlus.disable();
      if (!kIsWeb &&
          (defaultTargetPlatform == TargetPlatform.android ||
              defaultTargetPlatform == TargetPlatform.iOS)) {
        await ScreenBrightness().resetApplicationScreenBrightness();
      }
    } catch (_) {}
  }

  static Future<bool> openExternalUri(String rawUri) async {
    try {
      final Uri uri = Uri.parse(rawUri);
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }
}
