import 'dart:io' show HttpDate;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../auth/session_expired.dart';
import '../time/server_clock.dart';
import '../config/app_env.dart';
import 'api_base_url.dart';

export 'api_base_url.dart' show configureApiHostForAndroidEmulator, resolveApiBaseUrl;

Dio _plainDio() => Dio(BaseOptions(
      baseUrl: resolveApiBaseUrl(),
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 120),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    ),);

final dioProvider = Provider<Dio>((ref) {
  final dio = _plainDio();
  dio.interceptors.add(ServerTimeInterceptor());
  dio.interceptors.add(AuthInterceptor(ref));
  return dio;
});

/// Har bir server javobidagi HTTP `Date` sarlavhasidan ishonchli vaqtni
/// [ServerClock] ga langarlaydi. Shu tariqa sinxron oynasi hisobi qurilma
/// soatiga emas, serverga tayanadi.
class ServerTimeInterceptor extends Interceptor {
  void _anchor(Headers? headers) {
    final raw = headers?.value('date');
    if (raw == null || raw.isEmpty) return;
    try {
      ServerClock.instance.anchorFromServerUtc(HttpDate.parse(raw).toUtc());
    } catch (_) {
      // Noto‘g‘ri formatdagi Date sarlavhasi — e'tiborsiz qoldiramiz.
    }
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    _anchor(response.headers);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _anchor(err.response?.headers);
    handler.next(err);
  }
}

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
});

final accessTokenProvider = StateProvider<String?>((ref) => null);
final refreshTokenProvider = StateProvider<String?>((ref) => null);

class AuthInterceptor extends Interceptor {
  final Ref _ref;
  AuthInterceptor(this._ref);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.path.contains('/auth/login') || options.path.contains('/auth/refresh')) {
      handler.next(options);
      return;
    }
    await ensureAuthTokens(_ref);
    final token = _ref.read(accessTokenProvider);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final path = err.requestOptions.path;
    // Login / refresh 401 — sessiya emas (noto‘g‘ri parol yoki refresh token).
    // Aks holda notifySessionExpired «Sessiya tugadi» bilan to‘g‘ri xatoni yopib qo‘yadi.
    if (path.contains('/auth/login') || path.contains('/auth/refresh')) {
      handler.next(err);
      return;
    }
    if (isInvalidCredentialsResponse(err.response?.statusCode, err.response?.data)) {
      handler.next(err);
      return;
    }
    if (isSessionRevokedResponse(err.response?.statusCode, err.response?.data)) {
      await clearAuthTokens(_ref);
      Future.microtask(() => notifySessionExpired(_ref));
      handler.next(err);
      return;
    }
    if (isAppAccessDeniedResponse(err.response?.statusCode, err.response?.data)) {
      await clearAuthTokens(_ref);
      Future.microtask(() => notifyAppAccessDenied(_ref));
      handler.next(err);
      return;
    }
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }
    if (err.requestOptions.extra['_authRetried'] == true) {
      handler.next(err);
      return;
    }

    final refreshed = await _tryRefresh(_ref);
    if (!refreshed) {
      await clearAccessTokenOnly(_ref);
      Future.microtask(() => notifySessionExpired(_ref));
      handler.next(err);
      return;
    }

    final newToken = _ref.read(accessTokenProvider);
    if (newToken == null) {
      handler.next(err);
      return;
    }

    try {
      final retry = err.requestOptions.copyWith(
        extra: Map<String, dynamic>.from(err.requestOptions.extra)..['_authRetried'] = true,
        headers: Map<String, dynamic>.from(err.requestOptions.headers)
          ..['Authorization'] = 'Bearer $newToken',
      );
      final response = await _plainDio().fetch(retry);
      handler.resolve(response);
    } catch (e) {
      handler.next(e is DioException ? e : err);
    }
  }
}

/// Har API dan oldin: secure storage → memory
/// WidgetRef (ConsumerState.ref) va Provider Ref ikkalasi ham `.read` qo‘llab-quvvatlanadi.
Future<bool> ensureAuthTokens(dynamic ref) async {
  if (ref.read(accessTokenProvider) != null) {
    return true;
  }
  final storage = ref.read(secureStorageProvider);
  final a = await storage.read(key: 'access_token');
  final r = await storage.read(key: 'refresh_token');
  if (a != null && a.isNotEmpty && r != null && r.isNotEmpty) {
    ref.read(accessTokenProvider.notifier).state = a;
    ref.read(refreshTokenProvider.notifier).state = r;
    return true;
  }
  return false;
}

Future<bool> _tryRefresh(Ref ref) async {
  try {
    final storage = ref.read(secureStorageProvider);
    var refresh = ref.read(refreshTokenProvider);
    refresh ??= await storage.read(key: 'refresh_token');
    if (refresh == null || refresh.isEmpty) return false;

    final res = await _plainDio().post('/api/auth/refresh', data: {'refreshToken': refresh});
    if (isAppAccessDeniedResponse(res.statusCode, res.data)) {
      await clearAuthTokens(ref);
      Future.microtask(() => notifyAppAccessDenied(ref));
      return false;
    }
    if (res.statusCode != 200) return false;

    final a = res.data['accessToken'] as String?;
    final r = res.data['refreshToken'] as String?;
    if (a == null || a.isEmpty) return false;

    await saveTokens(ref, a, r ?? refresh);
    return true;
  } catch (_) {
    return false;
  }
}

const _apiEnvKey = 'api_env_key';

/// Save tokens — works with Ref (from StateNotifier)
Future<void> saveTokens(Ref ref, String access, String refresh) async {
  final storage = ref.read(secureStorageProvider);
  await storage.write(key: 'access_token', value: access);
  await storage.write(key: 'refresh_token', value: refresh);
  await storage.write(key: _apiEnvKey, value: resolveApiEnvKey());
  ref.read(accessTokenProvider.notifier).state = access;
  ref.read(refreshTokenProvider.notifier).state = refresh;
}

/// Restore tokens from secure storage
Future<bool> restoreTokens(Ref ref) async {
  final storage = ref.read(secureStorageProvider);
  final storedEnv = await storage.read(key: _apiEnvKey);
  final currentEnv = resolveApiEnvKey();
  if (storedEnv != null &&
      storedEnv.isNotEmpty &&
      storedEnv != currentEnv) {
    await clearAuthTokens(ref);
    return false;
  }
  final a = await storage.read(key: 'access_token');
  final r = await storage.read(key: 'refresh_token');
  final hasTokens = a != null && a.isNotEmpty && r != null && r.isNotEmpty;
  if (hasTokens && (storedEnv == null || storedEnv.isEmpty)) {
    await storage.write(key: _apiEnvKey, value: currentEnv);
  }
  if (hasTokens) {
    ref.read(accessTokenProvider.notifier).state = a;
    ref.read(refreshTokenProvider.notifier).state = r;
    return true;
  }
  return false;
}

Future<void> clearAccessTokenOnly(Ref ref) async {
  final storage = ref.read(secureStorageProvider);
  await storage.delete(key: 'access_token');
  ref.read(accessTokenProvider.notifier).state = null;
}

Future<void> clearAuthTokens(Ref ref) async {
  final storage = ref.read(secureStorageProvider);
  await storage.delete(key: 'access_token');
  await storage.delete(key: 'refresh_token');
  await storage.delete(key: _apiEnvKey);
  ref.read(accessTokenProvider.notifier).state = null;
  ref.read(refreshTokenProvider.notifier).state = null;
}
