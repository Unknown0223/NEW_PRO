import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/mobile_api.dart';
import '../auth/session.dart';
import '../database/app_database.dart';

/// Push notification service
class FcmService {
  final MobileApi _mobileApi;
  final String _slug;

  FcmService({required MobileApi mobileApi, required String slug})
      : _mobileApi = mobileApi,
        _slug = slug;

  Future<void> initialize() async {
    // Firebase hali ulangan emas — dev rejimida placeholder token
    try {
      await registerToken('dev_${DateTime.now().millisecondsSinceEpoch}');
    } catch (_) {}
  }

  Future<void> registerToken(String token) async {
    await _mobileApi.registerFcm(_slug, token);
  }

  void handleForegroundMessage(Map<String, dynamic> message) {
    final type = message['type']?.toString() ?? message['data']?['type']?.toString();
    if (type == 'app_update') {
      // Push orqali yangilash — ilova ochiq bo‘lsa dialog keyingi config refresh da ko‘rinadi.
    }
  }

  static void handleBackgroundMessage(Map<String, dynamic> message) {
    // TODO: Process background message
  }
}

final fcmServiceProvider = Provider<FcmService?>((ref) {
  final session = ref.watch(sessionProvider);
  if (session.tenantSlug == null || session.tenantSlug!.isEmpty) return null;
  return FcmService(
    mobileApi: ref.read(mobileApiProvider),
    slug: session.tenantSlug!,
  );
});

/// Offline flush service — syncs pending orders when online
class OfflineFlushService {
  final MobileApi _mobileApi;
  final AppDatabase _db;
  final String _slug;

  OfflineFlushService({
    required MobileApi mobileApi,
    required AppDatabase db,
    required String slug,
  })  : _mobileApi = mobileApi,
        _db = db,
        _slug = slug;

  /// Flush all pending offline orders — parses items JSON correctly
  Future<FlushResult> flushPendingOrders() async {
    final pending = await _db.getPendingOrders();
    if (pending.isEmpty) return FlushResult(sent: 0, failed: 0);

    int sent = 0;
    int failed = 0;

    for (final item in pending) {
      try {
        // Parse items from JSON string stored in offline_queue
        final itemsStr = item['items'] as String;
        final items = jsonDecode(itemsStr) as List;

        final warehouseId = item['warehouse_id'] as int?;
        if (warehouseId == null || warehouseId < 1) {
          failed++;
          continue;
        }
        await _mobileApi.enqueueOrder(
          _slug,
          clientId: item['client_id'] as int,
          warehouseId: warehouseId,
          items: items,
          priceType: item['price_type']?.toString(),
          comment: item['comment']?.toString(),
        );

        await _db.markQueueItemSent(item['id'] as int);
        sent++;
      } catch (_) {
        failed++;
        break; // Stop on first error
      }
    }

    return FlushResult(sent: sent, failed: failed);
  }

  Future<int> pendingCount() => _db.pendingCount();
}

class FlushResult {
  final int sent;
  final int failed;
  FlushResult({required this.sent, required this.failed});
}

final offlineFlushProvider = Provider<OfflineFlushService?>((ref) {
  final session = ref.watch(sessionProvider);
  if (session.tenantSlug == null) return null;
  return OfflineFlushService(
    mobileApi: ref.read(mobileApiProvider),
    db: AppDatabase(),
    slug: session.tenantSlug!,
  );
});
