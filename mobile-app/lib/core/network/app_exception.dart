import 'package:dio/dio.dart';

/// Unified application exception for network, API, and unexpected errors.
class AppException implements Exception {
  const AppException({
    required this.code,
    required this.message,
    this.statusCode,
  });

  final String code;
  final String message;
  final int? statusCode;

  @override
  String toString() => 'AppException(code: $code, statusCode: $statusCode)';
}

/// Maps low-level exceptions (Dio, format, unknown) to [AppException].
class ErrorMapper {
  const ErrorMapper._();

  static AppException fromObject(Object error, {bool isArabic = true}) {
    if (error is AppException) return error;
    if (error is DioException) return fromDioException(error, isArabic: isArabic);
    return AppException(
      code: 'INTERNAL_ERROR',
      message: isArabic
          ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
          : 'An unexpected error occurred. Please try again.',
    );
  }

  static AppException fromDioException(
    DioException error, {
    bool isArabic = true,
  }) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return AppException(
          code: 'TIMEOUT',
          message: isArabic
              ? 'انتهت مهلة الاتصال بالخادم.'
              : 'Connection timed out.',
        );
      case DioExceptionType.connectionError:
        return AppException(
          code: 'NETWORK_ERROR',
          message: isArabic
              ? 'تعذر الاتصال بالشبكة. تحقق من اتصال الإنترنت.'
              : 'Network connection failed. Please check your internet.',
        );
      case DioExceptionType.badResponse:
        final status = error.response?.statusCode;
        final data = error.response?.data;
        String code = 'HTTP_${status ?? 500}';
        String? serverDetail;
        if (data is Map<String, dynamic>) {
          final rawCode = data['code'];
          if (rawCode is String && rawCode.isNotEmpty) {
            code = rawCode;
          }
          final rawDetail = data['detail'] ?? data['message'];
          if (rawDetail is String && rawDetail.isNotEmpty) {
            serverDetail = rawDetail;
          }
        }
        return AppException(
          code: code,
          statusCode: status,
          message: serverDetail ??
              (isArabic
                  ? 'تعذر إتمام الطلب. يرجى المحاولة مرة أخرى.'
                  : 'Request failed. Please try again.'),
        );
      case DioExceptionType.cancel:
        return AppException(
          code: 'CANCELLED',
          message: isArabic ? 'تم إلغاء الطلب.' : 'Request was cancelled.',
        );
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return AppException(
          code: 'UNKNOWN_ERROR',
          message: isArabic
              ? 'حدث خطأ غير متوقع.'
              : 'An unexpected error occurred.',
        );
    }
  }
}
