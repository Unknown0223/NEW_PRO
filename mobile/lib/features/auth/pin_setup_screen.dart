import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/app_strings_ru.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import '../../design_system/design_system.dart';
import 'auth_provider.dart';
import 'pin_pad.dart';

/// PIN o‘rnatish — barqaror layout (LayoutBuilder/IntrinsicHeight yo‘q).
class PinSetupScreen extends ConsumerStatefulWidget {
  const PinSetupScreen({super.key});

  @override
  ConsumerState<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends ConsumerState<PinSetupScreen> {
  static const _pinLen = 4;
  String _first = '';
  String _confirm = '';
  bool _confirmStep = false;
  bool _busy = false;
  bool _mismatch = false;
  bool _shakePin = false;

  void _reset({bool mismatch = false}) {
    setState(() {
      _first = '';
      _confirm = '';
      _confirmStep = false;
      _mismatch = mismatch;
    });
    if (mismatch) {
      setState(() => _shakePin = true);
      Future<void>.delayed(const Duration(milliseconds: 520), () {
        if (mounted) {
          setState(() {
            _mismatch = false;
            _shakePin = false;
          });
        }
      });
    }
  }

  Future<void> _finishSetup() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(authStateProvider.notifier).completePinSetup(_first);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onDigit(String d) {
    if (_busy) return;
    setState(() {
      _mismatch = false;
      if (!_confirmStep) {
        if (_first.length >= _pinLen) return;
        _first += d;
        if (_first.length == _pinLen) _confirmStep = true;
      } else {
        if (_confirm.length >= _pinLen) return;
        _confirm += d;
        if (_confirm.length == _pinLen) {
          if (_confirm == _first) {
            _finishSetup();
          } else {
            showAgentToast(context, 'PIN не совпадает. Повторите.', accentColor: AppColors.error);
            _reset(mismatch: true);
          }
        }
      }
    });
  }

  void _backspace() {
    if (_busy) return;
    setState(() {
      _mismatch = false;
      if (_confirmStep) {
        if (_confirm.isNotEmpty) {
          _confirm = _confirm.substring(0, _confirm.length - 1);
        } else {
          _confirmStep = false;
          if (_first.isNotEmpty) _first = _first.substring(0, _first.length - 1);
        }
      } else if (_first.isNotEmpty) {
        _first = _first.substring(0, _first.length - 1);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final filled = _confirmStep ? _confirm.length : _first.length;
    final step = _confirmStep ? 2 : 1;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const IgnorePointer(
            child: SaBrandWave(topFraction: 0.88, animate: true),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 26),
              child: Column(
                children: [
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      IconButton(
                        onPressed: _busy
                            ? null
                            : () {
                                if (context.canPop()) {
                                  context.pop();
                                } else {
                                  context.go('/login');
                                }
                              },
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFFEEF1F5),
                          foregroundColor: const Color(0xFF0E1420),
                        ),
                        icon: const Icon(Icons.arrow_back_rounded, size: 20),
                      ),
                      const SizedBox(width: 8),
                      const SaBrandMark(size: 28, draw: false),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SaBrandWordmark(size: 14),
                            Text(
                              S.pinSecurity.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 8,
                                letterSpacing: 1.4,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF7A8697),
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  Text(
                    step == 1 ? S.pinCreate : S.pinConfirmTitle,
                    style: AppTypography.headlineMedium.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0E1420),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    S.pinSubtitle,
                    style: AppTypography.bodyMedium.copyWith(
                      fontSize: 13.5,
                      color: const Color(0xFF677386),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  SaAuthShake(
                    shake: _shakePin,
                    child: PinDots(
                      filled: filled,
                      pinLength: _pinLen,
                      variant: PinDotsVariant.onboarding,
                      error: _mismatch,
                    ),
                  ),
                  if (_busy)
                    const Padding(
                      padding: EdgeInsets.only(top: 16),
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  const Spacer(),
                  PinPad(
                    enabled: !_busy,
                    variant: PinPadVariant.onboarding,
                    onDigit: _onDigit,
                    onBackspace: _backspace,
                  ),
                  const SizedBox(height: 16),
                  AgentRoleBadge(label: S.pinStepLabel(step)),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
