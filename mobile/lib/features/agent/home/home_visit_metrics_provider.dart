import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/clients/okb_metrics.dart';
import '../../../core/database/app_database.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../agent/clients/clients_list_provider.dart';
import '../route/agent_route_provider.dart';
import 'agent_dashboard_provider.dart';

typedef HomeVisitMetrics = ({
  int visited,
  int total,
  int onRoute,
  int offRoute,
  int remainingOnRoute,
  int remainingOffRoute,
  /// Bugungi hafta kuni marshrutida 30 kun ichida tashrifsiz mijozlar.
  int dormantOnWeekday,
  /// ОКБ dagi noyob mijozlar — 30 kun ichida tashrifsiz.
  int dormantUnique,
});

/// Bosh sahifa «Посещено / Осталось» — bugungi reja (ОКБ) bo‘yicha.
final homeVisitMetricsProvider = FutureProvider<HomeVisitMetrics>((ref) async {
  final calendarOn = ref.watch(agentLocalPrefsProvider).valueOrNull?.calendarMode ?? true;
  final visitedIds = await ref.watch(visitedTodayClientIdsProvider.future);

  final todayIso = serverTodayKey();
  final todayWeekday = serverTodayWeekday();
  final realTodayRoute = await ref.watch(realTodayRouteProvider.future);
  final allClients = await ref.watch(clientsListProvider.future);
  final plannedToday = plannedClientIdsForDay(allClients, todayWeekday, todayIso);
  final planIds = resolveRouteClientIdsForDay(
    route: realTodayRoute,
    plannedClientIds: plannedToday,
  );

  var onRoute = 0;
  var offRoute = 0;
  for (final id in visitedIds) {
    if (planIds.contains(id)) {
      onRoute++;
    } else {
      offRoute++;
    }
  }
  final visited = visitedIds.length;
  final total = planIds.length;

  final visitedIn30d = await AppDatabase().getClientIdsVisitedSince(okbLookbackSince());

  final dormantOnWeekday = countDormantOnTodayWeekday(
    clients: allClients,
    weekday: todayWeekday,
    todayIso: todayIso,
    routeClientIds: planIds,
    visitedInLookback: visitedIn30d,
  );
  final dormantUnique = countDormantUniqueClients(
    clients: allClients,
    visitedInLookback: visitedIn30d,
  );

  final remainingOnRoute = (total - onRoute).clamp(0, 999999);

  final offPlanRemaining = <int>{};
  for (final id in plannedToday) {
    if (planIds.contains(id)) continue;
    if (!visitedIds.contains(id)) offPlanRemaining.add(id);
  }
  if (calendarOn) {
    final filtered = await ref.watch(filteredClientsProvider.future);
    for (final c in filtered) {
      final id = (c['id'] as num?)?.toInt();
      if (id == null || planIds.contains(id)) continue;
      if (!visitedIds.contains(id)) offPlanRemaining.add(id);
    }
  } else {
    for (final c in allClients) {
      final id = (c['id'] as num?)?.toInt();
      if (id == null || planIds.contains(id)) continue;
      if (!visitedIds.contains(id)) offPlanRemaining.add(id);
    }
  }
  final remainingOffRoute = offPlanRemaining.length;

  if (calendarOn) {
    return (
      visited: visited,
      total: total,
      onRoute: onRoute,
      offRoute: offRoute,
      remainingOnRoute: remainingOnRoute,
      remainingOffRoute: remainingOffRoute,
      dormantOnWeekday: dormantOnWeekday,
      dormantUnique: dormantUnique,
    );
  }

  final dash = await ref.watch(agentDashboardProvider.future);
  final dashTotal = dash.clientsCount > 0 ? dash.clientsCount : total;
  final dashVisited = dash.visitsToday > 0 ? dash.visitsToday : visited;
  return (
    visited: dashVisited,
    total: dashTotal,
    onRoute: onRoute > 0 ? onRoute : dashVisited,
    offRoute: offRoute,
    remainingOnRoute: (dashTotal - dashVisited).clamp(0, 999999),
    remainingOffRoute: remainingOffRoute,
    dormantOnWeekday: dormantOnWeekday,
    dormantUnique: dormantUnique,
  );
});
