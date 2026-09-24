import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/agent/clients/clients_list_provider.dart';
import '../../features/agent/route/agent_route_provider.dart';
import '../api/mobile_api.dart';
import '../auth/session.dart';
import '../database/app_database.dart';
import '../l10n/app_strings_ru.dart';
import '../prefs/agent_local_prefs_provider.dart';
import 'client_outlet_filters.dart';
import 'okb_metrics.dart';

/// 0=Все, 1..7=Du..Ya — default bugungi kun.
final outletWeekdayTabProvider = StateProvider<int>((ref) => DateTime.now().weekday);

/// Kalendar rejimi o‘chiq bo‘lsa — har doim «Все».
final effectiveWeekdayTabProvider = Provider<int>((ref) {
  final prefs = ref.watch(agentLocalPrefsProvider).valueOrNull;
  if (prefs != null && !prefs.calendarMode) return 0;
  return ref.watch(outletWeekdayTabProvider);
});

final outletCategoryFilterProvider = StateProvider<String?>((ref) => null);

/// «Статус посещения»: Все / Посещено / Не посещено (bugungi vizitlar bo‘yicha).
final outletVisitStatusFilterProvider = StateProvider<String?>((ref) => S.dayAll);

final outletDebtsOnlyProvider = StateProvider<bool>((ref) => false);

/// Barcha outlet filtrlarni defaultga: kun «Все», kategoriya/status/qarz tozalash.
void resetOutletFilters(WidgetRef ref) {
  ref.read(outletWeekdayTabProvider.notifier).state = 0;
  ref.read(outletCategoryFilterProvider.notifier).state = null;
  ref.read(outletVisitStatusFilterProvider.notifier).state = S.dayAll;
  ref.read(outletDebtsOnlyProvider.notifier).state = false;
  ref.invalidate(filteredClientsProvider);
  ref.invalidate(visitedTodayClientIdsProvider);
}

/// Joriy agent bo‘yicha mijozlar umumiy balansi (veb kartochka «Общий» per agent).
final clientAgentLedgerBalancesProvider = FutureProvider<Map<int, double>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {};
  return ref.read(mobileApiProvider).getClientLedgerBalances(slug);
});

final visitedTodayClientIdsProvider = FutureProvider<Set<int>>((ref) async {
  final db = AppDatabase();
  final rows = await db.getVisitsForDay();
  final visitIds = <int>{};
  for (final r in rows) {
    final status = r['status']?.toString();
    if (status != 'completed' && status != 'in_progress' && status != 'refused') continue;
    final cid = (r['client_id'] as num?)?.toInt();
    if (cid != null) visitIds.add(cid);
  }
  // «Начать визит»siz: oddiy zakaz + sinxron foto ham «Посещено» ga kiradi.
  final orderIds = await db.getClientIdsWithOrdersToday();
  final pendingOrderIds = await db.getClientIdsWithPendingOrdersToday();
  final heldOrderIds = await db.getClientIdsWithPendingHeldOrdersToday();
  final photoIds = await db.getPhotoSyncedClientIdsToday();
  return mergeVisitedActivityIds(
    visitClientIds: visitIds,
    orderClientIds: {...orderIds, ...pendingOrderIds, ...heldOrderIds},
    photoSyncedClientIds: photoIds,
  );
});

final filteredClientsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final all = await ref.watch(clientsListProvider.future);
  final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
  final category = ref.watch(outletCategoryFilterProvider);
  final visitStatus = ref.watch(outletVisitStatusFilterProvider);
  final debtsOnly = ref.watch(outletDebtsOnlyProvider);

  Set<int>? visitedIds;
  if (visitStatus == S.visitStatusVisited || visitStatus == S.visitStatusNotVisited) {
    visitedIds = await ref.watch(visitedTodayClientIdsProvider.future);
  }

  Set<int>? routeClientIds;
  if (weekdayTab > 0) {
    final route = await ref.watch(todayRouteProvider.future);
    // Faqat server marshruti qo‘shimcha filtr — local «barcha GPS» fallback emas.
    final isServerRoute = route != null &&
        route['_localFallback'] != true &&
        route['_plannedFallback'] != true;
    if (isServerRoute) {
      final ids = routeClientIdsFromRoute(route);
      if (ids.isNotEmpty) routeClientIds = ids;
    }
  }

  // Kun tabida reja yo‘q bo‘lsa ham katalog ko‘rinsin (sinxron kunlari bo‘sh).
  final includeUnscheduled = !tenantHasAnyVisitSchedule(all);

  return applyOutletFilters(
    all,
    weekdayTab: weekdayTab,
    category: category,
    visitStatus: visitStatus,
    visitedTodayIds: visitedIds,
    debtsOnly: debtsOnly,
    routeClientIds: routeClientIds,
    includeUnscheduled: includeUnscheduled,
  );
});
