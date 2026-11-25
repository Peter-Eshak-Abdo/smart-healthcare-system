import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

/// Multi-platform Firebase bootstrap & authentication helper.
/// Reads compile-time `--dart-define` keys when provided so Android, iOS,
/// Web, Windows, macOS, and Linux all initialize cleanly without secrets in VCS.
class FirebaseConfig {
  FirebaseConfig._();

  static const String apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const String appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const String messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const String projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const String authDomain =
      String.fromEnvironment('FIREBASE_AUTH_DOMAIN');
  static const String storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
  static const String androidApkDownloadUrl = String.fromEnvironment(
    'ANDROID_APK_DOWNLOAD_URL',
    defaultValue: '/downloads/smarthealth.apk',
  );

  static bool _initialized = false;

  static bool get isInitialized => _initialized;

  static FirebaseOptions? get _explicitOptions {
    if (apiKey.isEmpty ||
        appId.isEmpty ||
        messagingSenderId.isEmpty ||
        projectId.isEmpty) {
      return null;
    }
    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: messagingSenderId,
      projectId: projectId,
      authDomain: authDomain.isEmpty ? '$projectId.firebaseapp.com' : authDomain,
      storageBucket:
          storageBucket.isEmpty ? '$projectId.firebasestorage.app' : storageBucket,
    );
  }

  static Future<void> initializeSafely() async {
    if (_initialized || Firebase.apps.isNotEmpty) {
      _initialized = true;
      return;
    }
    try {
      final FirebaseOptions? opts = _explicitOptions;
      if (opts != null) {
        await Firebase.initializeApp(options: opts);
      } else {
        await Firebase.initializeApp();
      }
      _initialized = true;
    } catch (_) {
      // Allows widget tests and offline emergency card access without native Firebase config.
      _initialized = false;
    }
  }

  static Future<String?> currentIdToken() async {
    if (!_initialized && Firebase.apps.isEmpty) return null;
    try {
      return await FirebaseAuth.instance.currentUser?.getIdToken();
    } catch (_) {
      return null;
    }
  }

  static Future<UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    await initializeSafely();
    return FirebaseAuth.instance.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  static Future<void> signOut() async {
    if (!_initialized && Firebase.apps.isEmpty) return;
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}
  }
}
