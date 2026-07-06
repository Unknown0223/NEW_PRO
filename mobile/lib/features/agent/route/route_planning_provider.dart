import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/route_config_policy.dart';
import '../../../core/database/app_database.dart';
import '../../../core/map/route_map_stop.dart';
import 'agent_route_provider.dart';
import 'agent_route_start_provider.dart';

/// Kunlik avtomatik marshrut — cooldown, limit va optimal tartib.
final plannedDailyRouteProvider = FutureProvider<List<RouteMapStop>>((ref) async {
  final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
  if (weekdayTab <= 0) return const [];

  final route = await ref.watch(todayRouteProvider.future);
  final routeStart = await ref.watch(agentRouteStartProvider.future);
  final visitedIds = await ref.watch(visitedTodayClientIdsProvider.future);
  final routeCfg = ref.watch(sessionProvider).mobileConfig?.route ?? const RouteConfig();
  final lastActivity = await AppDatabase().getLastClientActivityById();

  final rawStops = <RouteMapStop>[];
  final stopsRaw = (route?['stops'] as List?) ?? [];
  for (final raw in stopsRaw) {
    if (raw is! Map) continue;
    final stop = RouteMapStop.fromDynamic(raw);
    if (!stop.hasCoords) continue;
    final cid = stop.clientId;
    rawStops.add(
      RouteMapStop(
        clientId: stop.clientId,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        orderIndex: stop.orderIndex,
        visited: cid != null && visitedIds.contains(cid),
      ),
    );
  }

  if (rawStops.isEmpty) {
    final clients = await ref.watch(filteredClientsProvider.future);
    final onMap = clients.where(clientHasMapCoords).toList();
    if (onMap.isEmpty) return const [];
    for (final c in onMap) {
      final id = (c['id'] as num?)?.toInt();
      rawStops.add(
        RouteMapStop.fromClient(
          c,
          visited: id != null && visitedIds.contains(id),
        ),
      );
    }
  }

  final capped = applyRouteConfigToStops(
    rawStops,
    route: routeCfg,
    lastActivityByClient: lastActivity,
  );

  return optimizeVisitRouteOrder(
    capped,
    startLat: routeStart?.latitude,
    startLon: routeStart?.longitude,
  );
});
