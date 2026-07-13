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
import '../sync/manual_sync_provider.dart';
import '../sync/sync_progress_sheet.dart';
import '../sync/sync_success_dialog.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/time/work_region_time.dart';
import '../orders/held_orders_provider.dart';
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
    }
  }

  int _tabIndex(String loc) {
    if (loc.startsWith('/visits')) return 1;
    if (loc.startsWith('/report')) return 3;
    if (loc.startsWith('/clients')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final hideNav = agentShellHidesBottomNav(loc);
    final sync = ref.watch(manualSyncProvider);
    final syncRunning = sync.status == ManualSyncStatus.running;
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
      if (next.status == ManualSyncStatus.success) {
        final ts = next.finishedAt ?? DateTime.now();
        final subtitle =
            '${formatWorkRegionDateTime(ts.toUtc().toIso8601String())} · ${S.syncRecordsCount(next.recordCount)}';
        unawaited(SyncSuccessDialog.show(
          context,
          subtitle: subtitle,
          onContinue: () => ref.read(manualSyncProvider.notifier).reset(),
        ),);
      } else if (next.status == ManualSyncStatus.error) {
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
          if (syncRunning)
            ModalBarrier(
              color: Colors.black.withValues(alpha: 0.35),
              dismissible: false,
            ),
          if (syncRunning) SyncProgressSheet(state: sync),
        ],
      ),
      bottomNavigationBar: hideNav
          ? null
          : AgentBottomNav(
              selectedIndex: _tabIndex(loc),
              onTab: (i) {
                switch (i) {
                  case 0:
                    context.go('/home');
                  case 1:
                    context.go('/visits');
                  case 2:
                    context.go('/home');
                  case 3:
                    context.go('/report');
                  case 4:
                    context.go('/clients');
                }
              },
            ),
    );
  }
}
