import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_exceptions.dart';
import 'dio_client.dart';
import '../update/app_update_info.dart';

class AuthApi {
  final Dio _dio;
  AuthApi(this._dio);

  Future<AuthLoginResult> login({
    required String slug,
    required String login,
    required String password,
    String? deviceName,
    String? deviceId,
    String? userAgent,
    String? apkVersion,
  }) async {
    try {
      final r = await _dio.post('/api/auth/login', data: {
        'slug': slug,
        'login': login,
        'password': password,
        if (deviceName != null && deviceName.isNotEmpty) 'device_name': deviceName,
        if (deviceId != null && deviceId.isNotEmpty) 'device_id': deviceId,
        if (userAgent != null && userAgent.isNotEmpty) 'user_agent': userAgent,
        if (apkVersion != null && apkVersion.isNotEmpty) 'apk_version': apkVersion,
      },);
      return AuthLoginResult.fromJson(r.data);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<AuthUser> me() async {
    try {
      final r = await _dio.get('/api/auth/me');
      return AuthUser.fromJson(r.data['user']);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<AuthRefreshResult> refresh(String refreshToken) async {
    try {
      final r = await _dio.post('/api/auth/refresh', data: {'refreshToken': refreshToken});
      return AuthRefreshResult.fromJson(r.data);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<void> logout(String refreshToken) async {
    try {
      await _dio.post('/api/auth/logout', data: {'refreshToken': refreshToken});
    } catch (_) {}
  }

  ApiException _map(DioException e) {
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return const NetworkException();
    }
    final code = e.response?.statusCode ?? 0;
    final data = e.response?.data;
    final errCode = data is Map ? data['error']?.toString() ?? '' : '';
    final apiMessage = data is Map ? data['message']?.toString() : null;

    if (code == 403 && errCode == 'APP_ACCESS_DENIED') {
      return const AppAccessDeniedException();
    }
    if (code == 403 && errCode == 'USER_NOT_ON_SLOT') {
      return UserNotOnSlotException(
        message: (apiMessage != null && apiMessage.isNotEmpty)
            ? apiMessage
            : 'Не назначен на рабочее место. Обратитесь к администратору.',
      );
    }
    if (code == 401 && errCode == 'SESSION_REVOKED') {
      return SessionRevokedException(
        message: (apiMessage != null && apiMessage.isNotEmpty)
            ? apiMessage
            : 'Сессия завершена. Войдите снова.',
      );
    }
    if (code == 401 && errCode == 'INVALID_CREDENTIALS') {
      return InvalidCredentialsException(
        message: (apiMessage != null && apiMessage.isNotEmpty)
            ? apiMessage
            : 'Неверный логин или пароль',
      );
    }
    if (code == 403 && errCode == 'SESSION_LIMIT') {
      return SessionLimitException(
        message: (apiMessage != null && apiMessage.isNotEmpty)
            ? apiMessage
            : 'Лимит активных сессий исчерпан. Завершите вход на другом устройстве или обратитесь к администратору.',
      );
    }
    return mapDioException(e, extraCodes: const {
      'TENANT_NOT_FOUND': 'Неверный код компании',
      'TenantNotFound': 'Неверный код компании',
      'INVALID_CREDENTIALS': 'Неверный логин или пароль',
      'USER_NOT_ON_SLOT':
          'Не назначен на рабочее место. Обратитесь к администратору.',
      'SESSION_LIMIT':
          'Лимит активных сессий исчерпан. Завершите вход на другом устройстве или обратитесь к администратору.',
      'SESSION_REVOKED': 'Сессия завершена. Войдите снова.',
    },);
  }
}

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.read(dioProvider)));

class AuthRefreshResult {
  final String accessToken;
  final String refreshToken;
  AuthRefreshResult({required this.accessToken, required this.refreshToken});
  factory AuthRefreshResult.fromJson(Map<String, dynamic> j) => AuthRefreshResult(
        accessToken: j['accessToken'] as String,
        refreshToken: j['refreshToken'] as String? ?? '',
      );
}

class AuthLoginResult {
  final String accessToken;
  final String refreshToken;
  final AuthUser user;
  final AppUpdateInfo? appUpdate;
  AuthLoginResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    this.appUpdate,
  });
  factory AuthLoginResult.fromJson(Map<String, dynamic> j) {
    final upd = j['app_update'];
    return AuthLoginResult(
      accessToken: j['accessToken'],
      refreshToken: j['refreshToken'],
      user: AuthUser.fromJson(j['user']),
      appUpdate: upd is Map ? AppUpdateInfo.fromJson(Map<String, dynamic>.from(upd)) : null,
    );
  }
}

class AuthUser {
  final int id;
  final String name, login, role;
  final int tenantId;
  final String? tenantSlug, tenantName, workSlotCode, code;
  final int? workSlotId;
  final bool? appAccess;

  AuthUser({
    required this.id, required this.name, required this.login, required this.role,
    required this.tenantId, this.tenantSlug, this.tenantName, this.workSlotCode, this.workSlotId,
    this.code, this.appAccess,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
    id: j['id'], name: j['name'] ?? '', login: j['login'], role: j['role'],
    tenantId: j['tenantId'], tenantSlug: j['tenantSlug'],
    tenantName: j['tenantName']?.toString(),
    workSlotCode: j['work_slot_code'], workSlotId: j['work_slot_id'],
    code: j['code']?.toString(),
    appAccess: j['app_access'],
  );

  bool get isMobileRole => role == 'agent' || role == 'expeditor' || role == 'supervisor';
}
