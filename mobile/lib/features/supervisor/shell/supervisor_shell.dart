import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/auth_provider.dart';
import '../shared/supervisor_ui.dart';

/// Supervayzer shell — config + pastki nav (QR yo‘q).
class SupervisorShell extends ConsumerStatefulWidget {
  final Widget child;
  const SupervisorShell({super.key, required this.child});

  @override
  ConsumerState<SupervisorShell> createState() => _SupervisorShellState();
}

class _SupervisorShellState extends ConsumerState<SupervisorShell> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authStateProvider.notifier).refreshMobileConfig();
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
    }
  }

  int _tabIndex(String loc) {
    if (loc.startsWith('/sv-visits')) return 1;
    if (loc.startsWith('/sv-report') || loc.startsWith('/dashboard')) return 2;
    if (loc.startsWith('/sv-outlets')) return 3;
    return 0;
  }

  bool _hideNav(String loc) {
    return loc == '/sv-menu' ||
        loc == '/sv-gps' ||
        loc == '/profile' ||
        loc == '/sv-settings' ||
        loc.startsWith('/agents') ||
        loc.startsWith('/sv-kpi');
  }

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final hide = _hideNav(loc);

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: hide
          ? null
          : SupervisorBottomNav(
              selectedIndex: _tabIndex(loc),
              onTab: (i) {
                switch (i) {
                  case 0:
                    context.go('/home');
                  case 1:
                    context.go('/sv-visits');
                  case 2:
                    context.go('/sv-report');
                  case 3:
                    context.go('/sv-outlets');
                }
              },
            ),
    );
  }
}
