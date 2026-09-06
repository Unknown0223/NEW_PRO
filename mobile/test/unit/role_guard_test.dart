import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/routing/role_guard.dart';
import 'package:salesdoc_mobile/features/agent/shell/agent_menu_config.dart';
import 'package:salesdoc_mobile/features/expeditor/shell/expeditor_drawer.dart';

void main() {
  group('role_guard expeditor isolation', () {
    test('expeditor cannot access agent clients', () {
      expect(roleGuardLocation('expeditor', '/clients'), '/home');
      expect(roleGuardLocation('expeditor', '/clients/42'), '/home');
    });

    test('expeditor can access visits and invoices', () {
      expect(roleGuardLocation('expeditor', '/visits'), isNull);
      expect(roleGuardLocation('expeditor', '/invoices'), isNull);
      expect(roleGuardLocation('expeditor', '/invoices/pd_1_20260614'), isNull);
    });

    test('expeditor can access delivery detail', () {
      expect(roleGuardLocation('expeditor', '/deliveries/99'), isNull);
    });

    test('expeditor can access debtor client detail', () {
      expect(roleGuardLocation('expeditor', '/exp-debtor-client/123'), isNull);
      expect(roleGuardLocation('expeditor', '/exp-client/123'), isNull);
    });

    test('agent can access client detail', () {
      expect(roleGuardLocation('agent', '/clients/42'), isNull);
    });

    test('agent cannot access expeditor deliveries', () {
      expect(roleGuardLocation('agent', '/deliveries'), '/home');
    });

    test('agent can access notifications', () {
      expect(roleGuardLocation('agent', '/notifications'), isNull);
    });

    test('agent can access kpi', () {
      expect(roleGuardLocation('agent', '/kpi'), isNull);
      expect(roleGuardLocation('agent', '/kpi/calc'), isNull);
      expect(roleGuardLocation('agent', '/kpi/route'), isNull);
    });

    test('every expeditor menu route passes the role guard', () {
      for (final path in expeditorMenuRoutes) {
        expect(
          roleGuardLocation('expeditor', path),
          isNull,
          reason: '$path must be allowed for expeditor',
        );
      }
    });
  });

  group('agent menu destinations are allowed', () {
    test('every drawer route passes the agent role guard', () {
      for (final item in agentMenuItems(null)) {
        if (item.soon || item.route.isEmpty) continue;
        final path = item.route.split('?').first;
        expect(
          roleGuardLocation('agent', path),
          isNull,
          reason: 'menu "${item.label}" → $path must be allowed',
        );
      }
    });

    test('every catalog page passes the agent role guard', () {
      for (final path in agentNavigationPages) {
        expect(
          roleGuardLocation('agent', path),
          isNull,
          reason: '$path must be allowed for agent',
        );
      }
    });

    test('shell tabs are in the navigation catalog', () {
      for (final path in agentShellTabPaths) {
        expect(agentNavigationPages, contains(path));
      }
    });
  });
}
