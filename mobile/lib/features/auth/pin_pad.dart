import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

/// Bank uslubidagi raqamli klaviatura (4 xonali PIN).
class PinPad extends StatelessWidget {
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final bool enabled;
  final VoidCallback? onBiometric;
  final bool showBiometric;

  const PinPad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    this.enabled = true,
    this.onBiometric,
    this.showBiometric = false,
  });

  static const _keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth.clamp(280.0, 340.0);
        final keySize = (maxW - 32) / 3;
        return Center(
          child: SizedBox(
            width: maxW,
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                mainAxisExtent: keySize.clamp(64.0, 80.0),
              ),
              itemCount: _keys.length,
              itemBuilder: (ctx, i) {
                final k = _keys[i];
                if (k.isEmpty) {
                  if (showBiometric && onBiometric != null) {
                    return _PinCircleButton(
                      enabled: enabled,
                      onTap: onBiometric!,
                      child: const Icon(Icons.fingerprint_rounded, size: 32, color: AppColors.primary),
                    );
                  }
                  return const SizedBox.shrink();
                }
                if (k == 'back') {
                  return _PinCircleButton(
                    enabled: enabled,
                    onTap: onBackspace,
                    child: const Icon(Icons.backspace_outlined, size: 26, color: AppColors.textTitle),
                  );
                }
                return _PinCircleButton(
                  enabled: enabled,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    onDigit(k);
                  },
                  child: Text(
                    k,
                    style: AppTypography.displayMedium.copyWith(
                      fontSize: 28,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textTitle,
                      height: 1,
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class PinDots extends StatelessWidget {
  final int filled;
  final int pinLength;

  const PinDots({
    super.key,
    required this.filled,
    this.pinLength = 4,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(pinLength, (i) {
        final active = i < filled;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          width: active ? 16 : 14,
          height: active ? 16 : 14,
          margin: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? AppColors.primary : Colors.transparent,
            border: Border.all(
              color: active ? AppColors.primary : AppColors.textMuted.withValues(alpha: 0.35),
              width: 2,
            ),
            boxShadow: active
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
        );
      }),
    );
  }
}

class _PinCircleButton extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final bool enabled;

  const _PinCircleButton({
    required this.child,
    required this.onTap,
    this.enabled = true,
  });

  @override
  State<_PinCircleButton> createState() => _PinCircleButtonState();
}

class _PinCircleButtonState extends State<_PinCircleButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp: widget.enabled
          ? (_) {
              setState(() => _pressed = false);
              widget.onTap();
            }
          : null,
      onTapCancel: widget.enabled ? () => setState(() => _pressed = false) : null,
      child: AnimatedScale(
        scale: _pressed ? 0.92 : 1,
        duration: const Duration(milliseconds: 80),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: widget.enabled ? widget.onTap : null,
            child: Ink(
              width: double.infinity,
              height: double.infinity,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _pressed
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : AppColors.surfaceVariant,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(child: widget.child),
            ),
          ),
        ),
      ),
    );
  }
}
