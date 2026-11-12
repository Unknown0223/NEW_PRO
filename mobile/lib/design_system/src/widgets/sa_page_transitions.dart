import 'package:flutter/material.dart';

import '../tokens/sa_motion.dart';

/// Motion Lab «screen» — 380ms cubic-bezier(.16,1,.3,1) slide+fade.
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
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.03),
          end: Offset.zero,
        ).animate(curved),
        child: RepaintBoundary(child: child),
      ),
    );
  }
}
