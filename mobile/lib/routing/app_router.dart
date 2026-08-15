import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/session.dart';
import '../core/theme/app_colors.dart';
import '../features/auth/auth_provider.dart';
import '../features/auth/pin_setup_screen.dart';
import '../features/auth/pin_unlock_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/bootstrap_screen.dart';
import '../features/agent/home/agent_home_page.dart';
import '../features/agent/clients/agent_clients_page.dart';
import '../features/agent/clients/new_client_page.dart';
import '../features/agent/clients/client_detail_screen.dart';
import '../features/agent/clients/client_location_map_page.dart';
import '../features/agent/clients/agent_debtors_by_orders_page.dart';
import '../features/agent/misc/agent_map_page.dart';
import '../features/agent/misc/agent_search_page.dart';
import '../features/agent/misc/agent_settings_page.dart';
import '../features/agent/orders/agent_orders_page.dart';
import '../features/agent/orders/agent_misc_orders_page.dart';
import '../features/agent/orders/create_order_screen.dart';
import '../features/agent/visits/agent_visits_page.dart';
import '../features/agent/visits/start_visit_screen.dart';
import '../features/agent/visits/visit_in_progress_screen.dart';
import '../features/agent/shell/agent_shell.dart';
import '../features/agent/sync/manual_sync_screen.dart';
import '../features/agent/sync/sync_success_screen.dart';
import '../features/agent/warehouse/agent_warehouse_stock_page.dart';
import '../features/agent/report/agent_report_page.dart';
import '../features/agent/clients/agent_debtors_page.dart';
import '../features/agent/misc/agent_draft_page.dart';
import '../features/agent/route/agent_route_page.dart';
import '../features/expeditor/home/expeditor_home_page.dart';
import '../features/expeditor/sync/expeditor_manual_sync_screen.dart';
import '../features/expeditor/debtors/expeditor_client_ledger_page.dart';
import '../features/expeditor/debtors/expeditor_client_orders_page.dart';
import '../features/expeditor/debtors/expeditor_debtor_client_page.dart';
import '../features/expeditor/deliveries/expeditor_deliveries_page.dart';
import '../features/expeditor/deliveries/expeditor_delivery_detail_page.dart';
import '../features/expeditor/payments/expeditor_payments_page.dart';
import '../features/expeditor/payments/expeditor_payments_info_page.dart';
import '../features/expeditor/returns/expeditor_returns_page.dart';
import '../features/expeditor/returns/expeditor_return_by_order_page.dart';
import '../features/expeditor/returns/expeditor_my_returns_page.dart';
import '../features/expeditor/settings/expeditor_settings_page.dart';
import '../features/expeditor/visits/expeditor_visits_page.dart';
import '../features/expeditor/visits/expeditor_client_detail_page.dart';
import '../features/expeditor/visits/expeditor_unfinished_page.dart';
import '../features/expeditor/visits/expeditor_client_map_page.dart';
import '../features/expeditor/visits/expeditor_visits_map_page.dart';
import '../features/expeditor/debtors/expeditor_debtors_page.dart';
import '../features/expeditor/invoices/expeditor_invoices_page.dart';
import '../features/expeditor/invoices/expeditor_invoice_detail_page.dart';
import '../features/expeditor/shell/expeditor_shell.dart';
import '../features/supervisor/home/supervisor_home_page.dart';
import '../features/supervisor/dashboard/supervisor_dashboard_page.dart';
import '../features/supervisor/visits/supervisor_visits_page.dart';
import '../features/supervisor/agents/supervisor_agents_page.dart';
import '../features/supervisor/shell/supervisor_shell.dart';
import '../features/shared/profile/profile_page.dart';
import 'role_guard.dart';

/// Dialoglar uchun (MaterialApp.builder kontekstida Navigator yo‘q).
final rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellKey = GlobalKey<NavigatorState>();

/// GoRouter faqat bir marta yaratiladi — session/sync yangilanganda qayta yaratilmasin.
class _AppRouterRefresh extends ChangeNotifier {
  _AppRouterRefresh(Ref ref) {
    ref.listen<AuthState>(authStateProvider, (_, __) => notifyListeners());
  }
}

/// Role-based home page builder
class _HomePage extends ConsumerWidget {
  const _HomePage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(sessionProvider).user?.role ?? 'agent';
    switch (role) {
      case 'expeditor':
        return const ExpeditorHomePage();
      case 'supervisor':
        return const SupervisorHomePage();
      default:
        return const AgentHomePage();
    }
  }
}

/// Role-based visits page
class _VisitsPage extends ConsumerWidget {
  const _VisitsPage();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(sessionProvider).user?.role ?? 'agent';
    if (role == 'expeditor') return const ExpeditorVisitsPage();
    return const AgentVisitsPage();
  }
}

/// Role-based debtors page
class _DebtorsPage extends ConsumerWidget {
  const _DebtorsPage();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(sessionProvider).user?.role ?? 'agent';
    if (role == 'expeditor') return const ExpeditorDebtorsPage();
    return const AgentDebtorsPage();
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _AppRouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    refreshListenable: refresh,
    initialLocation: '/login',
    redirect: (ctx, state) {
      final auth = ref.read(authStateProvider);
      final session = ref.read(sessionProvider);
      final s = auth.status;
      final loc = state.matchedLocation;
      final isLogin = loc == '/login';
      final isBoot = loc == '/bootstrap';

      if (s == AuthStatus.initial || s == AuthStatus.error) {
        // Bootstrap xatosi — foydalanuvchi «Qaytadan urinish» tugmasini ko‘ra olsin
        if (isBoot && auth.error != null) return null;
        return isLogin ? null : '/login';
      }

      if (s == AuthStatus.loading && loc == '/login') {
        return null;
      }

      if (s == AuthStatus.pinSetup) {
        return loc == '/pin-setup' ? null : '/pin-setup';
      }

      if (s == AuthStatus.locked) {
        return loc == '/unlock' ? null : '/unlock';
      }

      if (s == AuthStatus.loading) {
        if (session.bootstrapped) return null;
        return isBoot ? null : '/bootstrap';
      }

      if (s == AuthStatus.authenticated ||
          s == AuthStatus.bootstrapping ||
          s == AuthStatus.syncComplete) {
        return isBoot ? null : '/bootstrap';
      }

      if (s == AuthStatus.ready) {
        if (isLogin || isBoot) return '/home';

        final role = session.user?.role ?? 'agent';
        final blocked = roleRedirect(state, role);
        if (blocked != null) return blocked;

        return null;
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/pin-setup', builder: (_, __) => const PinSetupScreen()),
      GoRoute(path: '/unlock', builder: (_, __) => const PinUnlockScreen()),
      GoRoute(path: '/bootstrap', builder: (_, __) => const BootstrapScreen()),
      GoRoute(
        path: '/exp-manual-sync',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final full = state.uri.queryParameters['full'] == '1';
          return ExpeditorManualSyncScreen(full: full);
        },
      ),
      GoRoute(
        path: '/manual-sync',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final full = state.uri.queryParameters['full'] == '1';
          return ManualSyncScreen(full: full);
        },
      ),
      GoRoute(
        path: '/orders/special',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final mode = state.uri.queryParameters['mode'] ?? 'exchange';
          return AgentMiscOrdersPage(mode: mode);
        },
      ),
      GoRoute(
        path: '/orders/create',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final raw = state.uri.queryParameters['client_id'];
          final clientId = raw != null ? int.tryParse(raw) : null;
          Map<String, dynamic>? initialClient;
          final extra = state.extra;
          if (extra is Map) {
            initialClient = Map<String, dynamic>.from(extra);
          }
          final heldId = int.tryParse(state.uri.queryParameters['held_id'] ?? '');
          return CreateOrderScreen(
            initialClientId: clientId,
            initialClient: initialClient,
            heldOrderId: heldId,
          );
        },
      ),
      GoRoute(
        path: '/clients/new',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const NewClientPage(),
      ),
      GoRoute(
        path: '/visits/start',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const StartVisitScreen(),
      ),
      GoRoute(
        path: '/visits/active/:clientId',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['clientId'] ?? '');
          if (id == null) {
            return const Scaffold(body: Center(child: Text('Vizit topilmadi')));
          }
          return VisitInProgressScreen(clientId: id);
        },
      ),
      GoRoute(
        path: '/clients/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          if (id == null) {
            return const Scaffold(
                body: Center(child: Text('Mijoz ID noto\'g\'ri')),);
          }
          return ClientDetailScreen(clientId: id);
        },
      ),
      GoRoute(
        path: '/client-location',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final extra = state.extra;
          if (extra is! Map) {
            return const Scaffold(
                body: Center(child: Text('Координаты не указаны')),);
          }
          final name = extra['name']?.toString() ?? 'Клиент';
          final lat = (extra['lat'] as num?)?.toDouble();
          final lng = (extra['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) {
            return const Scaffold(
                body: Center(child: Text('Координаты не указаны')),);
          }
          return ClientLocationMapPage(
            clientName: name,
            latitude: lat,
            longitude: lng,
          );
        },
      ),
      GoRoute(
        path: '/route',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const AgentRoutePage(),
      ),
      GoRoute(
        path: '/map',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const AgentMapPage(),
      ),
      GoRoute(
        path: '/search',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const AgentSearchPage(),
      ),
      GoRoute(
        path: '/settings',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const AgentSettingsPage(),
      ),
      GoRoute(
        path: '/deliveries/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          if (id == null) {
            return const Scaffold(
                body: Center(child: Text('Buyurtma ID noto\'g\'ri')),);
          }
          return ExpeditorDeliveryDetailPage(orderId: id);
        },
      ),
      GoRoute(
        path: '/exp-client/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          if (id == null) {
            return const Scaffold(
                body: Center(child: Text('Mijoz ID noto\'g\'ri')),);
          }
          final extra = state.extra;
          return ExpeditorClientDetailPage(
            clientId: id,
            data: extra is Map ? Map<String, dynamic>.from(extra) : null,
          );
        },
      ),
      GoRoute(
        path: '/exp-debtor-client/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          if (id == null) {
            return const Scaffold(
                body: Center(child: Text('Mijoz ID noto\'g\'ri')),);
          }
          final extra = state.extra;
          return ExpeditorDebtorClientPage(
            clientId: id,
            seed: extra is Map ? Map<String, dynamic>.from(extra) : null,
          );
        },
      ),
      GoRoute(
        path: '/exp-client-orders/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          if (id == null) {
            return const Scaffold(
                body: Center(child: Text('Mijoz ID noto\'g\'ri')),);
          }
          return ExpeditorClientOrdersPage(clientId: id);
        },
      ),
      GoRoute(
        path: '/exp-client-ledger/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          if (id == null) {
            return const Scaffold(
                body: Center(child: Text('Mijoz ID noto\'g\'ri')),);
          }
          return ExpeditorClientLedgerPage(clientId: id);
        },
      ),
      GoRoute(
        path: '/exp-client-map',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final extra = state.extra;
          if (extra is! Map) {
            return const Scaffold(
                body: Center(child: Text('Координаты не указаны')),);
          }
          final name = extra['name']?.toString() ?? 'Клиент';
          final lat = (extra['lat'] as num?)?.toDouble();
          final lng = (extra['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) {
            return const Scaffold(
                body: Center(child: Text('Координаты не указаны')),);
          }
          return ExpeditorClientMapPage(
            clientName: name,
            latitude: lat,
            longitude: lng,
          );
        },
      ),
      GoRoute(
        path: '/exp-visits-map',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final extra = state.extra;
          final rows = extra is List
              ? extra
                  .whereType<Map>()
                  .map((e) => Map<String, dynamic>.from(e))
                  .toList()
              : <Map<String, dynamic>>[];
          return ExpeditorVisitsMapPage(rows: rows);
        },
      ),
      GoRoute(
        path: '/invoices/:docId',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final docId = state.pathParameters['docId'] ?? '';
          if (docId.isEmpty) {
            return const Scaffold(
                body: Center(child: Text('Накладная не найдена')),);
          }
          return ExpeditorInvoiceDetailPage(docId: docId);
        },
      ),
      GoRoute(
        path: '/exp-unfinished',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorUnfinishedPage(),
      ),
      GoRoute(
        path: '/exp-return-by-order',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorReturnByOrderPage(),
      ),
      GoRoute(
        path: '/exp-settings',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorSettingsPage(),
      ),
      GoRoute(
        path: '/exp-return-by-order/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (ctx, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '');
          return ExpeditorReturnByOrderPage(initialOrderId: id);
        },
      ),
      GoRoute(
        path: '/payments-info',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorPaymentsInfoPage(),
      ),
      GoRoute(
        path: '/payments',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorPaymentsPage(),
      ),
      GoRoute(
        path: '/returns',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorReturnsPage(),
      ),
      GoRoute(
        path: '/my-returns',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ExpeditorMyReturnsPage(),
      ),
      ShellRoute(
        navigatorKey: _shellKey,
        builder: (ctx, state, child) => _NavShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const _HomePage()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
          GoRoute(
            path: '/clients',
            builder: (_, state) {
              final create = state.uri.queryParameters['create'] == '1';
              return AgentClientsPage(openCreateOnLoad: create);
            },
          ),
          GoRoute(path: '/orders', builder: (_, __) => const AgentOrdersPage()),
          GoRoute(path: '/visits', builder: (_, __) => const _VisitsPage()),
          GoRoute(path: '/report', builder: (_, __) => const AgentReportPage()),
          GoRoute(
              path: '/warehouse-stock',
              builder: (_, __) => const AgentWarehouseStockPage(),),
          GoRoute(path: '/debtors', builder: (_, __) => const _DebtorsPage()),
          GoRoute(
              path: '/debtors-by-orders',
              builder: (_, __) => const AgentDebtorsByOrdersPage(),),
          GoRoute(path: '/draft', builder: (_, __) => const AgentDraftPage()),
          GoRoute(
              path: '/sync-success',
              builder: (_, __) => const SyncSuccessScreen(),),
          GoRoute(
              path: '/deliveries',
              builder: (_, __) => const ExpeditorDeliveriesPage(),),
          GoRoute(
              path: '/invoices',
              builder: (_, __) => const ExpeditorInvoicesPage(),),
          GoRoute(
              path: '/dashboard',
              builder: (_, __) => const SupervisorDashboardPage(),),
          GoRoute(
              path: '/sv-visits',
              builder: (_, __) => const SupervisorVisitsPage(),),
          GoRoute(
              path: '/agents',
              builder: (_, __) => const SupervisorAgentsPage(),),
        ],
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});

class _NavShell extends ConsumerWidget {
  final Widget child;
  const _NavShell({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(sessionProvider).user?.role ?? 'agent';
    final loc = GoRouterState.of(context).matchedLocation;

    List<_NavItem> items;
    Color color;

    Widget body = child;

    if (role == 'expeditor') {
      body = ExpeditorShell(child: child);
      color = AppColors.expeditorAccent;
      items = [
        const _NavItem(Icons.home_outlined, Icons.home, 'Главная', '/home'),
        const _NavItem(
            Icons.location_on_outlined, Icons.location_on, 'Визиты', '/visits',),
        const _NavItem(Icons.person_outline, Icons.person, 'Должники', '/debtors'),
        const _NavItem(Icons.receipt_long_outlined, Icons.receipt_long, 'Накладные',
            '/invoices',),
      ];
    } else if (role == 'supervisor') {
      body = SupervisorShell(child: child);
      color = AppColors.supervisorAccent;
      items = [
        const _NavItem(Icons.home_outlined, Icons.home, 'Bosh', '/home'),
        const _NavItem(Icons.dashboard_outlined, Icons.dashboard, 'Dashboard',
            '/dashboard',),
        const _NavItem(Icons.visibility_outlined, Icons.visibility, 'Vizitlar',
            '/sv-visits',),
        const _NavItem(Icons.people_outline, Icons.people, 'Agentlar', '/agents'),
        const _NavItem(Icons.settings_outlined, Icons.settings, 'Profil', '/profile'),
      ];
    } else {
      return AgentShell(child: child);
    }

    final idx = items.indexWhere((it) => it.path == loc);

    return Scaffold(
      body: body,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: idx >= 0 ? idx : 0,
        selectedItemColor: color,
        unselectedItemColor: const Color(0xFF64748B),
        type: BottomNavigationBarType.fixed,
        selectedFontSize: 11,
        unselectedFontSize: 11,
        onTap: (i) => context.go(items[i].path),
        items: items
            .map((it) => BottomNavigationBarItem(
                  icon: Icon(it.icon),
                  activeIcon: Icon(it.activeIcon),
                  label: it.label,
                ),)
            .toList(),
      ),
    );
  }
}

class _NavItem {
  final IconData icon, activeIcon;
  final String label, path;
  const _NavItem(this.icon, this.activeIcon, this.label, this.path);
}
