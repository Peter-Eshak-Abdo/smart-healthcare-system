class ApiException implements Exception {
  const ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.requestId,
  });

  final int statusCode;
  final String code;
  final String message;
  final String? requestId;

  bool get isOffline => code == 'NETWORK_OFFLINE';
  bool get requiresStepUp => code == 'AUTH_STEP_UP_REQUIRED';
  bool get isGrantRevoked => code == 'ACCESS_GRANT_REVOKED';
  bool get isSignatureInvalid => code == 'RX_SIGNATURE_INVALID';

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
