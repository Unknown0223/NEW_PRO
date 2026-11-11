import 'package:flutter/material.dart';
import '../tokens/sa_colors.dart';
import '../tokens/sa_motion.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';

/// Sinxronlash holati ko'rsatkichi.
/// progress 0..1, steps bosqich nomlari, done=true da yakun belgisi.
class SaSyncView extends StatelessWidget {
  final double progress;
  final List<String> steps;
  final int doneSteps;
  final bool done;

  const SaSyncView({
    super.key,
    required this.progress,
    required this.steps,
    required this.doneSteps,
    this.done = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final reduce = saReduceMotion(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 120,
          height: 120,
          child: Stack(
            alignment: Alignment.center,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
                duration: reduce ? Duration.zero : SaDurations.base,
                curve: SaCurves.standard,
                builder: (ctx, v, _) => CircularProgressIndicator(
                  value: v,
                  strokeWidth: 8,
                  backgroundColor: scheme.outlineVariant,
                  valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
                ),
              ),
              AnimatedSwitcher(
                duration: SaDurations.fast,
                child: done
                    ? Icon(Icons.check_circle,
                        key: const ValueKey('ok'), size: 44, color: scheme.primary)
                    : Text(
                        (progress.clamp(0.0, 1.0) * 100).round().toString() + '%',
                        key: const ValueKey('pct'),
                        style: SaType.mono.copyWith(
                          fontSize: 16,
                          color: scheme.onSurface,
                        ),
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SaSpace.md),
        ...steps.asMap().entries.map((e) {
          final ok = e.key < doneSteps;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                Icon(
                  ok ? Icons.check_circle : Icons.circle_outlined,
                  size: 16,
                  color: ok ? SaColors.expeditor : scheme.outline,
                ),
                const SizedBox(width: SaSpace.sm),
                Text(e.value, style: SaType.body),
              ],
            ),
          );
        }),
      ],
    );
  }
}
