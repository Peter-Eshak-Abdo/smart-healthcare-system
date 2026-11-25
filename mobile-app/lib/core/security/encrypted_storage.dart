import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_ce/hive.dart';

/// Encrypted Hive storage for offline Emergency Card JWS + profile cache (never plaintext).
/// Encryption key lives strictly inside Keychain / Android Keystore via FlutterSecureStorage.
class EncryptedStorage {
  EncryptedStorage({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _hiveKeySlot = 'sh.hive.aes256.key_b64';
  static const _emergencyBoxName = 'sh_emergency_cache_enc';

  final FlutterSecureStorage _secureStorage;
  Box<String>? _box;

  Future<Uint8List> _loadOrCreateKey() async {
    final String? existing = await _secureStorage.read(key: _hiveKeySlot);
    if (existing != null && existing.isNotEmpty) {
      return Uint8List.fromList(base64Decode(existing));
    }
    final List<int> fresh = Hive.generateSecureKey();
    await _secureStorage.write(key: _hiveKeySlot, value: base64Encode(fresh));
    return Uint8List.fromList(fresh);
  }

  Future<Box<String>> openEncryptedEmergencyBox() async {
    if (_box != null && _box!.isOpen) return _box!;
    final Uint8List key = await _loadOrCreateKey();
    _box = await Hive.openBox<String>(
      _emergencyBoxName,
      encryptionCipher: HiveAesCipher(key),
    );
    return _box!;
  }

  Future<void> saveEmergencyCard({
    required String cardJws,
    required String qrPayload,
    required String expiresAtIso,
  }) async {
    final Box<String> box = await openEncryptedEmergencyBox();
    await box.put(
      'card_payload',
      jsonEncode(<String, String>{
        'card_jws': cardJws,
        'qr_payload': qrPayload,
        'expires_at': expiresAtIso,
      }),
    );
  }

  Future<Map<String, String>?> readEmergencyCard() async {
    final Box<String> box = await openEncryptedEmergencyBox();
    final String? raw = box.get('card_payload');
    if (raw == null || raw.isEmpty) return null;
    final Object? decoded = jsonDecode(raw);
    if (decoded is! Map<Object?, Object?>) return null;
    return decoded.map(
      (Object? k, Object? v) => MapEntry<String, String>(k.toString(), v?.toString() ?? ''),
    );
  }

  Future<void> wipeAllOnSignOut() async {
    if (_box != null && _box!.isOpen) {
      await _box!.clear();
      await _box!.close();
      _box = null;
    }
    await Hive.deleteBoxFromDisk(_emergencyBoxName).catchError((_) {});
  }
}
