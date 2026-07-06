import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/map/route_map_stop.dart';
import 'package:salesdoc_mobile/core/map/yandex_web_map_html.dart';

void main() {
  group('computeYandexMapRuntimeData', () {
    test('needRouter false without route polyline', () {
      final data = computeYandexMapRuntimeData(
        stops: const [
          RouteMapStop(clientId: 1, name: 'A', latitude: 41.3, longitude: 69.2, orderIndex: 1),
        ],
        drawRoutePolyline: false,
      );
      expect(data.needRouter, isFalse);
      expect(data.drawLine, isFalse);
    });

    test('needRouter true with multi-point route', () {
      final data = computeYandexMapRuntimeData(
        stops: const [
          RouteMapStop(clientId: 1, name: 'A', latitude: 41.3, longitude: 69.2, orderIndex: 1),
          RouteMapStop(clientId: 2, name: 'B', latitude: 41.31, longitude: 69.21, orderIndex: 2),
        ],
        routeLine: const [
          RouteMapStop(clientId: 1, name: 'A', latitude: 41.3, longitude: 69.2, orderIndex: 1),
          RouteMapStop(clientId: 2, name: 'B', latitude: 41.31, longitude: 69.21, orderIndex: 2),
        ],
        drawRoutePolyline: true,
      );
      expect(data.needRouter, isTrue);
      expect(data.drawLine, isTrue);
    });
  });
}
