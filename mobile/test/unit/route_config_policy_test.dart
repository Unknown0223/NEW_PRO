import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/route_config_policy.dart';
import 'package:salesdoc_mobile/core/map/route_map_stop.dart';

void main() {
  group('isClientInReaddCooldown', () {
    test('no cooldown when days is 0', () {
      expect(
        isClientInReaddCooldown(
          clientId: 1,
          readdCooldownDays: 0,
          lastActivityByClient: {1: DateTime(2026, 6, 1)},
        ),
        isFalse,
      );
    });

    test('within cooldown blocks client', () {
      expect(
        isClientInReaddCooldown(
          clientId: 1,
          readdCooldownDays: 7,
          lastActivityByClient: {1: DateTime(2026, 6, 8)},
          today: DateTime(2026, 6, 9),
        ),
        isTrue,
      );
    });

    test('after cooldown allows client', () {
      expect(
        isClientInReaddCooldown(
          clientId: 1,
          readdCooldownDays: 7,
          lastActivityByClient: {1: DateTime(2026, 6, 1)},
          today: DateTime(2026, 6, 9),
        ),
        isFalse,
      );
    });
  });

  group('applyRouteConfigToStops', () {
    final stops = [
      const RouteMapStop(clientId: 1, name: 'A', latitude: 1, longitude: 1),
      const RouteMapStop(clientId: 2, name: 'B', latitude: 2, longitude: 2),
      const RouteMapStop(clientId: 3, name: 'C', latitude: 3, longitude: 3),
    ];

    test('caps to daily_visit_limit', () {
      final out = applyRouteConfigToStops(
        stops,
        route: const RouteConfig(dailyVisitLimit: 2),
        lastActivityByClient: const {},
      );
      expect(out.length, 2);
      expect(out.first.clientId, 1);
    });

    test('filters cooldown clients', () {
      final out = applyRouteConfigToStops(
        stops,
        route: const RouteConfig(readdCooldownDays: 7),
        lastActivityByClient: {2: DateTime(2026, 6, 8)},
        today: DateTime(2026, 6, 9),
      );
      expect(out.map((s) => s.clientId).toList(), [1, 3]);
    });
  });
}
