import 'dart:convert';

import '../format/money_display.dart';
import '../l10n/app_strings_ru.dart';
import '../time/work_region_time.dart';

/// `visit_weekdays` — SQLite JSON yoki sync ro‘yxati (1=Du … 7=Ya).
List<int> parseVisitWeekdaysField(dynamic raw) {
  if (raw == null) return [];
  if (raw is List) {
    return raw
        .map((e) => e is num ? e.toInt() : int.tryParse(e.toString()))
        .whereType<int>()
        .where((n) => n >= 1 && n <= 7)
        .toSet()
        .toList()
      ..sort();
  }
  if (raw is String && raw.trim().isNotEmpty) {
    final s = raw.trim();
    if (s.startsWith('[')) {
      try {
        return parseVisitWeekdaysField(jsonDecode(s));
      } catch (_) {
        return [];
      }
    }
    if (s.contains(',')) {
      return s
          .split(',')
          .map((p) => int.tryParse(p.trim()))
          .whereType<int>()
          .where((n) => n >= 1 && n <= 7)
          .toSet()
          .toList()
        ..sort();
    }
    try {
      return parseVisitWeekdaysField(jsonDecode(s));
    } catch (_) {
      return [];
    }
  }
  return [];
}

const _ruWeekdayTokens = {
  'ПН': 1,
  'ВТ': 2,
  'СР': 3,
  'ЧТ': 4,
  'ПТ': 5,
  'СБ': 6,
  'ВС': 7,
};

const _ruWeekdayLabels = {
  1: 'ПН',
  2: 'ВТ',
  3: 'СР',
  4: 'ЧТ',
  5: 'ПТ',
  6: 'СБ',
  7: 'ВС',
};

/// [1, 2, 5] → «ПН, ВТ, ПТ»
String formatVisitWeekdaysRu(Iterable<int> days) {
  final uniq = days.where((d) => d >= 1 && d <= 7).toSet().toList()..sort();
  if (uniq.isEmpty) return '';
  return uniq.map((d) => _ruWeekdayLabels[d] ?? '').where((s) => s.isNotEmpty).join(', ');
}

/// Mijoz kartasi: tashrif kunlari matni.
String? formatClientVisitDaysDisplay(Map<String, dynamic> client) {
  final wd = resolveClientVisitWeekdays(client);
  if (wd.isNotEmpty) {
    final label = formatVisitWeekdaysRu(wd);
    if (label.isNotEmpty) return label;
  }
  final vd = client['visit_date']?.toString();
  if (vd != null && vd.length >= 10) return vd.substring(0, 10);
  final visitDay = client['visit_day']?.toString().trim();
  if (visitDay != null && visitDay.isNotEmpty) {
    final parsed = parseVisitWeekdaysFromRuSelection(visitDay);
    if (parsed.isNotEmpty) return formatVisitWeekdaysRu(parsed);
    return visitDay;
  }
  return null;
}

/// «ПН, СР, ПТ» yoki «ПН» → [1, 3, 5] / [1]
List<int> parseVisitWeekdaysFromRuSelection(String? raw) {
  if (raw == null || raw.trim().isEmpty) return [];
  final out = <int>{};
  for (final part in raw.split(RegExp(r'[,;]+'))) {
    final token = part.trim().toUpperCase();
    final wd = _ruWeekdayTokens[token];
    if (wd != null) out.add(wd);
  }
  final list = out.toList()..sort();
  return list;
}

/// Agent marshruti uchun ISO sana. 0=bugun, 1..7=joriy haftadagi Du..Ya.
String routeDateIsoForWeekdayTab(int tabIndex) {
  final now = workRegionNow();
  if (tabIndex <= 0) {
    return now.toIso8601String().substring(0, 10);
  }
  final diff = tabIndex - now.weekday;
  final d = DateTime(now.year, now.month, now.day + diff);
  return d.toIso8601String().substring(0, 10);
}

/// Takrorlanuvchi reja: faqat `visit_weekdays` / `visit_day` (ПН…ВС).
bool clientPlannedForWeekday(Map<String, dynamic> client, int weekday) {
  final wd = resolveClientVisitWeekdays(client);
  return wd.contains(weekday);
}

/// Bugungi kun rejasiga tushadimi: aniq `visit_date` yoki takrorlanuvchi `visit_weekdays`.
bool clientPlannedForVisitDay(
  Map<String, dynamic> client,
  int weekday,
  String todayIso,
) {
  final visitDate = client['visit_date']?.toString();
  if (visitDate != null && visitDate.length >= 10) {
    if (visitDate.substring(0, 10) == todayIso) return true;
  }
  final wd = resolveClientVisitWeekdays(client);
  if (wd.isEmpty) return false;
  return wd.contains(weekday);
}

/// Agentning bugungi ОКБ rejasi — shu kunga rejalashtirilgan mijozlar.
Set<int> plannedClientIdsForDay(
  List<Map<String, dynamic>> clients,
  int weekday,
  String todayIso,
) {
  final ids = <int>{};
  for (final c in clients) {
    if (!clientPlannedForVisitDay(c, weekday, todayIso)) continue;
    final id = (c['id'] as num?)?.toInt();
    if (id != null) ids.add(id);
  }
  return ids;
}

/// Mijozning tashrif kunlari: `visit_weekdays`, bo‘sh bo‘lsa `visit_day` (ПН…ВС).
List<int> resolveClientVisitWeekdays(Map<String, dynamic> client) {
  final wd = parseVisitWeekdaysField(client['visit_weekdays']);
  if (wd.isNotEmpty) return wd;
  final visitDay = client['visit_day']?.toString();
  if (visitDay != null && visitDay.trim().isNotEmpty) {
    return parseVisitWeekdaysFromRuSelection(visitDay);
  }
  return [];
}

/// `weekDays` indeksi: 0=Все, 1..7=Du..Ya (`DateTime.weekday` bilan mos).
bool clientMatchesWeekdayTab(
  Map<String, dynamic> client,
  int tabIndex, {
  Set<int>? routeClientIds,
}) {
  if (tabIndex <= 0) return true;
  final id = (client['id'] as num?)?.toInt();
  if (id != null && routeClientIds != null && routeClientIds.contains(id)) {
    return true;
  }
  final wd = resolveClientVisitWeekdays(client);
  if (wd.isEmpty) return false;
  return wd.contains(tabIndex);
}

Set<int> routeClientIdsFromRoute(Map<String, dynamic>? route) {
  final stops = route?['stops'] as List? ?? [];
  final ids = <int>{};
  for (final s in stops) {
    if (s is! Map) continue;
    final id = (s['client_id'] as num?)?.toInt();
    if (id != null) ids.add(id);
  }
  return ids;
}

List<Map<String, dynamic>> applyOutletFilters(
  List<Map<String, dynamic>> clients, {
  required int weekdayTab,
  String? category,
  String? visitStatus,
  Set<int>? visitedTodayIds,
  bool debtsOnly = false,
  Set<int>? routeClientIds,
}) {
  var list = clients
      .where((c) => clientMatchesWeekdayTab(c, weekdayTab, routeClientIds: routeClientIds))
      .toList();

  if (category != null && category.isNotEmpty) {
    list = list
        .where((c) {
          final cat = c['category']?.toString().trim();
          final effective = (cat == null || cat.isEmpty) ? 'B' : cat;
          return effective == category;
        })
        .toList();
  }

  if (debtsOnly) {
    list = list.where((c) {
      final raw = c['balance'];
      final n = raw is num ? raw.toDouble() : double.tryParse(raw?.toString() ?? '');
      return n != null && n < 0;
    }).toList();
  }

  if (visitStatus == S.visitStatusVisited && visitedTodayIds != null) {
    list = list.where((c) => visitedTodayIds.contains(c['id'])).toList();
  } else if (visitStatus == S.visitStatusNotVisited && visitedTodayIds != null) {
    list = list.where((c) => !visitedTodayIds.contains(c['id'])).toList();
  }

  return list;
}

bool clientHasMapCoords(Map<String, dynamic> client) {
  final lat = client['latitude'];
  final lon = client['longitude'];
  if (lat == null || lon == null) return false;
  final la = lat is num ? lat.toDouble() : double.tryParse(lat.toString());
  final lo = lon is num ? lon.toDouble() : double.tryParse(lon.toString());
  return la != null && lo != null && la != 0 && lo != 0;
}

String formatClientBalance(Map<String, dynamic> client) =>
    formatClientBalanceFromMap(client);
