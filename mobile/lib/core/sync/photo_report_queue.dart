import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../api/mobile_api.dart';
import '../camera/photo_service.dart';
import '../config/mobile_config.dart';
import '../config/mobile_config_policy.dart';
import '../database/app_database.dart';
import '../errors/error_reporter.dart';

/// Foto hisobotlar oflayn navbat — online bo‘lganda 5 martagacha qayta urinadi.
class PhotoReportQueue {
  PhotoReportQueue._();

  static const maxRetries = 5;

  static Future<String?> persistImage(String tempPath) async {
    final src = File(tempPath);
    if (!await src.exists()) return null;
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_photos'));
    if (!await pendingDir.exists()) {
      await pendingDir.create(recursive: true);
    }
    final dest = File(p.join(pendingDir.path, '${DateTime.now().millisecondsSinceEpoch}.jpg'));
    await src.copy(dest.path);
    return dest.path;
  }

  /// Yangi rasm olish: sinxron oynasi yoki hold captureDeadline tugagach bloklanadi.
  /// Allaqachon olingan fotolarni yuborish ([flush]) vaqt oynasiga bog‘liq emas.
  static Future<bool> isCaptureBlockedForClient(int clientId, {SyncConfig? sync}) async {
    if (sync != null && !evaluateSyncPolicy(sync).allowed) return true;
    final rows = await AppDatabase().getPendingHeldOrdersForClient(clientId);
    if (rows.isEmpty) return false;
    final now = DateTime.now();
    for (final row in rows) {
      final raw = row['capture_deadline']?.toString().isNotEmpty == true
          ? row['capture_deadline']?.toString()
          : row['submit_at']?.toString();
      if (raw == null || raw.isEmpty) continue;
      final deadline = DateTime.tryParse(raw);
      if (deadline != null && !now.isBefore(deadline)) {
        return true;
      }
    }
    return false;
  }

  static Future<bool> enqueue({
    required int clientId,
    required String imagePath,
    required String caption,
    int? orderId,
    SyncConfig? sync,
  }) async {
    if (await isCaptureBlockedForClient(clientId, sync: sync)) {
      return false;
    }
    final persisted = await persistImage(imagePath);
    if (persisted == null) return false;
    await AppDatabase().enqueuePendingPhotoReport(
      clientId: clientId,
      imagePath: persisted,
      caption: caption,
      orderId: orderId,
    );
    return true;
  }

  static Future<PhotoFlushResult> flush({
    required MobileApi api,
    required String slug,
    PhotoConfig? photoConfig,
    int? clientId,
  }) async {
    final db = AppDatabase();
    var pending = await db.getPendingPhotoReports();
    if (clientId != null) {
      pending = pending.where((item) => item['client_id'] == clientId).toList();
    }
    if (pending.isEmpty) return const PhotoFlushResult(sent: 0, failed: 0);

    var sent = 0;
    var failed = 0;
    for (final item in pending) {
      final id = item['id'] as int;
      final clientId = item['client_id'] as int;
      final imagePath = item['image_path'] as String;
      final caption = item['caption'] as String? ?? '';
      final orderId = item['order_id'] as int?;
      final retryCount = (item['retry_count'] as int?) ?? 0;

      final file = File(imagePath);
      if (!await file.exists()) {
        await db.deletePendingPhotoReport(id);
        failed++;
        continue;
      }

      try {
        final b64 = await encodeClientPhotoBase64(imagePath, config: photoConfig);
        if (b64 == null) {
          ErrorReporter.instance?.reportModuleIssue(
            module: ErrorModules.photos,
            code: 'PhotoEncodeFailed',
            message: 'Фотоотчёт: не удалось закодировать файл из очереди',
            path: '/mobile/clients/photo-reports',
            payload: {'client_id': clientId, 'queue_id': id, 'retry': retryCount},
          );
          await _registerFailure(db, id, retryCount);
          failed++;
          continue;
        }
        await api.postClientPhotoReport(
          slug,
          clientId,
          imageBase64: b64,
          caption: caption,
          orderId: orderId,
        );
        await db.deletePendingPhotoReport(id);
        try {
          await file.delete();
        } catch (_) {}
        sent++;
      } catch (e, st) {
        ErrorReporter.instance?.reportCaught(
          e,
          stack: st,
          module: ErrorModules.photos,
          code: 'PhotoQueueFlushFailed',
          message: 'Фотоотчёт: flush очереди не удался',
          path: '/mobile/clients/photo-reports',
          payload: {'client_id': clientId, 'queue_id': id, 'retry': retryCount},
        );
        await _registerFailure(db, id, retryCount);
        failed++;
        // Keyingi fotolarni ham urinish — bitta xato hammasi to‘xtatmasin.
      }
    }
    return PhotoFlushResult(sent: sent, failed: failed);
  }

  static Future<void> _registerFailure(AppDatabase db, int id, int retryCount) async {
    final next = retryCount + 1;
    if (next >= maxRetries) {
      await db.markPendingPhotoFailed(id);
    } else {
      await db.bumpPendingPhotoRetry(id);
    }
  }
}

class PhotoFlushResult {
  final int sent;
  final int failed;
  const PhotoFlushResult({required this.sent, required this.failed});
}
