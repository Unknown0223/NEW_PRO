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
class ErrorReporter {
  ErrorReporter._(this._ref);

  final dynamic _ref;
  static ErrorReporter? _instance;
  bool _flushing = false;
  DateTime? _lastSentAt;
  static const _minInterval = Duration(milliseconds: 400);
  static const _queueFile = 'error_event_queue.jsonl';
  static const _maxQueueLines = 80;

  static ErrorReporter bind(dynamic ref) {
    _instance = ErrorReporter._(ref);
    return _instance!;
  }

  static ErrorReporter? get instance => _instance;

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
      if (m != null && m.isNotEmpty) message = m;
      else if (code != null && code.isNotEmpty) message = code;
    }
    requestId ??= err.response?.headers.value('x-request-id');

    enqueue({
      'message': message.length > 500 ? '${message.substring(0, 499)}…' : message,
      'error_code': code,
      'request_id': requestId,
      'path': path.length > 255 ? path.substring(0, 255) : path,
      'method': err.requestOptions.method,
      'http_status': status,
      'module': _moduleFromPath(path),
      'severity': (status != null && status >= 500) ? 'fatal' : 'error',
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Umumiy (uncaught) xato.
  void reportFatal(Object error, StackTrace? stack) {
    enqueue({
      'message': error.toString().length > 500
          ? '${error.toString().substring(0, 499)}…'
          : error.toString(),
      'error_code': 'UncaughtError',
      'severity': 'fatal',
      'module': 'other',
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'payload': {
        if (stack != null) 'stack': stack.toString().split('\n').take(12).join('\n'),
      },
    });
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
    await _flushQueue();
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
    if (p.contains('/auth')) return 'auth';
    if (p.contains('/sync')) return 'sync';
    if (p.contains('/visit') || p.contains('/field')) return 'visits';
    if (p.contains('/order')) return 'orders';
    if (p.contains('/payment')) return 'payments';
    if (p.contains('/client')) return 'clients';
    if (p.contains('/timesheet') || p.contains('/tabel') || p.contains('tabel')) {
      return 'timesheet';
    }
    return 'other';
  }
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
