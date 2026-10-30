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

  // Parallel — GPS / route / visited / activity birga.
  final packed = await Future.wait<Object?>([
    ref.watch(todayRouteProvider.future),
    ref.watch(agentRouteStartProvider.future),
    ref.watch(visitedTodayClientIdsProvider.future),
    AppDatabase().getLastClientActivityById(),
  ]);

  final route = packed[0] as Map<String, dynamic>?;
  final routeStart = packed[1] as RouteMapStop?;
  final visitedIds = packed[2] as Set<int>;
  final lastActivity = packed[3] as Map<int, DateTime>;
  final routeCfg = ref.watch(sessionProvider).mobileConfig?.route ?? const RouteConfig();

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

  final savedCount = (route?['_savedStopCount'] as num?)?.toInt() ?? 0;
  if (savedCount <= 0) {
    return optimizeVisitRouteOrder(
      capped,
      startLat: routeStart?.latitude,
      startLon: routeStart?.longitude,
    );
  }

  // Server (web «Маршрут дня агента») tartibi saqlanadi; qo‘shimcha reja nuqtalari oxirida.
  final savedIds = {for (final s in rawStops.take(savedCount)) s.clientId};
  final saved = capped.where((s) => savedIds.contains(s.clientId)).toList();
  final extra = capped.where((s) => !savedIds.contains(s.clientId)).toList();
  final tailStart = saved.isNotEmpty ? saved.last : routeStart;
  final tail = extra.isEmpty
      ? const <RouteMapStop>[]
      : optimizeVisitRouteOrder(
          extra,
          startLat: tailStart?.latitude,
          startLon: tailStart?.longitude,
        );
  final ordered = [...saved, ...tail];
  return [
    for (var i = 0; i < ordered.length; i++)
      RouteMapStop(
        clientId: ordered[i].clientId,
        name: ordered[i].name,
        latitude: ordered[i].latitude,
        longitude: ordered[i].longitude,
        orderIndex: i + 1,
        visited: ordered[i].visited,
      ),
  ];
});
