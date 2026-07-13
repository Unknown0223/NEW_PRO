import '../time/work_region_time.dart';
import 'client_outlet_filters.dart';

/// 1 oy (30 kun) ichida hech qanday tashrif bo‘lmagan mijozlar uchun lookback.
const okbDormantLookbackDays = 30;

/// Bugungi hafta kuni rejasidagi mijozlar — oxirgi 30 kun ichida tashrif yo‘q.
int countDormantOnTodayWeekday({
  required List<Map<String, dynamic>> clients,
  required int weekday,
  required String todayIso,
  required Set<int> routeClientIds,
  required Set<int> visitedInLookback,
}) {
  var n = 0;
  for (final c in clients) {
    final id = (c['id'] as num?)?.toInt();
    if (id == null || !routeClientIds.contains(id)) continue;
    if (!clientPlannedForVisitDay(c, weekday, todayIso)) continue;
    if (!visitedInLookback.contains(id)) n++;
  }
  return n;
}

/// Barcha hafta kunlari (Du..Ya) bo‘yicha 30 kunlik «tashrifsiz» mijozlar yig‘indisi.
///
/// Bir mijoz bir nechta kunda rejalashtirilgan bo‘lsa, har bir kun uchun alohida sanaladi.
int sumDormantAllWeekdays({
  required List<Map<String, dynamic>> clients,
  required Set<int> visitedInLookback,
}) {
  var sum = 0;
  for (var wd = 1; wd <= 7; wd++) {
    sum += countDormantForWeekday(
      clients: clients,
      weekday: wd,
      visitedInLookback: visitedInLookback,
    );
  }
  return sum;
}

/// 30 kun ichida tashrifsiz, ОКБ da kamida bitta kun rejalashtirilgan **noyob** mijozlar.
int countDormantUniqueClients({
  required List<Map<String, dynamic>> clients,
  required Set<int> visitedInLookback,
}) {
  var n = 0;
  for (final c in clients) {
    final id = (c['id'] as num?)?.toInt();
    if (id == null) continue;
    if (resolveClientVisitWeekdays(c).isEmpty) continue;
    if (!visitedInLookback.contains(id)) n++;
  }
  return n;
}

int countDormantForWeekday({
  required List<Map<String, dynamic>> clients,
  required int weekday,
  required Set<int> visitedInLookback,
}) {
  var n = 0;
  for (final c in clients) {
    final id = (c['id'] as num?)?.toInt();
    if (id == null) continue;
    if (!clientPlannedForWeekday(c, weekday)) continue;
    if (!visitedInLookback.contains(id)) n++;
  }
  return n;
}

/// Server marshruti bo‘sh bo‘lsa — bugungi reja (ОКБ) mijozlari marshrut hisoblanadi.
Set<int> resolveRouteClientIdsForDay({
  required Map<String, dynamic>? route,
  required Set<int> plannedClientIds,
}) {
  final fromApi = routeClientIdsFromRoute(route);
  if (fromApi.isNotEmpty) return fromApi;
  return plannedClientIds;
}

DateTime okbLookbackSince([DateTime? now]) {
  final n = now ?? workRegionNow();
  final today = DateTime(n.year, n.month, n.day);
  return today.subtract(const Duration(days: okbDormantLookbackDays));
}
