import 'package:flutter/material.dart';

import 'template_auth_entrance.dart';

/// Shablon `.au-in` — delay davomida yashirin, keyin 600ms slide/fade.
class AuthEnter extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const AuthEnter({
    super.key,
    required this.child,
    this.delay = Duration.zero,
  });

  @override
  State<AuthEnter> createState() => _AuthEnterState();
}

class _AuthEnterState extends State<AuthEnter>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final double _start;

  @override
  void initState() {
    super.initState();
    final delayMs = widget.delay.inMilliseconds.clamp(0, 100000);
    final totalMs = delayMs + authEntranceAuIn.inMilliseconds;
    _start = totalMs <= 0 ? 0.0 : delayMs / totalMs;
    _c = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: totalMs),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final span = (1.0 - _start).clamp(0.001, 1.0);
        final local = ((_c.value - _start) / span).clamp(0.0, 1.0);
        final t = authEntranceCurve.transform(local);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, 14 * (1 - t)),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}
