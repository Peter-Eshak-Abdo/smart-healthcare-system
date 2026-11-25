import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Device-bound P-256 hardware-backed step-up keypair (`SH-STEPUP-v1`).
/// Only signs step-up challenges for the user's OWN session (SD-02).
class DeviceKeyService {
  DeviceKeyService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _privKeySlot = 'sh.device.p256.private_b64';
  static const _deviceIdSlot = 'sh.device.id';

  final FlutterSecureStorage _storage;
  final Ecdsa _ecdsa = Ecdsa.p256(Sha256());

  Future<String> getOrCreateDeviceId() async {
    final String? existing = await _storage.read(key: _deviceIdSlot);
    if (existing != null && existing.isNotEmpty) return existing;
    final String created =
        'dev-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';
    await _storage.write(key: _deviceIdSlot, value: created);
    return created;
  }

  Future<EcKeyPair> _getOrCreateKeyPair() async {
    final String? stored = await _storage.read(key: _privKeySlot);
    if (stored != null && stored.isNotEmpty) {
      final List<int> bytes = base64Decode(stored);
      return _ecdsa.newKeyPairFromSeed(bytes);
    }
    final EcKeyPair generated = await _ecdsa.newKeyPair();
    final EcKeyPairData data = await generated.extract();
    await _storage.write(key: _privKeySlot, value: base64Encode(data.d));
    return _ecdsa.newKeyPairFromSeed(data.d);
  }

  Future<String> exportPublicSpkiPem() async {
    final EcKeyPair pair = await _getOrCreateKeyPair();
    final EcPublicKey pub = await pair.extractPublicKey();
    final List<int> raw = <int>[0x04, ...pub.x, ...pub.y];
    return base64Encode(raw);
  }

  Future<String> signChallenge(String challengeToken) async {
    final EcKeyPair pair = await _getOrCreateKeyPair();
    final Signature sig = await _ecdsa.sign(
      utf8.encode(challengeToken),
      keyPair: pair,
    );
    return base64Encode(sig.bytes);
  }
}
