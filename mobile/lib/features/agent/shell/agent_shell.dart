import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/mobile_config.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/auth/session.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../home/sync_count_provider.dart';
import 'agent_drawer.dart';
import 'agent_menu_config.dart';
import 'agent_scaffold_key.dart';
import '../clients/client_map_holder.dart';
import '../sync/agent_sync_overlay.dart';
import '../sync/manual_sync_provider.dart';
import '../config/van_movement_status_bar.dart';

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
    if (loc.startsWith('/report')) return 2;
    if (loc.startsWith('/clients')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final hideNav = agentShellHidesBottomNav(loc);
    final sync = ref.watch(manualSyncProvider);
    final syncRunning = sync.status == ManualSyncStatus.running;
    final vanSelling = ref.watch(sessionProvider).mobileConfig?.vanSelling;
    final showVanBar = vanSelling?.allowChangeMovementStatus == true;

    ref.listen(manualSyncProvider, (prev, next) {
      if (!mounted) return;
      if (next.status == ManualSyncStatus.success) {
        showAgentToast(context, 'Данные обновлены', accentColor: AppColors.success);
        ref.read(manualSyncProvider.notifier).reset();
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
              if (showVanBar) const VanMovementStatusBar(),
              Expanded(child: ClientMapPreloadHost(child: widget.child)),
            ],
          ),
          if (syncRunning) const AgentSyncLoadingOverlay(),
        ],
      ),
      bottomNavigationBar: hideNav
          ? null
          : AgentBottomNav(
              selectedIndex: _tabIndex(loc),
              onMenuCenter: () => agentShellScaffoldKey.currentState?.openDrawer(),
              onTab: (i) {
                switch (i) {
                  case 0:
                    context.go('/home');
                  case 1:
                    context.go('/visits');
                  case 2:
                    context.go('/report');
                  case 3:
                    context.go('/clients');
                }
              },
            ),
    );
  }
}
