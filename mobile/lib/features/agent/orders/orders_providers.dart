import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/sync/sync_engine.dart';
import '../../../core/time/work_region_time.dart';

String ordersHistoryDateKey(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

final ordersHistoryDateProvider = StateProvider<String>((ref) {
  final now = workRegionNow();
  return ordersHistoryDateKey(DateTime(now.year, now.month, now.day));
});

final ordersListProvider = FutureProvider<List<AgentOrderHistoryRow>>((ref) async {
  final slug = ref.read(sessionProvider).tenantSlug ?? '';
  final date = ref.watch(ordersHistoryDateProvider);
  if (slug.isNotEmpty) {
    try {
      final result = await ref.read(mobileApiProvider).getOrdersHistory(slug, date: date);
      return result.orders;
    } on ApiException catch (e) {
      if (e is! NetworkException) rethrow;
    } catch (_) {
      /* tarmoq xatosi — offline fallback */
    }
  }

  final orders = await AppDatabase().getOrders(limit: 50);
  final clients = await AppDatabase().getAllClients();
  final names = {for (final c in clients) c['id']: c['name']?.toString() ?? ''};
  return orders
      .map(
        (o) => AgentOrderHistoryRow(
          id: (o['id'] as num?)?.toInt() ?? 0,
          number: o['number']?.toString(),
          status: o['status']?.toString() ?? 'new',
          clientName: names[o['client_id']] ?? 'Mijoz #${o['client_id']}',
          createdAt: o['created_at']?.toString(),
          totalSum: (o['total'] as num?)?.toDouble() ?? 0,
        ),
      )
      .where((o) => o.id > 0)
      .where((o) => _matchesHistoryDate(o.createdAt, date))
      .toList();
});

bool _matchesHistoryDate(String? createdAt, String dateKey) {
  if (createdAt == null || createdAt.isEmpty) return false;
  final dt = DateTime.tryParse(createdAt);
  if (dt == null) return createdAt.startsWith(dateKey);
  final wr = toWorkRegionFromIso(createdAt);
  if (wr == null) return false;
  return ordersHistoryDateKey(DateTime(wr.year, wr.month, wr.day)) == dateKey;
}

final pendingCountProvider = FutureProvider<int>((ref) async {
  final se = ref.read(syncEngineProvider);
  if (se != null) return se.pendingCount();
  return AppDatabase().pendingCount();
});

/// Zakaz bo‘yicha ochiq qarzlar (agent scope).
final orderDebtsByOrdersProvider = FutureProvider<OrderDebtsListResult>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) {
    return OrderDebtsListResult(data: [], total: 0, totalRemainder: 0, currency: 'UZS');
  }
  return ref.read(mobileApiProvider).getOrderDebts(slug, limit: 200);
});

/// Zakaz tafsiloti — expand qilinganda.
final orderHistoryDetailProvider = FutureProvider.family<AgentOrderHistoryRow, int>((ref, orderId) async {
  final slug = ref.read(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) throw StateError('tenant');
  return ref.read(mobileApiProvider).getOrderDetail(slug, orderId);
});
