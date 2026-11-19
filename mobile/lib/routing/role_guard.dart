import 'package:go_router/go_router.dart';

/// Role-specific allowed routes
class _RoleRoutes {
  static const agent = {
    '/home',
    '/profile',
    '/clients',
    '/clients/new',
    '/orders',
    '/visits',
    '/visits/start',
    '/report',
    '/warehouse-stock',
    '/sync-success',
    '/manual-sync',
    '/debtors',
    '/debtors-by-orders',
    '/route',
    '/map',
    '/search',
    '/settings',
    '/draft',
    '/notifications',
    '/tabel',
    '/kpi',
    '/kpi/calc',
    '/orders/create',
    '/client-location',
  };
  static const expeditor = {
    '/home',
    '/profile',
    '/visits',
    '/debtors',
    '/invoices',
    '/deliveries',
    '/payments',
    '/returns',
    '/exp-return-by-order',
    '/exp-settings',
    '/exp-unfinished',
    '/payments-info',
    '/exp-client-map',
    '/exp-visits-map',
    '/exp-manual-sync',
    '/my-returns',
  };
  static const supervisor = {
    '/home',
    '/profile',
    '/dashboard',
    '/sv-visits',
    '/sv-report',
    '/sv-outlets',
    '/sv-menu',
    '/sv-gps',
    '/sv-kpi',
    '/sv-kpi/route',
    '/sv-settings',
    '/sv-clients',
    '/sv-notifications',
    '/agents',
  };
  static const cashier = {
    '/home',
    '/profile',
    '/bank-transfers',
  };

  static Set<String> forRole(String role) {
    switch (role) {
      case 'expeditor':
        return expeditor;
      case 'supervisor':
        return supervisor;
      case 'cashier':
      case 'operator':
        return cashier;
      default:
        return agent;
    }
  }

  static String? guard(String role, String location) {
    final allowed = forRole(role);
    if (location == '/home' || location == '/profile') return null;
    if (role == 'agent' && location.startsWith('/clients/')) return null;
    if (role == 'agent' && location.startsWith('/visits/')) return null;
    if (role == 'agent' && location.startsWith('/orders/')) return null;
    if (role == 'agent' && location.startsWith('/kpi')) return null;
    if (role == 'expeditor' && location.startsWith('/deliveries/')) return null;
    if (role == 'expeditor' && location.startsWith('/invoices/')) return null;
    if (role == 'expeditor' && location.startsWith('/exp-client/')) return null;
    if (role == 'expeditor' && location.startsWith('/exp-debtor-client/')) return null;
    if (role == 'expeditor' && location.startsWith('/exp-client-orders/')) return null;
    if (role == 'expeditor' && location.startsWith('/exp-client-ledger/')) return null;
    if (role == 'expeditor' && location.startsWith('/exp-return-by-order/')) return null;
    if (role == 'expeditor' && location.startsWith('/my-returns')) return null;
    if ((role == 'cashier' || role == 'operator') &&
        location.startsWith('/bank-transfers/')) {
      return null;
    }
    if (role == 'supervisor' && location.startsWith('/sv-clients/')) return null;
    if (role == 'supervisor' && location.startsWith('/sv-kpi')) return null;
    if (allowed.contains(location)) return null;
    return '/home';
  }
}

String? roleGuardLocation(String role, String location) {
  return _RoleRoutes.guard(role, location);
}

/// Redirect function for GoRouter — checks role access to routes
String? roleRedirect(GoRouterState state, String role) {
  return roleGuardLocation(role, state.matchedLocation);
}
