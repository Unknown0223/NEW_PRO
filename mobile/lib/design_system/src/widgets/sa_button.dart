import 'package:flutter/material.dart';
import '../tokens/sa_motion.dart';
import '../tokens/sa_space.dart';

/// Brendning asosiy tugmasi: to'liq kenglik, 48px balandlik.
class SaPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const SaPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: scheme.primary.withOpacity(0.45),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaRadius.control),
          ),
        ),
        child: AnimatedSwitcher(
          duration: SaDurations.fast,
          child: loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Row(
                  key: const ValueKey('label'),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 16),
                      const SizedBox(width: SaSpace.sm),
                    ],
                    Text(label),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Ikkilamchi harakatlar uchun chiziqli tugma.
class SaGhostButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  const SaGhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.onSurface,
          side: BorderSide(color: scheme.outlineVariant),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaRadius.control),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16),
              const SizedBox(width: SaSpace.sm),
            ],
            Text(label),
          ],
        ),
      ),
    );
  }
}
