import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/agent/clients/clients_list_provider.dart';
import '../../features/agent/route/agent_route_provider.dart';
import '../database/app_database.dart';
import '../l10n/app_strings_ru.dart';
import '../prefs/agent_local_prefs_provider.dart';
import 'client_outlet_filters.dart';

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

final visitedTodayClientIdsProvider = FutureProvider<Set<int>>((ref) async {
  final rows = await AppDatabase().getVisitsForDay();
  final ids = <int>{};
  for (final r in rows) {
    final status = r['status']?.toString();
    if (status != 'completed' && status != 'in_progress' && status != 'refused') continue;
    final cid = (r['client_id'] as num?)?.toInt();
    if (cid != null) ids.add(cid);
  }
  return ids;
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
    final ids = routeClientIdsFromRoute(route);
    if (ids.isNotEmpty) routeClientIds = ids;
  }

  return applyOutletFilters(
    all,
    weekdayTab: weekdayTab,
    category: category,
    visitStatus: visitStatus,
    visitedTodayIds: visitedIds,
    debtsOnly: debtsOnly,
    routeClientIds: routeClientIds,
  );
});
