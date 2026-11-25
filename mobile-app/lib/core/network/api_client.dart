import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

import 'api_exception.dart';

class ApiClient {
  ApiClient({
    required String baseUrl,
    required this._tokenProvider,
    required this._localeProvider,
    this.appVersion = '1.0.0',
    Dio? dio,
  }) : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 15),
                headers: <String, Object>{
                  'Accept': 'application/json',
                },
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) async {
          final String? token = await _tokenProvider();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.headers['X-Client'] = 'mobile/$appVersion';
          options.headers['Accept-Language'] = _localeProvider();
          options.headers['X-Request-Id'] ??=
              '${DateTime.now().microsecondsSinceEpoch}-${options.path.hashCode.abs()}';
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final Future<String?> Function() _tokenProvider;
  final String Function() _localeProvider;
  final String appVersion;

  Future<Map<String, Object?>> getJson(
    String path, {
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) async {
    return _request('GET', path, query: query, headers: headers);
  }

  Future<Map<String, Object?>> postJson(
    String path, {
    Map<String, Object?>? body,
    String? idempotencyKey,
    Map<String, String>? headers,
  }) async {
    return _request(
      'POST',
      path,
      data: body ?? const <String, Object?>{},
      headers: <String, String>{
        'Idempotency-Key': ?idempotencyKey,
        ...?headers,
      },
    );
  }

  Future<Map<String, Object?>> patchJson(
    String path, {
    required Map<String, Object?> body,
    Map<String, String>? headers,
  }) async {
    return _request('PATCH', path, data: body, headers: headers);
  }

  Future<Map<String, Object?>> putJson(
    String path, {
    required Map<String, Object?> body,
    Map<String, String>? headers,
  }) async {
    return _request('PUT', path, data: body, headers: headers);
  }

  Future<void> delete(String path, {Map<String, String>? headers}) async {
    await _request('DELETE', path, headers: headers);
  }

  Future<Map<String, Object?>> postMultipart(
    String path, {
    required FormData formData,
    required String idempotencyKey,
  }) async {
    return _request(
      'POST',
      path,
      data: formData,
      headers: <String, String>{'Idempotency-Key': idempotencyKey},
    );
  }

  Future<Map<String, Object?>> _request(
    String method,
    String path, {
    Object? data,
    Map<String, Object?>? query,
    Map<String, String>? headers,
  }) async {
    try {
      final Response<Object?> response = await _dio.request<Object?>(
        path,
        data: data,
        queryParameters: query,
        options: Options(method: method, headers: headers),
      );
      final Object? raw = response.data;
      if (raw is Map<String, Object?>) {
        return raw;
      }
      if (raw is Map<Object?, Object?>) {
        return raw.map(
          (Object? k, Object? v) => MapEntry<String, Object?>(k.toString(), v),
        );
      }
      if (raw is String && raw.isNotEmpty) {
        final Object? decoded = jsonDecode(raw);
        if (decoded is Map<String, Object?>) {
          return decoded;
        }
      }
      return const <String, Object?>{};
    } on DioException catch (err) {
      if (err.error is SocketException ||
          err.type == DioExceptionType.connectionError ||
          err.type == DioExceptionType.connectionTimeout) {
        throw const ApiException(
          statusCode: 0,
          code: 'NETWORK_OFFLINE',
          message: 'No internet connection.',
        );
      }
      final int status = err.response?.statusCode ?? 500;
      final Object? body = err.response?.data;
      String code = 'INTERNAL_ERROR';
      String detail = 'Unexpected error.';
      String? requestId;
      if (body is Map<Object?, Object?>) {
        code = body['code']?.toString() ?? code;
        detail = body['detail']?.toString() ??
            body['title']?.toString() ??
            detail;
        requestId = body['request_id']?.toString();
      }
      throw ApiException(
        statusCode: status,
        code: code,
        message: detail,
        requestId: requestId,
      );
    }
  }
}
