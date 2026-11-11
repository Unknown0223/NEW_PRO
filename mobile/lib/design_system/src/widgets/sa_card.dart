import 'package:flutter/material.dart';

import '../tokens/sa_motion.dart';
import '../tokens/sa_space.dart';
import '../tokens/sa_type.dart';
import 'sa_motion.dart';

/// Standart kontent kartasi: 16px radius + ixtiyoriy enter/tilt/press.
class SaCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final bool animateEnter;
  final Duration enterDelay;
  final bool tilt;

  const SaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(SaSpace.lg),
    this.onTap,
    this.animateEnter = false,
    this.enterDelay = Duration.zero,
    this.tilt = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(SaRadius.card),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: child,
    );

    if (onTap != null) {
      body = SaPressable(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SaRadius.card),
        child: body,
      );
    }
    if (tilt) {
      body = SaTilt(child: body);
    }
    if (animateEnter) {
      body = SaEnter(
        delay: enterDelay,
        preset: SaMotionPreset.rise,
        child: body,
      );
    }
    return body;
  }
}

/// Bo‘lim sarlavhasi: kichik mono ustki matn + katta sarlavha.
class SaSectionTitle extends StatelessWidget {
  final String eyebrow;
  final String title;

  const SaSectionTitle({super.key, required this.eyebrow, required this.title});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SaEnter(
      preset: SaMotionPreset.rise,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow.toUpperCase(),
            style: SaType.mono.copyWith(color: scheme.primary, fontSize: 9),
          ),
          const SizedBox(height: SaSpace.xs),
          Text(title, style: SaType.title.copyWith(color: scheme.onSurface)),
        ],
      ),
    );
  }
}
