import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/database/app_database.dart';
import '../../../core/map/route_map_stop.dart';
import '../../../core/time/work_region_time.dart';

int _stopSortKey(Map<String, dynamic> m) =>
    (m['sort'] as num?)?.toInt() ??
    (m['order'] as num?)?.toInt() ??
    (m['order_index'] as num?)?.toInt() ??
    999999;

Future<Map<String, dynamic>> mergeRouteWithLocal(Map<String, dynamic>? route) async {
  if (route == null) return localRouteFallback();

  var stops = (route['stops'] as List?) ?? [];
  if (stops.isEmpty) return localRouteFallback();

  final localById = {
    for (final c in await AppDatabase().getAllClients())
      if (c['id'] != null) c['id'] as int: c,
  };

  final enriched = <Map<String, dynamic>>[];
  for (final raw in stops) {
    if (raw is! Map) continue;
    final m = Map<String, dynamic>.from(raw);
    final cid = (m['client_id'] as num?)?.toInt();
    final lat = m['latitude'] ?? m['lat'];
    final lon = m['longitude'] ?? m['lon'] ?? m['lng'];
    if ((lat == null || lon == null) && cid != null) {
      final local = localById[cid];
      if (local != null) {
        m['latitude'] ??= local['latitude'];
        m['longitude'] ??= local['longitude'];
        m['client_name'] ??= local['name'];
      }
    }
    enriched.add(m);
  }

  enriched.sort((a, b) => _stopSortKey(a).compareTo(_stopSortKey(b)));

  final withCoords = enriched.map(RouteMapStop.fromDynamic).where((s) => s.hasCoords).toList();
  if (withCoords.isEmpty) return localRouteFallback();

  return {
    ...route,
    'stops': withCoords
        .map((s) => {
              'client_id': s.clientId,
              'client_name': s.name,
              'latitude': s.latitude,
              'longitude': s.longitude,
              'sort': s.orderIndex,
            },)
        .toList(),
  };
}

Future<Map<String, dynamic>> localRouteFallback({String? routeDate}) async {
  final clients = await AppDatabase().getAllClients();
  final stops = clients
      .where((c) => c['latitude'] != null && c['longitude'] != null)
      .map((c) => {
            'client_id': c['id'],
            'client_name': c['name'],
            'latitude': c['latitude'],
            'longitude': c['longitude'],
          },)
      .toList();
  return {
    'stops': stops,
    '_localFallback': true,
    if (routeDate != null) '_routeDate': routeDate,
  };
}

/// Server marshruti yo‘q — bugungi ОКБ rejasi (tashrif kunlari) bo‘yicha nuqtalar.
Future<Map<String, dynamic>> plannedRouteFallback({
  required String routeDate,
  int? weekday,
}) async {
  final clients = await AppDatabase().getAllClients();
  final wd = weekday ?? DateTime.parse(routeDate).weekday;
  final stops = <Map<String, dynamic>>[];
  for (final c in clients) {
    if (!clientPlannedForVisitDay(c, wd, routeDate)) continue;
    stops.add({
      'client_id': c['id'],
      'client_name': c['name'],
      if (c['latitude'] != null) 'latitude': c['latitude'],
      if (c['longitude'] != null) 'longitude': c['longitude'],
    });
  }
  return {
    'stops': stops,
    '_localFallback': true,
    '_plannedFallback': true,
    '_routeDate': routeDate,
  };
}

Future<Map<String, dynamic>> resolveTodayRoute(
  Ref ref,
  String slug,
  int agentId, {
  required String routeDate,
}) async {
  try {
    final raw = await ref.read(fieldApiProvider).getTodayRoute(
          slug,
          agentId: agentId,
          routeDate: routeDate,
        );
    final merged = await mergeRouteWithLocal(raw);
    if (merged['_localFallback'] == true) {
      return plannedRouteFallback(
        routeDate: routeDate,
        weekday: DateTime.parse(routeDate).weekday,
      );
    }
    final stops = (merged['stops'] as List?) ?? [];
    if (stops.isNotEmpty) return {...merged, '_routeDate': routeDate};
  } on UnauthorizedException {
    rethrow;
  } catch (_) {}
  return plannedRouteFallback(
    routeDate: routeDate,
    weekday: DateTime.parse(routeDate).weekday,
  );
}

/// Haqiqiy bugungi kun marshruti (kalendar tabidan mustaqil — KPI uchun).
final realTodayRouteProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final session = ref.watch(sessionProvider);
  final routeDate = serverTodayKey();
  final weekday = serverTodayWeekday();
  final slug = session.tenantSlug ?? '';
  final agentId = session.user?.id;
  if (slug.isEmpty || agentId == null) {
    return plannedRouteFallback(routeDate: routeDate, weekday: weekday);
  }

  await ensureAuthTokens(ref);

  try {
    final raw = await ref.read(fieldApiProvider).getTodayRoute(
          slug,
          agentId: agentId,
          routeDate: routeDate,
        );
    if (raw != null) {
      final stops = (raw['stops'] as List?) ?? [];
      if (stops.isNotEmpty) {
        final merged = await mergeRouteWithLocal(raw);
        return {...merged, '_routeDate': routeDate};
      }
    }
  } on UnauthorizedException {
    return plannedRouteFallback(routeDate: routeDate, weekday: weekday);
  } catch (_) {}
  return plannedRouteFallback(routeDate: routeDate, weekday: weekday);
});

final todayRouteProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final session = ref.watch(sessionProvider);
  final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
  final routeDate = routeDateIsoForWeekdayTab(weekdayTab);
  final slug = session.tenantSlug ?? '';
  final agentId = session.user?.id;
  final wd = weekdayTab > 0 ? weekdayTab : DateTime.parse(routeDate).weekday;
  if (slug.isEmpty || agentId == null) {
    return plannedRouteFallback(routeDate: routeDate, weekday: wd);
  }

  await ensureAuthTokens(ref);

  try {
    return await resolveTodayRoute(ref, slug, agentId, routeDate: routeDate);
  } on UnauthorizedException {
    return plannedRouteFallback(routeDate: routeDate, weekday: wd);
  } catch (_) {
    return plannedRouteFallback(routeDate: routeDate, weekday: wd);
  }
});
