import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../api/mobile_api.dart';
import '../camera/photo_service.dart';
import '../config/mobile_config.dart';
import '../database/app_database.dart';

/// Foto hisobotlar oflayn navbat — yangilashdan oldin serverga yuboriladi.
class PhotoReportQueue {
  PhotoReportQueue._();

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

  static Future<bool> enqueue({
    required int clientId,
    required String imagePath,
    required String caption,
    int? orderId,
  }) async {
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
  }) async {
    final db = AppDatabase();
    final pending = await db.getPendingPhotoReports();
    if (pending.isEmpty) return const PhotoFlushResult(sent: 0, failed: 0);

    var sent = 0;
    var failed = 0;
    for (final item in pending) {
      final id = item['id'] as int;
      final clientId = item['client_id'] as int;
      final imagePath = item['image_path'] as String;
      final caption = item['caption'] as String? ?? '';
      final orderId = item['order_id'] as int?;

      final file = File(imagePath);
      if (!await file.exists()) {
        await db.deletePendingPhotoReport(id);
        failed++;
        continue;
      }

      try {
        final b64 = await encodeClientPhotoBase64(imagePath, config: photoConfig);
        if (b64 == null) {
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
      } catch (_) {
        failed++;
        break;
      }
    }
    return PhotoFlushResult(sent: sent, failed: failed);
  }
}

class PhotoFlushResult {
  final int sent;
  final int failed;
  const PhotoFlushResult({required this.sent, required this.failed});
}
