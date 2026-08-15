import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

enum PinPadVariant { onboarding, unlock }

enum PinDotsVariant { onboarding, unlock }

/// Bank uslubidagi raqamli klaviatura (4 xonali PIN).
class PinPad extends StatelessWidget {
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final bool enabled;
  final PinPadVariant variant;

  const PinPad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    this.enabled = true,
    this.variant = PinPadVariant.unlock,
  });

  @override
  Widget build(BuildContext context) {
    if (variant == PinPadVariant.onboarding) {
      return _RoundedKeypad(
        enabled: enabled,
        onDigit: onDigit,
        onBackspace: onBackspace,
        borderRadius: 18,
        fontSize: 24,
        borderColor: const Color(0xFFE8EEF3),
        withShadow: true,
      );
    }

    return _RoundedKeypad(
      enabled: enabled,
      onDigit: onDigit,
      onBackspace: onBackspace,
      borderRadius: 16,
      fontSize: 22,
      borderColor: const Color(0xFFE5EEF3),
      withShadow: false,
    );
  }
}

class _RoundedKeypad extends StatelessWidget {
  final bool enabled;
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final double borderRadius;
  final double fontSize;
  final Color borderColor;
  final bool withShadow;

  const _RoundedKeypad({
    required this.enabled,
    required this.onDigit,
    required this.onBackspace,
    required this.borderRadius,
    required this.fontSize,
    required this.borderColor,
    required this.withShadow,
  });

  @override
  Widget build(BuildContext context) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 290),
        child: GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          childAspectRatio: variantAspectRatio(borderRadius),
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          children: keys.map((k) {
            if (k.isEmpty) return const SizedBox.shrink();
            final isBack = k == '⌫';
            return Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(borderRadius),
              child: InkWell(
                onTap: !enabled
                    ? null
                    : () {
                        HapticFeedback.lightImpact();
                        if (isBack) {
                          onBackspace();
                        } else {
                          onDigit(k);
                        }
                      },
                borderRadius: BorderRadius.circular(borderRadius),
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(borderRadius),
                    border: Border.all(color: borderColor),
                    boxShadow: withShadow
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: isBack
                      ? Icon(Icons.backspace_outlined, size: fontSize, color: AppColors.textTitle)
                      : Text(
                          k,
                          style: AppTypography.headlineMedium.copyWith(
                            fontSize: fontSize,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textTitle,
                          ),
                        ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  double variantAspectRatio(double radius) => radius >= 18 ? 1.15 : 1.0;
}

class PinDots extends StatelessWidget {
  final int filled;
  final int pinLength;
  final PinDotsVariant variant;

  const PinDots({
    super.key,
    required this.filled,
    this.pinLength = 4,
    this.variant = PinDotsVariant.unlock,
  });

  @override
  Widget build(BuildContext context) {
    final template = variant == PinDotsVariant.onboarding || variant == PinDotsVariant.unlock;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(pinLength, (i) {
        final active = i < filled;
        final size = template ? 16.0 : 14.0;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: size,
          height: size,
          margin: EdgeInsets.symmetric(horizontal: template ? 9 : 10),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? AppColors.primary : const Color(0xFFD5E1EA),
            boxShadow: active
                ? [
                    BoxShadow(
                      color: AppColors.primarySoft.withValues(alpha: 0.9),
                      blurRadius: 0,
                      spreadRadius: 5,
                    ),
                  ]
                : null,
          ),
        );
      }),
    );
  }
}

/// Shablon: Touch ID tugmasi (Screen 4).
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: loading ? null : onPressed,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: 52,
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE8EEF3)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                    )
                  : const Icon(Icons.fingerprint_rounded, size: 26, color: AppColors.primary),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
        ),
      ],
    );
  }
}
