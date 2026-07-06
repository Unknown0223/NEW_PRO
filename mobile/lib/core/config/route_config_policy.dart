import '../map/route_map_stop.dart';
import '../time/work_region_time.dart';
import 'mobile_config.dart';

/// Tashrif/buyurtmadan keyin marshrutga qayta qo‘shilmaslik muddati.
bool isClientInReaddCooldown({
  required int clientId,
  required int readdCooldownDays,
  required Map<int, DateTime> lastActivityByClient,
  DateTime? today,
}) {
  if (readdCooldownDays <= 0) return false;
  final last = lastActivityByClient[clientId];
  if (last == null) return false;
  final now = today ?? workRegionNow();
  final todayDate = DateTime(now.year, now.month, now.day);
  final lastDate = DateTime(last.year, last.month, last.day);
  final daysSince = todayDate.difference(lastDate).inDays;
  return daysSince < readdCooldownDays;
}

/// Avtomatik marshrut nuqtalarini cooldown va kunlik limit bo‘yicha kesish.
List<RouteMapStop> applyRouteConfigToStops(
  List<RouteMapStop> stops, {
  required RouteConfig route,
  required Map<int, DateTime> lastActivityByClient,
  DateTime? today,
}) {
  final filtered = <RouteMapStop>[];
  for (final stop in stops) {
    final cid = stop.clientId;
    if (cid != null &&
        isClientInReaddCooldown(
          clientId: cid,
          readdCooldownDays: route.readdCooldownDays,
          lastActivityByClient: lastActivityByClient,
          today: today,
        )) {
      continue;
    }
    filtered.add(stop);
  }

  final limit = route.dailyVisitLimit;
  if (limit <= 0 || filtered.length <= limit) return filtered;
  return filtered.take(limit).toList(growable: false);
}

String readdCooldownBlockMessage(int days) {
  if (days <= 0) return '';
  return 'Клиент скрыт с карты маршрута — повтор через $days дн. после последнего визита. Заказ через «Все» доступен.';
}

String dailyRouteLimitMessage(int limit) =>
    'Достигнут лимит точек маршрута на сегодня ($limit)';
