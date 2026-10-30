import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../auth/session.dart';
import '../device/mobile_device_info.dart';
import '../api/api_base_url.dart';
import '../api/dio_client.dart' show accessTokenProvider;

/// Mobil xatoliklarni serverga yuborish (faqat xato; fire-and-forget + offline navbat).
/// To‘liq kontekst `payload` da — «Журнал ошибок» da ko‘rinadi.
class ErrorReporter {
  ErrorReporter._(this._ref);

  final dynamic _ref;
  static ErrorReporter? _instance;
  bool _flushing = false;
  DateTime? _lastSentAt;
  final Map<String, DateTime> _recentKeys = {};
  static const _minInterval = Duration(milliseconds: 400);
  static const _queueFile = 'error_event_queue.jsonl';
  static const _maxQueueLines = 200;
  static const _maxMessage = 8000;
  static const _maxStackLines = 40;

  static ErrorReporter bind(dynamic ref) {
    _instance = ErrorReporter._(ref);
    return _instance!;
  }

  static ErrorReporter? get instance => _instance;

  static String _clip(String s, int max) {
    final t = s.trim();
    if (t.length <= max) return t;
    return '${t.substring(0, max - 1)}…';
  }

  static String _stackPreview(StackTrace? stack, {int lines = _maxStackLines}) {
    if (stack == null) return '';
    return stack.toString().split('\n').take(lines).join('\n');
  }

  /// Response body — jurnal uchun (token/parol kalitlari qisqartiriladi).
  static Map<String, dynamic>? _safeJsonBody(dynamic data, {int maxChars = 6000}) {
    if (data == null) return null;
    Object? walk(Object? v, int depth) {
      if (v == null || v is num || v is bool) return v;
      if (v is String) {
        return v.length > 2000 ? '${v.substring(0, 1999)}…' : v;
      }
      if (depth > 6) return '[…]';
      if (v is List) {
        return v.take(40).map((e) => walk(e, depth + 1)).toList();
      }
      if (v is Map) {
        final out = <String, dynamic>{};
        for (final e in v.entries) {
          final k = e.key.toString();
          final low = k.toLowerCase();
          if (low.contains('password') || low.contains('token') || low.contains('secret') || low.contains('refresh')) {
            out[k] = '[redacted]';
            continue;
          }
          out[k] = walk(e.value, depth + 1);
        }
        return out;
      }
      return v.toString();
    }

    try {
      final walked = walk(data, 0);
      var encoded = jsonEncode(walked);
      if (encoded.length > maxChars) {
        encoded = '${encoded.substring(0, maxChars - 1)}…';
        return {'_truncated': true, 'preview': encoded};
      }
      if (walked is Map<String, dynamic>) return walked;
      if (walked is Map) return Map<String, dynamic>.from(walked);
      return {'value': walked};
    } catch (_) {
      final s = data.toString();
      return {'raw': _clip(s, maxChars)};
    }
  }

  /// Dio xatosidan yozuv (401 login/refresh o‘tkazib yuboriladi).
  void reportDioError(DioException err) {
    final path = err.requestOptions.path;
    if (path.contains('/error-events') ||
        path.contains('/auth/login') ||
        path.contains('/auth/refresh')) {
      return;
    }

    final status = err.response?.statusCode;
    // Faqat haqiqiy xatolar: tarmoq yoki HTTP ≥400.
    final isNetwork = err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout;
    if (!isNetwork && (status == null || status < 400)) return;
    if (status == 401) return;

    final data = err.response?.data;
    String? code;
    String? requestId;
    String message = err.message ?? 'request_failed';
    if (data is Map) {
      code = data['error']?.toString();
      requestId = data['requestId']?.toString() ?? data['request_id']?.toString();
      final m = data['message']?.toString();
      if (m != null && m.isNotEmpty) {
        message = m;
      } else if (code != null && code.isNotEmpty) {
        message = code;
      }
      // Validatsiya / details — xabar oxiriga
      final details = data['details'] ?? data['issues'] ?? data['errors'];
      if (details != null) {
        final extra = details is String ? details : jsonEncode(details);
        if (extra.isNotEmpty && !message.contains(extra)) {
          message = '$message · $extra';
        }
      }
    }
    requestId ??= err.response?.headers.value('x-request-id');

    // Bir xil request_id qisqa vaqt ichida qayta yozilmasin (dublikat log)
    final dedupeKey = requestId?.trim().isNotEmpty == true
        ? 'rid:$requestId'
        : 'p:$path:${status ?? 0}:$code';
    final now = DateTime.now();
    final prev = _recentKeys[dedupeKey];
    if (prev != null && now.difference(prev) < const Duration(seconds: 8)) {
      return;
    }
    _recentKeys[dedupeKey] = now;
    if (_recentKeys.length > 40) {
      final cutoff = now.subtract(const Duration(seconds: 30));
      _recentKeys.removeWhere((_, t) => t.isBefore(cutoff));
    }

    final uri = err.requestOptions.uri;
    final query = err.requestOptions.queryParameters;
    enqueue({
      'message': _clip(message, _maxMessage),
      'error_code': code ?? err.type.name,
      'request_id': requestId,
      'path': path.length > 255 ? path.substring(0, 255) : path,
      'method': err.requestOptions.method,
      'http_status': status,
      'module': _moduleFromPath(path),
      'severity': (status != null && status >= 500) ? 'fatal' : 'error',
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'payload': {
        'dio_type': err.type.name,
        'uri': uri.toString().length > 500 ? uri.toString().substring(0, 499) : uri.toString(),
        if (query.isNotEmpty) 'query': query.map((k, v) => MapEntry(k, v?.toString())),
        'response': _safeJsonBody(data),
        if (err.error != null) 'underlying': _clip(err.error.toString(), 1000),
        'stack': _stackPreview(err.stackTrace),
        'message_full': _clip(message, _maxMessage),
      },
    });
  }

  void reportSyncIssue({
    required String code,
    required String message,
    Map<String, dynamic>? payload,
    String module = ErrorModules.sync,
    String path = '/mobile/sync',
  }) {
    reportModuleIssue(
      module: module,
      code: code,
      message: message,
      payload: payload,
      path: path,
      method: 'POST',
    );
  }

  /// Har bir bo‘lim uchun tipik xato (foto, GPS, zakaz, vizit, yangilash, …).
  void reportModuleIssue({
    required String module,
    required String code,
    required String message,
    Object? error,
    StackTrace? stack,
    Map<String, dynamic>? payload,
    String? path,
    String? method,
    int? httpStatus,
    String severity = 'error',
  }) {
    final dedupeKey = 'm:$module:$code:${_clip(message, 80)}';
    final now = DateTime.now();
    final prev = _recentKeys[dedupeKey];
    if (prev != null && now.difference(prev) < const Duration(seconds: 12)) {
      return;
    }
    _recentKeys[dedupeKey] = now;

    enqueue({
      'message': _clip(message, _maxMessage),
      'error_code': code,
      'module': module,
      if (path != null) 'path': path.length > 255 ? path.substring(0, 255) : path,
      if (method != null) 'method': method,
      if (httpStatus != null) 'http_status': httpStatus,
      'severity': severity,
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'payload': {
        'message_full': _clip(message, _maxMessage),
        if (error != null) 'error_type': error.runtimeType.toString(),
        if (error != null) 'error': _clip(error.toString(), 2000),
        if (stack != null) 'stack': _stackPreview(stack),
        if (payload != null) ...payload,
      },
    });
  }

  /// catch bloklari uchun qisqa yordamchi.
  void reportCaught(
    Object error, {
    StackTrace? stack,
    required String module,
    required String code,
    String? message,
    Map<String, dynamic>? payload,
    String? path,
    String severity = 'error',
  }) {
    reportModuleIssue(
      module: module,
      code: code,
      message: message ?? error.toString(),
      error: error,
      stack: stack,
      payload: payload,
      path: path,
      severity: severity,
    );
  }

  /// Umumiy (uncaught) xato.
  void reportFatal(Object error, StackTrace? stack, {Map<String, dynamic>? extra}) {
    reportModuleIssue(
      module: ErrorModules.other,
      code: 'UncaughtError',
      message: error.toString(),
      error: error,
      stack: stack,
      payload: {
        if (extra != null) ...extra,
      },
      severity: 'fatal',
    );
  }

  /// Flutter framework xatosi (widget build / layout).
  void reportFlutterError(FlutterErrorDetails details) {
    reportModuleIssue(
      module: ErrorModules.other,
      code: 'FlutterError',
      message: details.exceptionAsString(),
      error: details.exception,
      stack: details.stack,
      payload: {
        'library': details.library,
        if (details.context != null) 'context': details.context.toString(),
        if (details.informationCollector != null)
          'information': details.informationCollector!()
              .map((n) => n.toDescription())
              .take(12)
              .join('\n'),
      },
      severity: 'fatal',
    );
  }

  void enqueue(Map<String, dynamic> body) {
    Future.microtask(() async {
      try {
        await _enqueueAndFlush(body);
      } catch (e) {
        debugPrint('[ErrorReporter] enqueue failed: $e');
      }
    });
  }

  Future<void> flush() async {
    if (_flushing) return;
    _flushing = true;
    try {
      await _flushQueue();
    } finally {
      _flushing = false;
    }
  }

  Future<void> _enqueueAndFlush(Map<String, dynamic> body) async {
    final device = await MobileDeviceInfo.authPayload();
    final platform = Platform.isIOS ? 'ios' : 'android';
    final enriched = {
      ...body,
      'platform': platform,
      'apk_version': device['apk_version'],
      'device_name': device['device_name'],
      'device_id': device['device_id'],
    };
    await _appendQueueLine(jsonEncode(enriched));
    await flush();
  }

  Future<File> _queueFileHandle() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_queueFile');
  }

  Future<void> _appendQueueLine(String line) async {
    final f = await _queueFileHandle();
    final existing = f.existsSync() ? await f.readAsLines() : <String>[];
    final next = [...existing, line];
    while (next.length > _maxQueueLines) {
      next.removeAt(0);
    }
    await f.writeAsString('${next.join('\n')}\n');
  }

  Future<void> _flushQueue() async {
    final session = _ref.read(sessionProvider) as SessionState;
    final slug = session.tenantSlug?.trim() ?? '';
    if (slug.isEmpty || !session.isLoggedIn) return;

    final token = _ref.read(accessTokenProvider) as String?;
    if (token == null || token.isEmpty) return;

    final f = await _queueFileHandle();
    if (!f.existsSync()) return;
    final lines = (await f.readAsLines()).where((l) => l.trim().isNotEmpty).toList();
    if (lines.isEmpty) return;

    final remaining = <String>[];
    final dio = Dio(BaseOptions(
      baseUrl: resolveApiBaseUrl(),
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 12),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ));

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      try {
        final now = DateTime.now();
        if (_lastSentAt != null && now.difference(_lastSentAt!) < _minInterval) {
          await Future<void>.delayed(_minInterval);
        }
        final body = jsonDecode(line) as Map<String, dynamic>;
        await dio.post('/api/$slug/mobile/error-events', data: body);
        _lastSentAt = DateTime.now();
      } catch (_) {
        remaining.addAll(lines.sublist(i));
        break;
      }
    }

    if (remaining.isEmpty) {
      if (f.existsSync()) await f.delete();
    } else {
      await f.writeAsString('${remaining.join('\n')}\n');
    }
  }

  static String _moduleFromPath(String path) {
    final p = path.toLowerCase();
    if (p.contains('/auth')) return ErrorModules.auth;
    if (p.contains('/sync')) return ErrorModules.sync;
    if (p.contains('/visit') || p.contains('/field')) return ErrorModules.visits;
    if (p.contains('/order')) return ErrorModules.orders;
    if (p.contains('/payment') || p.contains('/cash')) return ErrorModules.payments;
    if (p.contains('/client')) return ErrorModules.clients;
    if (p.contains('/photo')) return ErrorModules.photos;
    if (p.contains('/gps') || p.contains('/location')) return ErrorModules.gps;
    if (p.contains('/apk') || p.contains('/update') || p.contains('mobile-app')) {
      return ErrorModules.update;
    }
    if (p.contains('/timesheet') || p.contains('/tabel') || p.contains('tabel')) {
      return ErrorModules.timesheet;
    }
    if (p.contains('held') || p.contains('/queue')) return ErrorModules.heldOrders;
    if (p.contains('/notif')) return ErrorModules.notifications;
    if (p.contains('/sqlite') || p.contains('/database') || p.contains('/db')) {
      return ErrorModules.database;
    }
    return ErrorModules.other;
  }
}

/// Jurnal `module` maydoni — veb filtrda ko‘rinadi.
abstract final class ErrorModules {
  static const auth = 'auth';
  static const sync = 'sync';
  static const visits = 'visits';
  static const orders = 'orders';
  static const payments = 'payments';
  static const clients = 'clients';
  static const photos = 'photos';
  static const gps = 'gps';
  static const update = 'update';
  static const database = 'database';
  static const notifications = 'notifications';
  static const heldOrders = 'held_orders';
  static const timesheet = 'timesheet';
  static const other = 'other';
}

/// Dio interceptor — xatolarni ErrorReporter ga uzatadi.
class ErrorReportInterceptor extends Interceptor {
  ErrorReportInterceptor(this._ref);
  final dynamic _ref;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    try {
      (ErrorReporter.instance ?? ErrorReporter.bind(_ref)).reportDioError(err);
    } catch (_) {
      /* ignore */
    }
    handler.next(err);
  }
}
