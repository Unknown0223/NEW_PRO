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

/// Eng yaqin-qo'shni (nearest neighbor) — agent boshlang'ich nuqtasidan optimal tashrif tartibi.
List<RouteMapStop> optimizeVisitRouteOrder(
  List<RouteMapStop> stops, {
  double? startLat,
  double? startLon,
}) {
  if (stops.length <= 1) return _reindexRouteStops(stops);

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
    var bestDist = double.infinity;
    for (var i = 0; i < remaining.length; i++) {
      final s = remaining[i];
      final d = routeMapDistanceKm(curLat!, curLon!, s.latitude, s.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    final next = remaining.removeAt(bestIdx);
    ordered.add(next);
    curLat = next.latitude;
    curLon = next.longitude;
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

/// Server marshruti bo‘lmasa xaritada chiziladigan nuqtalar (Yandex MultiRoute limiti).
const maxFallbackRoutePoints = 120;

/// WebView + Yandex JS bir vaqtda ko‘rsatadigan markerlar (1281+ hang qiladi).
const maxMapDisplayStops = 400;

List<RouteMapStop> capMapDisplayStops(List<RouteMapStop> stops, {int max = maxMapDisplayStops}) {
  if (stops.length <= max) return stops;
  return stops.take(max).toList(growable: false);
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
