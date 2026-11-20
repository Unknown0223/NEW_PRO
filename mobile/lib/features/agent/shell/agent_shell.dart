import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/mobile_config.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/clients/agent_client_balance.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/auth/session.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../home/sync_count_provider.dart';
import '../route/agent_route_provider.dart';
import 'agent_drawer.dart';
import 'agent_scaffold_key.dart';
import 'agent_van_selling_strip.dart';
import '../clients/client_map_holder.dart';
import '../sync/brand_sync_view.dart';
import '../sync/manual_sync_provider.dart';
import '../../../core/notifications/notifications_day_rollover.dart';
import '../orders/held_orders_provider.dart';
import '../orders/create_order_exit_guard.dart';
import 'agent_menu_config.dart';

/// Agent ilova qobig‘i: drawer + shablon pastki navigatsiya.
class AgentShell extends ConsumerStatefulWidget {
  final Widget child;
  const AgentShell({super.key, required this.child});

  @override
  ConsumerState<AgentShell> createState() => _AgentShellState();
}

class _AgentShellState extends ConsumerState<AgentShell> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(agentLocalPrefsProvider);
      ref.read(heldOrderSchedulerProvider);
      unawaited(ref.read(notificationsDayRolloverProvider).checkNow());
      preloadClientAgentLedgerBalances(ref);
      final gps = ref.read(sessionProvider).mobileConfig?.gps ?? const GpsConfig();
      if (gps.alwaysOn || gps.trackingEnabled) {
        ref.read(gpsTrackerProvider.notifier).startTracking();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(authStateProvider.notifier).refreshMobileConfig();
      ref.invalidate(syncCountTodayProvider);
      unawaited(ref.read(notificationsDayRolloverProvider).checkNow());
      try {
        unawaited(ref.read(gpsTrackerProvider.notifier).flushPendingLocationPings());
      } catch (_) {}
    }
  }

  int _tabIndex(String loc) {
    if (loc.startsWith('/visits')) return 1;
    if (loc.startsWith('/orders')) return 2;
    if (loc.startsWith('/kpi/route')) return 4;
    if (loc.startsWith('/kpi')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final hideNav = agentShellHidesBottomNav(loc);
    final sync = ref.watch(manualSyncProvider);
    final showBrandSync = sync.status == ManualSyncStatus.running ||
        sync.status == ManualSyncStatus.success;
    ref.watch(notificationsDayRolloverProvider);
    final vanSelling = ref.watch(sessionProvider).mobileConfig?.vanSelling;
    final showVanStrip = vanSelling != null;
    final routeAsync = ref.watch(realTodayRouteProvider);
    final session = ref.watch(sessionProvider);
    final routeName = (routeAsync.valueOrNull?['name'] ??
            routeAsync.valueOrNull?['title'] ??
            session.tenantName ??
            session.user?.name ??
            '')
        .toString();

    ref.listen(manualSyncProvider, (prev, next) {
      if (!mounted) return;
      if (prev?.status == next.status) return;
      // Success: BrandSync «Davom etish» — SyncSuccessDialog o‘rniga.
      if (next.status == ManualSyncStatus.error) {
        final msg = next.errorInfo?.summary ??
            next.result?.error ??
            'Не удалось обновить данные';
        showAgentToast(context, msg, accentColor: AppColors.error);
        ref.read(manualSyncProvider.notifier).reset();
      }
    });

    return Scaffold(
      key: agentShellScaffoldKey,
      backgroundColor: AppColors.background,
      drawer: const AgentDrawer(),
      body: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (showVanStrip) AgentVanSellingStrip(routeName: routeName),
              Expanded(child: ClientMapPreloadHost(child: widget.child)),
            ],
          ),
          if (showBrandSync)
            Positioned.fill(
              child: BrandSyncView(
                state: sync,
                role: session.user?.role,
                onContinue: () =>
                    ref.read(manualSyncProvider.notifier).reset(),
              ),
            ),
        ],
      ),
      bottomNavigationBar: hideNav || showBrandSync
          ? null
          : AgentBottomNav(
              selectedIndex: _tabIndex(loc),
              onTab: (i) {
                const paths = [
                  '/home',
                  '/visits',
                  '/orders',
                  '/kpi',
                  '/kpi/route',
                ];
                if (i < 0 || i >= paths.length) return;
                final path = paths[i];
                final router = GoRouter.of(context);
                final loc = GoRouterState.of(context).uri.path;
                final container = ProviderScope.containerOf(context);
                unawaited(leaveCreateOrderThenGo(
                  container: container,
                  go: router.go,
                  path: path,
                  currentLocation: loc,
                ),);
              },
            ),
    );
  }
}
