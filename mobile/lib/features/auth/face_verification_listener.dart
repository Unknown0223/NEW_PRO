import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/face/face_daily_check_policy.dart';
import '../../core/face/face_gate_state.dart';
import '../../core/face/face_verification_flow.dart';
import 'auth_provider.dart';

/// Kunlik Face / tabel: router `readyEntryPath` ga tayangan — qo‘shimcha `go()` yo‘q
/// (aks holda /home → /attendance miltillaydi).
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
  bool _scheduledInitial = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _scheduledInitial) return;
      _scheduledInitial = true;
      _syncGateFlag();
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status != AuthStatus.ready) {
        _doneThisSession = false;
        return;
      }
      if (prev?.status == AuthStatus.ready) return;
      // Yangi ready: auth allaqachon `_resolveDailyFaceGate` qilgan.
      // Qayta so‘rov — faqat bayroq hali qo‘yilmagan bo‘lsa (ortiqcha refresh yo‘q).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncGateFlag();
      });
    });

    return widget.child;
  }

  Future<void> _syncGateFlag({bool force = false}) async {
    if (_running || (!force && _doneThisSession) || !mounted) return;
    if (ref.read(authStateProvider).status != AuthStatus.ready) return;

    final open = shouldAutoPromptDailyFace(
      force: force,
      doneThisSession: _doneThisSession,
      alreadyPrompted: ref.read(faceGateRequiredProvider),
    );
    // alreadyPrompted=true → requireGate allaqachon qo‘yilgan (auth resolve).
    if (!open && ref.read(faceGateRequiredProvider)) {
      _doneThisSession = true;
      return;
    }
    if (!open) return;

    _running = true;
    try {
      final needs = await FaceVerificationFlow.isDailyLoginBlocking(ref.read);
      if (!mounted) return;
      if (!needs) {
        _doneThisSession = true;
        ref.read(faceGateRequiredProvider.notifier).clearGate();
        return;
      }
      ref.read(faceGateRequiredProvider.notifier).requireGate();
      _doneThisSession = true;
    } catch (_) {
      // Keyingi ready da qayta.
    } finally {
      _running = false;
    }
  }
}
