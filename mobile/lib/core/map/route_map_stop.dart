/// Marshrut / xarita nuqtasi.
library;
import 'dart:math' as math;

class RouteMapStop {
  final int? clientId;
  final String name;
  final double latitude;
  final double longitude;
  /// Marshrut tartibi (1, 2, …) — xaritada raqamli marker.
  final int? orderIndex;
  final bool visited;

  const RouteMapStop({
    this.clientId,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.orderIndex,
    this.visited = false,
  });

  factory RouteMapStop.fromDynamic(dynamic raw) {
    if (raw is! Map) {
      return const RouteMapStop(name: '—', latitude: 0, longitude: 0);
    }
    final lat = _toDouble(raw['latitude'] ?? raw['lat']);
    final lon = _toDouble(raw['longitude'] ?? raw['lon'] ?? raw['lng']);
    return RouteMapStop(
      clientId: (raw['client_id'] as num?)?.toInt(),
      name: raw['client_name']?.toString() ?? raw['name']?.toString() ?? 'Mijoz',
      latitude: lat,
      longitude: lon,
      orderIndex: (raw['order'] as num?)?.toInt() ??
          (raw['order_index'] as num?)?.toInt() ??
          (raw['sort'] as num?)?.toInt(),
      visited: raw['visited'] == true,
    );
  }

  factory RouteMapStop.fromClient(
    Map<String, dynamic> client, {
    int? orderIndex,
    bool visited = false,
  }) {
    return RouteMapStop(
      clientId: (client['id'] as num?)?.toInt(),
      name: client['name']?.toString() ?? 'Mijoz',
      latitude: _toDouble(client['latitude']),
      longitude: _toDouble(client['longitude']),
      orderIndex: orderIndex,
      visited: visited,
    );
  }

  static double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }

  bool get hasCoords => latitude != 0 || longitude != 0;

  RouteMapStop copyWith({
    int? clientId,
    String? name,
    double? latitude,
    double? longitude,
    int? orderIndex,
    bool? visited,
  }) {
    return RouteMapStop(
      clientId: clientId ?? this.clientId,
      name: name ?? this.name,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      orderIndex: orderIndex ?? this.orderIndex,
      visited: visited ?? this.visited,
    );
  }
}

double routeMapDistanceKm(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371.0;
  final dLat = _toRad(lat2 - lat1);
  final dLon = _toRad(lon2 - lon1);
  final a = math.pow(math.sin(dLat / 2), 2) +
      math.cos(_toRad(lat1)) * math.cos(_toRad(lat2)) * math.pow(math.sin(dLon / 2), 2);
  return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

double _toRad(double deg) => deg * math.pi / 180;

/// Tartiblash uchun tez masofa (kvadrat, haversine o‘rniga) — nisbiy taqqoslash.
double routeMapDistanceScore(double lat1, double lon1, double lat2, double lon2) {
  final midLat = (lat1 + lat2) * 0.5;
  final dLat = lat1 - lat2;
  final dLon = (lon1 - lon2) * math.cos(_toRad(midLat));
  return dLat * dLat + dLon * dLon;
}

double _pathLengthScore(List<RouteMapStop> path, double? startLat, double? startLon) {
  if (path.isEmpty) return 0;
  var total = 0.0;
  var curLat = startLat;
  var curLon = startLon;
  if (curLat == null || curLon == null || (curLat == 0 && curLon == 0)) {
    curLat = path.first.latitude;
    curLon = path.first.longitude;
  } else {
    total += routeMapDistanceScore(curLat, curLon, path.first.latitude, path.first.longitude);
    curLat = path.first.latitude;
    curLon = path.first.longitude;
  }
  for (var i = 1; i < path.length; i++) {
    total += routeMapDistanceScore(
      curLat!,
      curLon!,
      path[i].latitude,
      path[i].longitude,
    );
    curLat = path[i].latitude;
    curLon = path[i].longitude;
  }
  return total;
}

List<RouteMapStop> _nearestNeighborOrder(
  List<RouteMapStop> stops, {
  double? startLat,
  double? startLon,
}) {
  final remaining = List<RouteMapStop>.from(stops);
  final ordered = <RouteMapStop>[];

  var curLat = startLat;
  var curLon = startLon;
  if (curLat == null || curLon == null || (curLat == 0 && curLon == 0)) {
    curLat = remaining.map((s) => s.latitude).reduce((a, b) => a + b) / remaining.length;
    curLon = remaining.map((s) => s.longitude).reduce((a, b) => a + b) / remaining.length;
  }

  while (remaining.isNotEmpty) {
    var bestIdx = 0;
    var bestScore = double.infinity;
    for (var i = 0; i < remaining.length; i++) {
      final s = remaining[i];
      // Tashrif qilinganlarni biroz orqaga — avval yangi nuqtalar.
      var d = routeMapDistanceScore(curLat!, curLon!, s.latitude, s.longitude);
      if (s.visited) d *= 1.45;
      if (d < bestScore) {
        bestScore = d;
        bestIdx = i;
      }
    }
    final next = remaining.removeAt(bestIdx);
    ordered.add(next);
    curLat = next.latitude;
    curLon = next.longitude;
  }
  return ordered;
}

/// 2-opt — qisqa kesishuvlarni yo‘qotish (tez lokal yaxshilash).
List<RouteMapStop> twoOptImproveRoute(
  List<RouteMapStop> path, {
  double? startLat,
  double? startLon,
  int maxPasses = 3,
}) {
  if (path.length < 4) return path;
  final n = path.length;
  var best = List<RouteMapStop>.from(path);
  var bestLen = _pathLengthScore(best, startLat, startLon);

  for (var pass = 0; pass < maxPasses; pass++) {
    var improved = false;
    for (var i = 0; i < n - 2; i++) {
      for (var k = i + 2; k < n; k++) {
        if (i == 0 && k == n - 1) continue;
        final candidate = [
          ...best.sublist(0, i + 1),
          ...best.sublist(i + 1, k + 1).reversed,
          ...best.sublist(k + 1),
        ];
        final len = _pathLengthScore(candidate, startLat, startLon);
        if (len + 1e-12 < bestLen) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/// Eng yaqin-qo'shni + 2-opt — agent boshlang'ich nuqtasidan optimal tashrif tartibi.
List<RouteMapStop> optimizeVisitRouteOrder(
  List<RouteMapStop> stops, {
  double? startLat,
  double? startLon,
}) {
  if (stops.length <= 1) return _reindexRouteStops(stops);

  var ordered = _nearestNeighborOrder(stops, startLat: startLat, startLon: startLon);
  // Katta ro‘yxatda 2-opt qimmat — faqat o‘rtacha hajmda.
  if (ordered.length >= 4 && ordered.length <= 80) {
    ordered = twoOptImproveRoute(
      ordered,
      startLat: startLat,
      startLon: startLon,
      maxPasses: ordered.length <= 40 ? 4 : 2,
    );
  }

  return _reindexRouteStops(ordered);
}

List<RouteMapStop> _reindexRouteStops(List<RouteMapStop> stops) {
  return [
    for (var i = 0; i < stops.length; i++)
      RouteMapStop(
        clientId: stops[i].clientId,
        name: stops[i].name,
        latitude: stops[i].latitude,
        longitude: stops[i].longitude,
        orderIndex: i + 1,
        visited: stops[i].visited,
      ),
  ];
}

/// Server marshruti bo‘lmasa xaritada chiziladigan nuqtalar.
const maxFallbackRoutePoints = 80;

/// WebView + Yandex JS bir vaqtda ko‘rsatadigan markerlar.
const maxMapDisplayStops = 280;

/// MultiRoute (yo‘l tarmog‘i) uchun max nuqta — ko‘p via sekin.
const maxRoadRoutePoints = 36;

List<RouteMapStop> capMapDisplayStops(List<RouteMapStop> stops, {int max = maxMapDisplayStops}) {
  if (stops.length <= max) return stops;
  return stops.take(max).toList(growable: false);
}

/// MultiRoute uchun birinchi/oxirgi saqlab, o‘rtani teng siyraklashtirish.
List<RouteMapStop> sampleRoutePointsForRouting(
  List<RouteMapStop> points, {
  int maxPoints = maxRoadRoutePoints,
}) {
  if (points.length <= maxPoints) return points;
  if (maxPoints < 2) return points.take(maxPoints).toList(growable: false);

  final out = <RouteMapStop>[points.first];
  final middleCount = maxPoints - 2;
  final lastIdx = points.length - 1;
  for (var i = 1; i <= middleCount; i++) {
    final idx = ((i * lastIdx) / (middleCount + 1)).round().clamp(1, lastIdx - 1);
    final p = points[idx];
    if (out.last.latitude != p.latitude || out.last.longitude != p.longitude) {
      out.add(p);
    }
  }
  final last = points.last;
  if (out.last.latitude != last.latitude || out.last.longitude != last.longitude) {
    out.add(last);
  }
  return out;
}

List<RouteMapStop> buildFallbackRouteLine(
  Iterable<Map<String, dynamic>> clients, {
  required bool Function(Map<String, dynamic> client) hasCoords,
  required Set<int> visitedIds,
  RouteMapStop? routeStart,
}) {
  final withCoords = clients.where(hasCoords).toList();
  final rawStops = [
    for (final c in withCoords)
      RouteMapStop.fromClient(
        c,
        visited: visitedIds.contains((c['id'] as num?)?.toInt()),
      ),
  ];
  final optimized = optimizeVisitRouteOrder(
    rawStops,
    startLat: routeStart?.latitude,
    startLon: routeStart?.longitude,
  );
  return optimized.take(maxFallbackRoutePoints).toList(growable: false);
}

/// Toshkent markazi — nuqtalar bo‘lmasa default kamera.
const defaultMapLat = 41.311081;
const defaultMapLon = 69.240562;
