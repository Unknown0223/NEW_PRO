import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/face/face_verification_flow.dart';
import 'auth_provider.dart';

/// Kunlik yuz tasdiqlash — ilova ochilgach (PIN/biometrikdan keyin).
class FaceVerificationListener extends ConsumerStatefulWidget {
  final Widget child;
  const FaceVerificationListener({super.key, required this.child});

  @override
  ConsumerState<FaceVerificationListener> createState() => _FaceVerificationListenerState();
}

class _FaceVerificationListenerState extends ConsumerState<FaceVerificationListener> {
  bool _running = false;
  bool _doneThisSession = false;

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status == AuthStatus.ready && prev?.status != AuthStatus.ready) {
        _doneThisSession = false;
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeDailyCheck());
      }
      if (next.status != AuthStatus.ready) {
        _doneThisSession = false;
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeDailyCheck());
    return widget.child;
  }

  Future<void> _maybeDailyCheck() async {
    if (_running || _doneThisSession || !mounted) return;
    if (ref.read(authStateProvider).status != AuthStatus.ready) return;
    _running = true;
    try {
      await Future<void>.delayed(const Duration(milliseconds: 400));
      if (!mounted) return;
      final ok = await FaceVerificationFlow.ensureDailyLogin(context, ref);
      if (ok) _doneThisSession = true;
    } finally {
      _running = false;
    }
  }
}
