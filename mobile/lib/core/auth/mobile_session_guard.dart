import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_provider.dart';
import '../errors/error_reporter.dart';
import 'app_lock.dart';
import 'session.dart';

/// Nima uchun serverga so‘raymiz: admin webdan «Завершить сессии» bossagina
/// ilova bilsin. Hodim o‘zi chiqmasa va admin yopmasa — sessiya ochiq qoladi.
/// Ping chiqarish uchun emas, faqat webda sessiya yopilganini aniqlash uchun.
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
  /// Kamera `paused` suppressed holatda — `end()` resume’dan oldin bo‘lsa ham qulf yo‘q.
  bool _skipLockAfterSuppressedPause = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pingTimer = Timer.periodic(const Duration(minutes: 2), (_) => _ping());
    // Web sozlamalari (vaqt, sync oynasi, mobile_config) — 2 daqiqada bir.
    _configTimer = Timer.periodic(const Duration(minutes: 2), (_) => _refreshConfigIfLoggedIn());
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
    final suppression = ref.read(appLockSuppressionProvider.notifier);
    final suppressed = suppression.isSuppressed;

    // Faqat haqiqiy fon (`paused`) — `hidden` qisqa va noto‘g‘ri ishga tushadi.
    if (state == AppLifecycleState.paused) {
      if (suppressed) {
        _skipLockAfterSuppressedPause = true;
        _pendingLockOnResume = false;
      } else if (!_skipLockAfterSuppressedPause) {
        _pendingLockOnResume = true;
      }
    }

    if (state == AppLifecycleState.resumed) {
      final skipLock = suppressed ||
          _skipLockAfterSuppressedPause ||
          suppression.skipNextResumeLock;
      _skipLockAfterSuppressedPause = false;
      suppression.skipNextResumeLock = false;

      if (!skipLock && _pendingLockOnResume) {
        _pendingLockOnResume = false;
        ref.read(authStateProvider.notifier).lockAppOnResume();
      } else {
        _pendingLockOnResume = false;
      }
      if (prev == AppLifecycleState.paused || prev == AppLifecycleState.hidden) {
        _ping();
        _refreshConfigIfLoggedIn(force: true);
        // Navbatdagi xatolarni jurnalga yuborish (offline → online).
        unawaited(ErrorReporter.instance?.flush() ?? Future<void>.value());
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
      if (elapsed.inSeconds < 90) return;
    }
    _lastConfigRefresh = DateTime.now();
    ref.read(authStateProvider.notifier).refreshMobileConfig();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
