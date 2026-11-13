import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../design_system/design_system.dart';

enum PinPadVariant { onboarding, unlock }

enum PinDotsVariant { onboarding, unlock }

/// Shablon Auth PIN keypad — SaPressable scale-90 (har tugmada SaEnter yo‘q).
class PinPad extends StatelessWidget {
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final VoidCallback? onBiometric;
  final bool enabled;
  final PinPadVariant variant;
  final bool showBiometricSlot;

  const PinPad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    this.onBiometric,
    this.enabled = true,
    this.variant = PinPadVariant.unlock,
    this.showBiometricSlot = false,
  });

  @override
  Widget build(BuildContext context) {
    final keys = <_PadKey>[
      for (var n = 1; n <= 9; n++) _PadKey.digit('$n'),
      if (showBiometricSlot) const _PadKey.bio() else const _PadKey.empty(),
      const _PadKey.digit('0'),
      const _PadKey.back(),
    ];

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 280),
        child: GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          childAspectRatio: 1.35,
          mainAxisSpacing: 10,
          crossAxisSpacing: 12,
          children: [
            for (final k in keys)
              _KeyCell(
                keyData: k,
                enabled: enabled,
                onDigit: onDigit,
                onBackspace: onBackspace,
                onBiometric: onBiometric,
              ),
          ],
        ),
      ),
    );
  }
}

class _PadKey {
  final String? digit;
  final bool isBack;
  final bool isBio;
  final bool isEmpty;

  const _PadKey.digit(this.digit)
      : isBack = false,
        isBio = false,
        isEmpty = false;

  const _PadKey.back()
      : digit = null,
        isBack = true,
        isBio = false,
        isEmpty = false;

  const _PadKey.bio()
      : digit = null,
        isBack = false,
        isBio = true,
        isEmpty = false;

  const _PadKey.empty()
      : digit = null,
        isBack = false,
        isBio = false,
        isEmpty = true;
}

class _KeyCell extends StatelessWidget {
  final _PadKey keyData;
  final bool enabled;
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final VoidCallback? onBiometric;

  const _KeyCell({
    required this.keyData,
    required this.enabled,
    required this.onDigit,
    required this.onBackspace,
    this.onBiometric,
  });

  @override
  Widget build(BuildContext context) {
    if (keyData.isEmpty) return const SizedBox.shrink();

    final isBio = keyData.isBio;
    final bg = isBio ? AppColors.primary.withValues(alpha: 0.13) : const Color(0xFFEEF1F5);

    return SaPressable(
      pressedScale: 0.9,
      borderRadius: BorderRadius.circular(12),
      onTap: !enabled && !isBio
          ? null
          : () {
              HapticFeedback.lightImpact();
              if (keyData.isBack) {
                onBackspace();
              } else if (isBio) {
                onBiometric?.call();
              } else if (keyData.digit != null) {
                onDigit(keyData.digit!);
              }
            },
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: keyData.isBack
            ? const Icon(Icons.backspace_outlined, size: 20, color: Color(0xFF677386))
            : isBio
                ? const Icon(Icons.fingerprint_rounded, size: 22, color: AppColors.primary)
                : Text(
                    keyData.digit!,
                    style: AppTypography.headlineMedium.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0E1420),
                    ),
                  ),
      ),
    );
  }
}

/// Shablon Auth PIN slots — kvadrat + pop-in nuqta.
class PinDots extends StatelessWidget {
  final int filled;
  final int pinLength;
  final PinDotsVariant variant;
  final bool error;

  const PinDots({
    super.key,
    required this.filled,
    this.pinLength = 4,
    this.variant = PinDotsVariant.unlock,
    this.error = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = error ? AppColors.error : AppColors.primary;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(pinLength, (i) {
        final on = i < filled;
        return AnimatedContainer(
          duration: SaDurations.press,
          curve: SaCurves.standard,
          width: 36,
          height: 36,
          margin: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFEEF1F5),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: error
                  ? AppColors.error
                  : on
                      ? accent
                      : Colors.transparent,
              width: 1.5,
            ),
          ),
          alignment: Alignment.center,
          child: on
              ? SaPopIn(
                  key: ValueKey<int>(filled * 10 + i),
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                )
              : null,
        );
      }),
    );
  }
}

/// Shablon: Touch ID tugmasi.
class PinBiometricButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  const PinBiometricButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SaPressable(
      pressedScale: 0.9,
      onTap: loading ? null : onPressed,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
            ),
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  )
                : const Icon(Icons.fingerprint_rounded, size: 26, color: AppColors.primary),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
