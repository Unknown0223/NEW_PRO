import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/app_strings_ru.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import 'auth_provider.dart';
import 'pin_pad.dart';

/// Birinchi marta slug/login/paroldan keyin — mahalliy ilova parolini o‘rnatish.
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

  void _reset() {
    setState(() {
      _first = '';
      _confirm = '';
      _confirmStep = false;
    });
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
            _reset();
          }
        }
      }
    });
  }

  void _backspace() {
    if (_busy) return;
    setState(() {
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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        title: Text(
          S.pinSecurity,
          style: AppTypography.headlineMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textTitle,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textMuted),
          onPressed: _busy ? null : () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 26),
          child: Column(
            children: [
              const SizedBox(height: 38),
              Text(
                step == 1 ? S.pinCreate : S.pinConfirmTitle,
                style: AppTypography.headlineMedium.copyWith(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textTitle,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                S.pinSubtitle,
                style: AppTypography.bodyMedium.copyWith(
                  fontSize: 13.5,
                  color: AppColors.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 34),
              PinDots(
                filled: filled,
                pinLength: _pinLen,
                variant: PinDotsVariant.onboarding,
              ),
              if (_busy)
                const Padding(
                  padding: EdgeInsets.only(top: 24),
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              const Spacer(),
              PinPad(
                enabled: !_busy,
                variant: PinPadVariant.onboarding,
                onDigit: _onDigit,
                onBackspace: _backspace,
              ),
              const SizedBox(height: 28),
              AgentRoleBadge(label: S.pinStepLabel(step)),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
