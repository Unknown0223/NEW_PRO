import 'package:flutter/material.dart';

/// Shablon `au-in` — pastga siljib paydo bo‘lish (+ ixtiyoriy delay).
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
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    if (!mounted) return;
    if (widget.delay > Duration.zero) {
      await Future<void>.delayed(widget.delay);
    }
    if (!mounted) return;
    setState(() => _ready = true);
    await _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready && _c.value == 0) {
      return Opacity(opacity: 0, child: widget.child);
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = const Cubic(0.16, 0.99, 0.3, 1)
            .transform(_c.value.clamp(0.0, 1.0))
            .clamp(0.0, 1.0);
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
