import 'package:flutter_test/flutter_test.dart';

// Mirror of role_guard logic for unit testing without importing private class.
String? roleGuard(String role, String location) {
  const agentRoutes = {
    '/home', '/profile', '/clients', '/clients/new', '/orders', '/visits',
    '/report', '/warehouse-stock', '/sync-success', '/manual-sync', '/debtors',
    '/debtors-by-orders', '/route', '/map', '/search', '/settings',
    '/draft', '/orders/create', '/client-location',
  };
  const expeditorRoutes = {
    '/home', '/profile', '/visits', '/debtors', '/invoices',
    '/deliveries', '/payments', '/returns', '/exp-return-by-order',
    '/exp-unfinished', '/payments-info', '/exp-client-map', '/exp-visits-map',
  };

  Set<String> allowed;
  switch (role) {
    case 'expeditor':
      allowed = expeditorRoutes;
      break;
    default:
      allowed = agentRoutes;
  }

  if (location == '/home' || location == '/profile') return null;
  if (role == 'agent' && location.startsWith('/clients/')) return null;
  if (role == 'expeditor' && location.startsWith('/deliveries/')) return null;
  if (role == 'expeditor' && location.startsWith('/invoices/')) return null;
  if (role == 'expeditor' && location.startsWith('/exp-client/')) return null;
  if (role == 'expeditor' && location.startsWith('/exp-debtor-client/')) return null;
  if (role == 'expeditor' && location.startsWith('/exp-return-by-order/')) return null;
  if (allowed.contains(location)) return null;
  return '/home';
}

void main() {
  group('role_guard expeditor isolation', () {
    test('expeditor cannot access agent clients', () {
      expect(roleGuard('expeditor', '/clients'), '/home');
      expect(roleGuard('expeditor', '/clients/42'), '/home');
    });

    test('expeditor can access visits and invoices', () {
      expect(roleGuard('expeditor', '/visits'), isNull);
      expect(roleGuard('expeditor', '/invoices'), isNull);
      expect(roleGuard('expeditor', '/invoices/pd_1_20260614'), isNull);
    });

    test('expeditor can access delivery detail', () {
      expect(roleGuard('expeditor', '/deliveries/99'), isNull);
    });

    test('expeditor can access debtor client detail', () {
      expect(roleGuard('expeditor', '/exp-debtor-client/123'), isNull);
      expect(roleGuard('expeditor', '/exp-client/123'), isNull);
    });

    test('agent can access client detail', () {
      expect(roleGuard('agent', '/clients/42'), isNull);
    });

    test('agent cannot access expeditor deliveries', () {
      expect(roleGuard('agent', '/deliveries'), '/home');
    });
  });
}
