import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/security/encrypted_storage.dart';

class PatientRepository {
  PatientRepository({
    required this._api,
    required EncryptedStorage encryptedStorage,
  }) : _storage = encryptedStorage;

  final ApiClient _api;
  final EncryptedStorage _storage;

  Future<Map<String, Object?>> getMe() => _api.getJson('/v1/me');

  Future<Map<String, Object?>> getCriticalInfo() =>
      _api.getJson('/v1/patients/me/critical-info');

  Future<Map<String, Object?>> submitOnboarding({
    required String idDocumentNumber,
    required String dateOfBirthIso,
    required String sex,
    String? bloodType,
  }) {
    return _api.postJson(
      '/v1/patients/me/onboarding',
      body: <String, Object?>{
        'id_document_type': 'national_id',
        'id_document_number': idDocumentNumber,
        'date_of_birth': dateOfBirthIso,
        'sex': sex,
        'blood_type': ?bloodType,
        'consents': const <Map<String, String>>[
          <String, String>{'type': 'clinical_record_storage', 'version': 'v1'},
          <String, String>{'type': 'emergency_profile_break_glass', 'version': 'v1'},
        ],
      },
    );
  }

  Future<Map<String, Object?>> syncEmergencyCard() async {
    final Map<String, Object?> card =
        await _api.getJson('/v1/patients/me/emergency-card');
    final String cardJws = card['card_jws']?.toString() ?? '';
    final String qr = card['qr_payload']?.toString() ?? '';
    final String expiresAt = card['expires_at']?.toString() ?? '';
    if (cardJws.isNotEmpty && qr.isNotEmpty) {
      await _storage.saveEmergencyCard(
        cardJws: cardJws,
        qrPayload: qr,
        expiresAtIso: expiresAt,
      );
    }
    return card;
  }

  Future<Map<String, Object?>> generateShareCode({
    int durationDays = 30,
    String scope = 'read_write',
  }) {
    return _api.postJson(
      '/v1/patients/me/share-codes',
      body: <String, Object?>{
        'grant_duration_days': durationDays,
        'scope': scope,
      },
    );
  }

  Future<Map<String, Object?>> listGrants() =>
      _api.getJson('/v1/patients/me/access-grants');

  Future<void> revokeGrant(String grantId) =>
      _api.delete('/v1/patients/me/access-grants/$grantId');

  Future<Map<String, Object?>> getMedicalHistory({String type = 'all'}) =>
      _api.getJson(
        '/v1/patients/me/medical-history',
        query: <String, Object?>{'type': type},
      );

  Future<void> setEncounterVisibility(String encounterId, String visibility) {
    return _api.patchJson(
      '/v1/patients/me/encounters/$encounterId/visibility',
      body: <String, Object?>{'visibility': visibility},
    );
  }

  Future<Map<String, Object?>> listPrescriptions() =>
      _api.getJson('/v1/patients/me/prescriptions');

  Future<Map<String, Object?>> generatePickupToken(String prescriptionId) {
    return _api.postJson(
      '/v1/patients/me/prescriptions/$prescriptionId/pickup-tokens',
    );
  }

  Future<Map<String, Object?>> listEmergencyContacts() =>
      _api.getJson('/v1/patients/me/emergency-contacts');

  Future<Map<String, Object?>> addEmergencyContact({
    required String fullName,
    required String relationship,
    required String phone,
    required int priority,
    bool shareWithEmergency = true,
  }) {
    return _api.postJson(
      '/v1/patients/me/emergency-contacts',
      body: <String, Object?>{
        'full_name': fullName,
        'relationship': relationship,
        'phone': phone,
        'priority': priority,
        'share_with_emergency': shareWithEmergency,
      },
    );
  }

  Future<void> deleteEmergencyContact(String id) =>
      _api.delete('/v1/patients/me/emergency-contacts/$id');

  Future<Map<String, Object?>> createAssistantSession(String locale) {
    return _api.postJson(
      '/v1/assistant/sessions',
      body: <String, Object?>{'locale': locale},
    );
  }

  Future<Map<String, Object?>> sendAssistantMessage({
    required String sessionId,
    required String text,
    required String clientMessageId,
  }) {
    return _api.postJson(
      '/v1/assistant/sessions/$sessionId/messages',
      body: <String, Object?>{
        'text': text,
        'client_message_id': clientMessageId,
      },
    );
  }

  Future<Map<String, Object?>> enrollFaceFrames({
    required List<List<int>> jpegFrames,
    required String idempotencyKey,
  }) async {
    final Map<String, Object?> challenge = await _api.getJson(
      '/v1/biometric/challenge',
      query: const <String, Object?>{'purpose': 'enroll'},
    );
    final FormData formData = FormData();
    formData.fields.addAll(<MapEntry<String, String>>[
      MapEntry<String, String>(
        'challenge_id',
        challenge['challenge_id']?.toString() ?? '',
      ),
      MapEntry<String, String>(
        'challenge_token',
        challenge['challenge_token']?.toString() ?? '',
      ),
      const MapEntry<String, String>(
        'client_signals',
        '{"frames_count":3,"blink_detected":true,"head_turn_detected":true}',
      ),
    ]);
    for (int i = 0; i < jpegFrames.length; i++) {
      formData.files.add(
        MapEntry<String, MultipartFile>(
          'frames',
          MultipartFile.fromBytes(jpegFrames[i], filename: 'frame_$i.jpg'),
        ),
      );
    }
    return _api.postMultipart(
      '/v1/patients/me/biometrics/face',
      formData: formData,
      idempotencyKey: idempotencyKey,
    );
  }
}
