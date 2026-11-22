import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/face/face_daily_check_policy.dart';
import '../../core/face/face_gate_state.dart';
import '../../core/face/face_verification_flow.dart';
import '../../core/navigation/root_navigator_context.dart';
import 'auth_provider.dart';

/// Kunlik Face / tabel: qora overlay yo‘q — birinchi kirishda `/attendance?gate=1`.
class FaceVerificationListener extends ConsumerStatefulWidget {
  final Widget child;
  const FaceVerificationListener({super.key, required this.child});

  @override
  ConsumerState<FaceVerificationListener> createState() =>
      _FaceVerificationListenerState();
}

class _FaceVerificationListenerState
    extends ConsumerState<FaceVerificationListener> {
  bool _running = false;
  bool _doneThisSession = false;
  bool _navigated = false;
  bool _scheduledInitial = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _scheduledInitial) return;
      _scheduledInitial = true;
      _maybeOpenGate();
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status == AuthStatus.ready && prev?.status != AuthStatus.ready) {
        _doneThisSession = false;
        _navigated = false;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _maybeOpenGate();
        });
      }
      if (next.status != AuthStatus.ready) {
        _doneThisSession = false;
        _navigated = false;
      }
    });

    // Overlay yo‘q — faqat child.
    return widget.child;
  }

  Future<void> _maybeOpenGate({bool force = false}) async {
    if (_running || (!force && _doneThisSession) || !mounted) return;
    if (ref.read(authStateProvider).status != AuthStatus.ready) return;

    final open = shouldAutoPromptDailyFace(
      force: force,
      doneThisSession: _doneThisSession,
      alreadyPrompted: _navigated,
    );
    if (!open) return;

    _running = true;
    try {
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (!mounted) return;

      final needs = await FaceVerificationFlow.isDailyLoginBlocking(ref);
      if (!needs) {
        _doneThisSession = true;
        _navigated = false;
        ref.read(faceGateRequiredProvider.notifier).clearGate();
        return;
      }

      ref.read(faceGateRequiredProvider.notifier).requireGate();

      final navCtx = resolveRootNavigatorContext(context);
      if (navCtx == null || !navCtx.mounted) return;

      String path = '/home';
      try {
        path = GoRouterState.of(navCtx).uri.path;
      } catch (_) {}

      if (!shouldOpenAttendanceGate(
        needsDailyLogin: true,
        alreadyNavigated: _navigated,
        currentPath: path,
      )) {
        return;
      }

      _navigated = true;
      GoRouter.of(navCtx).go('/attendance?gate=1');
    } catch (_) {
      // Keyingi ready/force da qayta uriniladi.
      _navigated = false;
    } finally {
      _running = false;
    }
  }
}
