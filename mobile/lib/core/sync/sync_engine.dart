import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../device/mobile_device_info.dart';
import '../api/mobile_api.dart';
import '../auth/session.dart';
import '../config/mobile_config.dart';
import '../config/mobile_config_policy.dart';
import '../config/sync_policy_provider.dart';
import '../connectivity/connectivity_service.dart';
import '../database/app_database.dart';
import 'photo_report_queue.dart';
import 'sync_payload_parser.dart';
import '../../features/shared/services/sync_service.dart';

/// Sync engine — full/delta sync + offline queue flush
class SyncEngine {
  final MobileApi _mobileApi;
  final AppDatabase _db;
  final String _slug;
  final String? _userRole;
  final SyncConfig _syncConfig;
  final SyncConflictResolver _conflictResolver;

  SyncEngine({
    required MobileApi mobileApi,
    required AppDatabase db,
    required String slug,
    String? userRole,
    SyncConfig syncConfig = const SyncConfig(),
    SyncConflictResolver conflictResolver = syncConflictResolver,
  })  : _mobileApi = mobileApi,
        _db = db,
        _slug = slug,
        _userRole = userRole,
        _syncConfig = syncConfig,
        _conflictResolver = conflictResolver;

  Future<void> _applySyncClients(SyncFullResult result) async {
    if (result.clientsReplaceAll) {
      await _db.clearClients();
    }
    if (result.clients.isNotEmpty) {
      final rows = result.clients.map((c) {
        final serverMap = c.toMap();
        return _conflictResolver.resolve(
          entityType: 'clients',
          localRow: serverMap,
          serverRow: serverMap,
        );
      }).toList();
      await _db.upsertClients(rows);
    }
    if (_userRole == 'agent' && result.clientsReplaceAll) {
      await _db.markAgentClientsSynced();
    }
  }

  static bool isFullCatalogSync(String? lastSyncAt) =>
      lastSyncAt == null || lastSyncAt.isEmpty;

  Future<void> _applySyncProducts(SyncFullResult result, {bool replaceCatalog = false}) async {
    if (_userRole == 'agent' && replaceCatalog) {
      await _db.clearProducts();
    }
    if (result.products.isNotEmpty) {
      await _db.upsertProducts(result.products.map((p) => p.toMap()).toList());
    }
    if (result.prices.isNotEmpty) {
      await _db.upsertPrices(result.prices.map((p) => {
            'product_id': p.productId,
            'price_type': p.priceType ?? 'default',
            'price': p.price,
          },).toList(),);
    }
  }

  /// Delta sync — single entity bucket since last sync.
  Future<SyncFullResult> syncDelta({String? lastSyncAt, required String entityType}) async {
    final last = lastSyncAt ?? await _db.getLastSyncAt();
    final device = await MobileDeviceInfo.syncPayload();
    final result = await _mobileApi.syncDelta(_slug, lastSyncAt: last, entityType: entityType, device: device);
    if (entityType == 'clients') {
      await _applySyncClients(result);
    } else if (entityType == 'products' || entityType == 'prices') {
      await _applySyncProducts(result);
    } else if (entityType == 'orders' && result.orders.isNotEmpty) {
      await _db.upsertOrders(result.orders.map((o) => o.toMap()).toList());
    }
    await _db.setLastSyncAt(result.syncAt);
    return result;
  }

  /// Full sync — download all data from server
  Future<String> syncFull({String? lastSyncAt}) async {
    final result = await pullSync(lastSyncAt: lastSyncAt);
    return result.syncAt;
  }

  /// Sync + SQLite yangilash (parse isolate + bitta tranzaksiya).
  Future<ParsedSyncPayload> pullSync({
    String? lastSyncAt,
    void Function(int phase)? onPhase,
    bool forceClientsCatalog = false,
  }) async {
    onPhase?.call(0);
    final deviceFuture = MobileDeviceInfo.syncPayload();
    final offlineFuture = flushOfflineQueue(policySync: _syncConfig);
    final photoFuture = flushPendingPhotoReports();
    final device = await deviceFuture;
    final payload = await _mobileApi.syncFullParsed(
      _slug,
      lastSyncAt: lastSyncAt,
      device: device,
      forceClientsCatalog: forceClientsCatalog,
    );

    onPhase?.call(1);
    final replaceCatalog = _userRole == 'agent' &&
        (isFullCatalogSync(lastSyncAt) || forceClientsCatalog);
    await _db.persistSync(
      replaceProductCatalog: replaceCatalog,
      replaceClients: payload.clientsReplaceAll,
      markAgentClientsSynced: _userRole == 'agent' && payload.clientsReplaceAll,
      products: payload.products,
      prices: payload.prices,
      clients: payload.clients,
      orders: payload.orders,
      syncAt: payload.syncAt,
    );

    onPhase?.call(5);
    unawaited(offlineFuture);
    unawaited(photoFuture);
    return payload;
  }

  /// Flush offline queue — send pending orders to server
  /// Returns number of successfully sent orders
  Future<FlushResult> flushOfflineQueue({SyncConfig? policySync}) async {
    if (policySync != null && !evaluateSyncPolicy(policySync).allowed) {
      return FlushResult(sent: 0, failed: 0, skippedByPolicy: true);
    }
    final pending = await _db.getPendingOrders();
    if (pending.isEmpty) return FlushResult(sent: 0, failed: 0);

    int sent = 0;
    int failed = 0;

    for (final item in pending) {
      try {
        final itemsJson = item['items'] as String;
        final items = jsonDecode(itemsJson) as List;

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
      } catch (e) {
        failed++;
        break;
      }
    }

    return FlushResult(sent: sent, failed: failed);
  }

  /// Oflayn saqlangan foto hisobotlarni serverga yuborish.
  Future<PhotoFlushResult> flushPendingPhotoReports({PhotoConfig? photoConfig}) async {
    return PhotoReportQueue.flush(
      api: _mobileApi,
      slug: _slug,
      photoConfig: photoConfig,
    );
  }

  /// Server pending + local queue
  Future<int> pendingCount() async {
    try {
      final server = await _mobileApi.getPendingCount(_slug);
      final local = await _db.pendingCount();
      return server + local;
    } catch (_) {
      return _db.pendingCount();
    }
  }

  /// Flush server-side pending_sync orders (agent).
  Future<Map<String, dynamic>?> flushServerPending({SyncConfig? policySync}) async {
    if (policySync != null && !evaluateSyncPolicy(policySync).allowed) {
      return null;
    }
    try {
      return await _mobileApi.syncFlushOrders(_slug);
    } catch (_) {
      return null;
    }
  }
}

class FlushResult {
  final int sent;
  final int failed;
  final bool skippedByPolicy;
  FlushResult({required this.sent, required this.failed, this.skippedByPolicy = false});
}

/// Sync engine provider
final syncEngineProvider = Provider<SyncEngine?>((ref) {
  final slug = ref.watch(sessionProvider.select((s) => s.tenantSlug));
  final role = ref.watch(sessionProvider.select((s) => s.user?.role));
  final syncCfg = ref.watch(sessionProvider.select((s) => s.mobileConfig?.sync ?? const SyncConfig()));
  if (slug == null || slug.isEmpty) return null;

  return SyncEngine(
    mobileApi: ref.read(mobileApiProvider),
    db: AppDatabase(),
    slug: slug,
    userRole: role,
    syncConfig: syncCfg,
  );
});

/// Auto-flush offline queue when connectivity returns (vaqt oynasi + block_sync).
final autoFlushProvider = Provider<void>((ref) {
  final isOnline = ref.watch(isOnlineProvider);
  final syncEngine = ref.read(syncEngineProvider);
  final policy = ref.watch(syncPolicyProvider);
  final syncCfg = ref.watch(sessionProvider.select((s) => s.mobileConfig?.sync ?? const SyncConfig()));

  isOnline.whenData((online) async {
    if (!policy.allowed || !online || syncEngine == null) return;
    try {
      final photoCfg = ref.read(sessionProvider).mobileConfig?.photo;
      final photoPending = await AppDatabase().pendingPhotoReportCount();
      if (photoPending > 0) {
        await syncEngine.flushPendingPhotoReports(photoConfig: photoCfg);
      }
      final count = await syncEngine.pendingCount();
      if (count > 0) {
        await syncEngine.flushOfflineQueue(policySync: syncCfg);
      }
    } catch (_) {}
  });
});
