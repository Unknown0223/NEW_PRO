import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/face/face_verification_flow.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'auth_provider.dart';

/// Kunlik yuz tasdiqlash — tasdiqlanmaguncha UI bloklanadi.
class FaceVerificationListener extends ConsumerStatefulWidget {
  final Widget child;
  const FaceVerificationListener({super.key, required this.child});

  @override
  ConsumerState<FaceVerificationListener> createState() => _FaceVerificationListenerState();
}

class _FaceVerificationListenerState extends ConsumerState<FaceVerificationListener> {
  bool _running = false;
  bool _doneThisSession = false;
  bool _blocking = false;
  String? _lastError;

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status == AuthStatus.ready && prev?.status != AuthStatus.ready) {
        _doneThisSession = false;
        _blocking = false;
        _lastError = null;
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeDailyCheck());
      }
      if (next.status != AuthStatus.ready) {
        _doneThisSession = false;
        _blocking = false;
        _lastError = null;
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeDailyCheck());

    return Stack(
      fit: StackFit.expand,
      children: [
        IgnorePointer(ignoring: _blocking, child: widget.child),
        if (_blocking)
          Material(
            color: Colors.black.withValues(alpha: 0.72),
            child: SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 360),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.face_retouching_natural, size: 48, color: Colors.white),
                        const SizedBox(height: 16),
                        Text(
                          'Требуется подтверждение лица',
                          textAlign: TextAlign.center,
                          style: AppTypography.headlineSmall.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Без серверной проверки лица работа с приложением недоступна.',
                          textAlign: TextAlign.center,
                          style: AppTypography.bodyMedium.copyWith(color: Colors.white70),
                        ),
                        if (_lastError != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _lastError!,
                            textAlign: TextAlign.center,
                            style: AppTypography.caption.copyWith(color: AppColors.error),
                          ),
                        ],
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _running ? null : () => _maybeDailyCheck(force: true),
                          child: Text(_running ? 'Проверка…' : 'Подтвердить лицо'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _maybeDailyCheck({bool force = false}) async {
    if (_running || (!force && _doneThisSession) || !mounted) return;
    if (ref.read(authStateProvider).status != AuthStatus.ready) return;

    _running = true;
    if (mounted) setState(() => _lastError = null);
    try {
      await Future<void>.delayed(const Duration(milliseconds: 400));
      if (!mounted) return;

      final needsBlock = await FaceVerificationFlow.isDailyLoginBlocking(ref);
      if (!needsBlock) {
        if (mounted) {
          setState(() {
            _doneThisSession = true;
            _blocking = false;
          });
        }
        return;
      }

      if (mounted) setState(() => _blocking = true);
      final ok = await FaceVerificationFlow.ensureDailyLogin(context, ref);
      if (!mounted) return;
      if (ok) {
        setState(() {
          _doneThisSession = true;
          _blocking = false;
          _lastError = null;
        });
      } else {
        setState(() {
          _blocking = true;
          _lastError = 'Проверка не завершена — повторите';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _blocking = true;
          _lastError = '$e';
        });
      }
    } finally {
      _running = false;
      if (mounted) setState(() {});
    }
  }
}
