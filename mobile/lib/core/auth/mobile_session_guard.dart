import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_provider.dart';
import 'app_lock.dart';
import 'session.dart';

/// Web panel sessiyasi yopilganda mobilni tez logout qilish — /auth/me ping.
/// Barcha mobil rollar uchun resume da konfig yangilanishi.
class MobileSessionGuard extends ConsumerStatefulWidget {
  final Widget child;

  const MobileSessionGuard({super.key, required this.child});

  @override
  ConsumerState<MobileSessionGuard> createState() => _MobileSessionGuardState();
}

class _MobileSessionGuardState extends ConsumerState<MobileSessionGuard> with WidgetsBindingObserver {
  Timer? _pingTimer;
  Timer? _configTimer;
  DateTime? _lastConfigRefresh;
  AppLifecycleState? _lastLifecycle;
  /// `paused` dan keyin qaytilganda PIN (fon / ekran o‘chgan).
  bool _pendingLockOnResume = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) => _ping());
    _configTimer = Timer.periodic(const Duration(minutes: 15), (_) => _refreshConfigIfLoggedIn());
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    _configTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final prev = _lastLifecycle;
    _lastLifecycle = state;
    final suppressed = ref.read(appLockSuppressionProvider.notifier).isSuppressed;

    // Faqat haqiqiy fon (`paused`) — `hidden` qisqa va noto‘g‘ri ishga tushadi.
    if (!suppressed && state == AppLifecycleState.paused) {
      _pendingLockOnResume = true;
    }

    if (state == AppLifecycleState.resumed) {
      if (!suppressed && _pendingLockOnResume) {
        _pendingLockOnResume = false;
        ref.read(authStateProvider.notifier).lockAppOnResume();
      } else {
        _pendingLockOnResume = false;
      }
      if (prev == AppLifecycleState.paused || prev == AppLifecycleState.hidden) {
        _ping();
        _refreshConfigIfLoggedIn(force: true);
      }
    }
  }

  void _ping() {
    if (!mounted) return;
    if (ref.read(appLockSuppressionProvider.notifier).isSuppressed) return;
    ref.read(authStateProvider.notifier).validateActiveSession();
  }

  void _refreshConfigIfLoggedIn({bool force = false}) {
    if (!mounted) return;
    final auth = ref.read(authStateProvider);
    if (auth.status != AuthStatus.ready) return;
    final role = ref.read(sessionProvider).user?.role;
    if (role != 'agent' && role != 'expeditor' && role != 'supervisor') return;

    if (!force && _lastConfigRefresh != null) {
      final elapsed = DateTime.now().difference(_lastConfigRefresh!);
      if (elapsed.inMinutes < 14) return;
    }
    _lastConfigRefresh = DateTime.now();
    ref.read(authStateProvider.notifier).refreshMobileConfig();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
