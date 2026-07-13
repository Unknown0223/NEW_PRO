import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Dio 401 → auth: aylana import va provider tsikli yo'q.
class SessionExpiredBridge {
  Future<void> Function()? _handler;

  void register(Future<void> Function() handler) {
    _handler = handler;
  }

  void clear() {
    _handler = null;
  }

  Future<void> notify() async {
    final fn = _handler;
    if (fn != null) await fn();
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

Future<void> notifySessionExpired(Ref ref) async {
  await ref.read(sessionExpiredBridgeProvider).notify();
}

Future<void> notifyAppAccessDenied(Ref ref) async {
  await ref.read(appAccessDeniedBridgeProvider).notify();
}

bool isSessionRevokedResponse(int? statusCode, dynamic data) {
  if (statusCode != 401) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'SESSION_REVOKED';
}

bool isAppAccessDeniedResponse(int? statusCode, dynamic data) {
  if (statusCode != 403) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'APP_ACCESS_DENIED';
}
