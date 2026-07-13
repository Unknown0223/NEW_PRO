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
  final local = dt.toLocal();
  return ordersHistoryDateKey(DateTime(local.year, local.month, local.day)) == dateKey;
}

final pendingCountProvider = FutureProvider<int>((ref) async {
  final se = ref.read(syncEngineProvider);
  if (se != null) return se.pendingCount();
  return AppDatabase().pendingCount();
});
