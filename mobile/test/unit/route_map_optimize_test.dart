import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/map/route_map_stop.dart';
import 'package:salesdoc_mobile/core/map/yandex_web_map_html.dart';

RouteMapStop s(int id, double lat, double lon, {bool visited = false}) =>
    RouteMapStop(
      clientId: id,
      name: 'C$id',
      latitude: lat,
      longitude: lon,
      visited: visited,
    );

void main() {
  group('optimizeVisitRouteOrder', () {
    test('empty / single', () {
      expect(optimizeVisitRouteOrder(const []), isEmpty);
      final one = optimizeVisitRouteOrder([s(1, 41.3, 69.2)]);
      expect(one.single.orderIndex, 1);
    });

    test('orders nearest from start and reindexes', () {
      final ordered = optimizeVisitRouteOrder(
        [
          s(1, 41.40, 69.20),
          s(2, 41.31, 69.21),
          s(3, 41.32, 69.22),
        ],
        startLat: 41.30,
        startLon: 69.20,
      );
      expect(ordered.map((e) => e.clientId).toList(), [2, 3, 1]);
      expect(ordered.map((e) => e.orderIndex).toList(), [1, 2, 3]);
    });

    test('prefers unvisited when nearby', () {
      // Masofa teng; visited jarimasi tufayli unvisited birinchi.
      final ordered = optimizeVisitRouteOrder(
        [
          s(1, 41.301, 69.200, visited: true),
          s(2, 41.301, 69.2001, visited: false),
        ],
        startLat: 41.300,
        startLon: 69.200,
      );
      expect(ordered.first.clientId, 2);
    });

    test('2-opt shortens crossed path for small sets', () {
      // Crossed square corners: NN may cross; 2-opt should untangle.
      final stops = [
        s(1, 0, 0),
        s(2, 1, 1),
        s(3, 0, 1),
        s(4, 1, 0),
      ];
      final ordered = optimizeVisitRouteOrder(stops, startLat: -0.1, startLon: -0.1);
      expect(ordered.length, 4);
      // Path should not revisit; all ids present.
      expect(ordered.map((e) => e.clientId).toSet(), {1, 2, 3, 4});
    });
  });

  group('twoOptImproveRoute', () {
    test('leaves short paths unchanged', () {
      final path = [s(1, 0, 0), s(2, 1, 0), s(3, 2, 0)];
      final out = twoOptImproveRoute(path, startLat: -1, startLon: 0);
      expect(out.map((e) => e.clientId), [1, 2, 3]);
    });
  });

  group('sampleRoutePointsForRouting', () {
    test('keeps all when under cap', () {
      final pts = [s(1, 0, 0), s(2, 1, 0), s(3, 2, 0)];
      expect(sampleRoutePointsForRouting(pts, maxPoints: 10), pts);
    });

    test('keeps first and last when sampling', () {
      final pts = [for (var i = 0; i < 20; i++) s(i, i.toDouble(), 0)];
      final sampled = sampleRoutePointsForRouting(pts, maxPoints: 6);
      expect(sampled.length, lessThanOrEqualTo(6));
      expect(sampled.first.clientId, 0);
      expect(sampled.last.clientId, 19);
    });
  });

  group('capMapDisplayStops', () {
    test('caps to max', () {
      final pts = [for (var i = 0; i < 50; i++) s(i, 41, 69)];
      expect(capMapDisplayStops(pts, max: 10).length, 10);
    });
  });

  group('computeYandexMapRuntimeData', () {
    test('samples long route for MultiRoute', () {
      final line = [for (var i = 0; i < 60; i++) s(i, 41 + i * 0.001, 69)];
      final data = computeYandexMapRuntimeData(
        stops: line,
        routeLine: line,
        routeStart: const RouteMapStop(name: 'A', latitude: 41, longitude: 69),
        drawRoutePolyline: true,
      );
      expect(data.drawLine, isTrue);
      expect(data.needRouter, isTrue);
      expect(data.maxRoutePoints, lessThanOrEqualTo(maxRoadRoutePoints + 1));
      expect(data.markerBatch, lessThanOrEqualTo(48));
    });

    test('needRouter false without polyline', () {
      final data = computeYandexMapRuntimeData(
        stops: [s(1, 41.3, 69.2)],
        drawRoutePolyline: false,
      );
      expect(data.needRouter, isFalse);
    });
  });

  group('routeMapDistanceScore', () {
    test('closer points score lower', () {
      final near = routeMapDistanceScore(41.3, 69.2, 41.301, 69.201);
      final far = routeMapDistanceScore(41.3, 69.2, 42.0, 70.0);
      expect(near, lessThan(far));
    });
  });
}
