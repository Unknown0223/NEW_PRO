import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/auth_provider.dart';
import '../../../core/auth/session.dart';
import '../../../core/gps/gps_tracker.dart';

/// Ekspeditor shell — GPS tracking va config yangilanishi (agent drawer/nav yo'q).
class ExpeditorShell extends ConsumerStatefulWidget {
  final Widget child;
  const ExpeditorShell({super.key, required this.child});

  @override
  ConsumerState<ExpeditorShell> createState() => _ExpeditorShellState();
}

class _ExpeditorShellState extends ConsumerState<ExpeditorShell> with WidgetsBindingObserver {
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
    } else if (state == AppLifecycleState.paused) {
      try {
        ref.read(gpsTrackerProvider.notifier).stopTracking();
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

  @override
  Widget build(BuildContext context) => widget.child;
}
