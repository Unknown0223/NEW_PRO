import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Dio 401 → auth: aylana import va provider tsikli yo'q.
class SessionExpiredBridge {
  Future<void> Function({bool forceLogout})? _handler;

  void register(Future<void> Function({bool forceLogout}) handler) {
    _handler = handler;
  }

  void clear() {
    _handler = null;
  }

  Future<void> notify({bool forceLogout = false}) async {
    final fn = _handler;
    if (fn != null) await fn(forceLogout: forceLogout);
  }
}

final sessionExpiredBridgeProvider = Provider<SessionExpiredBridge>((ref) {
  final bridge = SessionExpiredBridge();
  ref.onDispose(bridge.clear);
  return bridge;
});

final appAccessDeniedBridgeProvider = Provider<SessionExpiredBridge>((ref) {
  final bridge = SessionExpiredBridge();
  ref.onDispose(bridge.clear);
  return bridge;
});

Future<void> notifySessionExpired(Ref ref, {bool forceLogout = false}) async {
  await ref.read(sessionExpiredBridgeProvider).notify(forceLogout: forceLogout);
}

Future<void> notifyAppAccessDenied(Ref ref) async {
  await ref.read(appAccessDeniedBridgeProvider).notify(forceLogout: true);
}

bool isSessionRevokedResponse(int? statusCode, dynamic data) {
  if (statusCode != 401) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'SESSION_REVOKED';
}

/// Refresh token haqiqatan yaroqsiz (muddati tugagan / bekor qilingan).
bool isInvalidRefreshResponse(int? statusCode, dynamic data) {
  if (statusCode != 401) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'INVALID_REFRESH';
}

/// Login 401: noto‘g‘ri login/parol — sessiya tugash sifatida ko‘rsatilmasin.
bool isInvalidCredentialsResponse(int? statusCode, dynamic data) {
  if (statusCode != 401) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'INVALID_CREDENTIALS';
}

bool isAppAccessDeniedResponse(int? statusCode, dynamic data) {
  if (statusCode != 403) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'APP_ACCESS_DENIED';
}
