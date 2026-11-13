import 'package:flutter/material.dart';

import '../tokens/sa_motion.dart';

/// Motion Lab «screen» — 380ms cubic-bezier(.16,1,.3,1), CSS translateY(14px)+scale.
class SaScreenPageTransitionsBuilder extends PageTransitionsBuilder {
  const SaScreenPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (saReduceMotion(context)) return child;
    final curved = CurvedAnimation(parent: animation, curve: SaCurves.standard);
    return AnimatedBuilder(
      animation: curved,
      builder: (context, child) {
        final t = curved.value.clamp(0.0, 1.0);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, 14 * (1 - t)),
            child: Transform.scale(
              scale: 0.988 + 0.012 * t,
              alignment: Alignment.topCenter,
              child: child,
            ),
          ),
        );
      },
      child: RepaintBoundary(child: child),
    );
  }
}
