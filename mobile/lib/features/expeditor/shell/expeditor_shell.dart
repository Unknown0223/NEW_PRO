import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../agent/sync/brand_sync_view.dart';
import '../../auth/auth_provider.dart';
import '../expeditor_providers.dart';
import '../sync/expeditor_brand_sync_adapter.dart';
import '../sync/expeditor_sync_provider.dart';

/// Ekspeditor shell — GPS + BrandSync overlay (agent shell bilan bir xil UX).
class ExpeditorShell extends ConsumerStatefulWidget {
  final Widget child;
  const ExpeditorShell({super.key, required this.child});

  @override
  ConsumerState<ExpeditorShell> createState() => _ExpeditorShellState();
}

class _ExpeditorShellState extends ConsumerState<ExpeditorShell>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _startGpsIfNeeded());
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
      _startGpsIfNeeded();
      try {
        unawaited(
          ref.read(gpsTrackerProvider.notifier).flushPendingLocationPings(),
        );
      } catch (_) {}
    }
  }

  void _startGpsIfNeeded() {
    final gps = ref.read(sessionProvider).mobileConfig?.gps;
    if (gps?.trackingEnabled == true) {
      try {
        ref.read(gpsTrackerProvider.notifier).startTracking();
      } catch (_) {}
    }
  }

  void _finishBrandSync() {
    ref.read(expeditorSyncProvider.notifier).reset();
    ref.invalidate(expeditorDashboardProvider);
    ref.invalidate(expeditorVisitsProvider);
    ref.invalidate(expeditorDebtorsProvider);
    ref.invalidate(expeditorHomeStatsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final sync = ref.watch(expeditorSyncProvider);
    final showBrandSync = sync.status == ExpeditorSyncStatus.running ||
        sync.status == ExpeditorSyncStatus.success;

    ref.listen<ExpeditorSyncState>(expeditorSyncProvider, (prev, next) {
      if (!mounted) return;
      if (prev?.status == next.status) return;
      if (next.status == ExpeditorSyncStatus.error) {
        final msg = next.errorInfo?.summary ??
            next.result?.error ??
            'Не удалось обновить данные';
        showAgentToast(context, msg, accentColor: AppColors.error);
        ref.read(expeditorSyncProvider.notifier).reset();
      }
    });

    return Stack(
      children: [
        widget.child,
        if (showBrandSync)
          Positioned.fill(
            child: BrandSyncView(
              state: manualSyncStateFromExpeditor(sync),
              role: 'expeditor',
              onContinue: _finishBrandSync,
            ),
          ),
      ],
    );
  }
}
