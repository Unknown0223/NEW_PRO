import 'package:flutter/material.dart';

import '../tokens/sa_colors.dart';
import '../tokens/sa_motion.dart';

/// Shablon `au-in` / `rise-in` — pastga siljib paydo bo‘lish.
class SaEnter extends StatefulWidget {
  final Widget child;
  final Duration delay;
  final SaMotionPreset preset;
  final bool enabled;

  const SaEnter({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.preset = SaMotionPreset.rise,
    this.enabled = true,
  });

  @override
  State<SaEnter> createState() => _SaEnterState();
}

class _SaEnterState extends State<SaEnter> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: widget.preset.duration,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    if (!mounted) return;
    if (!widget.enabled || saReduceMotion(context)) {
      _c.value = 1;
      setState(() => _ready = true);
      return;
    }
    final d = saDuration(context, widget.preset.duration);
    _c.duration = d <= Duration.zero ? widget.preset.duration : d;
    if (widget.delay > Duration.zero) {
      await Future<void>.delayed(saDuration(context, widget.delay));
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
    if (!widget.enabled || saReduceMotion(context)) return widget.child;
    if (!_ready && _c.value == 0) {
      return Opacity(opacity: 0, child: widget.child);
    }
    // CSS: rise-in translateY(14px); screen-in + scale(0.988); pop-in scale(0.9).
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          // SaCurves.pop (1.56) overshoot — Opacity faqat 0..1.
          final t = widget.preset.curve.transform(_c.value.clamp(0.0, 1.0));
          final opacity = t.clamp(0.0, 1.0);
          if (widget.preset == SaMotionPreset.spring) {
            final s = 0.9 + 0.1 * t;
            return Opacity(
              opacity: opacity,
              child: Transform.scale(scale: s, child: child),
            );
          }
          const fromY = 14.0;
          final scale = widget.preset == SaMotionPreset.screen
              ? (0.988 + 0.012 * t.clamp(0.0, 1.0))
              : 1.0;
          return Opacity(
            opacity: opacity,
            child: Transform.translate(
              offset: Offset(0, fromY * (1 - opacity)),
              child: Transform.scale(
                scale: scale,
                alignment: Alignment.topCenter,
                child: child,
              ),
            ),
          );
        },
        child: widget.child,
      ),
    );
  }
}

/// Ro‘yxat / kartalar — `stagger-item` (60–80ms).
class SaStagger extends StatelessWidget {
  final List<Widget> children;
  final Duration step;
  final SaMotionPreset preset;
  final CrossAxisAlignment crossAxisAlignment;
  final MainAxisSize mainAxisSize;

  const SaStagger({
    super.key,
    required this.children,
    this.step = SaStaggerDelay.list,
    this.preset = SaMotionPreset.rise,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
    this.mainAxisSize = MainAxisSize.min,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: mainAxisSize,
      crossAxisAlignment: crossAxisAlignment,
      children: [
        for (var i = 0; i < children.length; i++)
          SaEnter(
            delay: SaStaggerDelay.of(i, step: step),
            preset: preset,
            child: children[i],
          ),
      ],
    );
  }
}

/// `active:scale-[0.985]` / press 180ms.
/// [onTap] berilsa o‘zi bosadi; berilmasa faqat scale (ichki Button uchun).
class SaPressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double pressedScale;
  final BorderRadius? borderRadius;

  const SaPressable({
    super.key,
    required this.child,
    this.onTap,
    /// Shablon `active:scale-[0.98]` / `0.99`
    this.pressedScale = 0.98,
    this.borderRadius,
  });

  @override
  State<SaPressable> createState() => _SaPressableState();
}

class _SaPressableState extends State<SaPressable> {
  bool _down = false;

  void _setDown(bool v) {
    if (_down == v) return;
    setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final reduce = saReduceMotion(context);
    final scaled = AnimatedScale(
      scale: _down && !reduce ? widget.pressedScale : 1,
      duration: saDuration(context, SaDurations.press),
      curve: SaCurves.press,
      child: widget.child,
    );
    if (widget.onTap != null) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: (_) => _setDown(true),
        onTapUp: (_) => _setDown(false),
        onTapCancel: () => _setDown(false),
        child: scaled,
      );
    }
    // Ichki Button/InkWell — faqat scale, tapni o‘g‘irlamaydi.
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _setDown(true),
      onPointerUp: (_) => _setDown(false),
      onPointerCancel: (_) => _setDown(false),
      child: scaled,
    );
  }
}

/// Spring pop — sheet / FAB / tasdiqlash.
class SaPopIn extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const SaPopIn({super.key, required this.child, this.delay = Duration.zero});

  @override
  State<SaPopIn> createState() => _SaPopInState();
}

class _SaPopInState extends State<SaPopIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.emphatic,
    );
    final curved = CurvedAnimation(parent: _c, curve: SaCurves.pop);
    _scale = Tween<double>(begin: 0.9, end: 1).animate(curved);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      if (widget.delay > Duration.zero) {
        await Future<void>.delayed(widget.delay);
      }
      if (!mounted) return;
      if (saReduceMotion(context)) {
        _c.value = 1;
        return;
      }
      await _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (saReduceMotion(context)) return widget.child;
    // Pop curve overshoot — FadeTransition opacity clamp qilinadi.
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = SaCurves.pop.transform(_c.value.clamp(0.0, 1.0));
        return Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.scale(scale: _scale.value, child: child),
        );
      },
      child: widget.child,
    );
  }
}

/// Skeleton shimmer — 1600ms linear.
class SaShimmer extends StatefulWidget {
  final double height;
  final double? width;
  final BorderRadius? borderRadius;

  const SaShimmer({
    super.key,
    this.height = 12,
    this.width,
    this.borderRadius,
  });

  @override
  State<SaShimmer> createState() => _SaShimmerState();
}

class _SaShimmerState extends State<SaShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.shimmer,
    )..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(8);
    if (saReduceMotion(context)) {
      return Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: const Color(0xFFE8EEF5),
          borderRadius: radius,
        ),
      );
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: radius,
            gradient: LinearGradient(
              begin: Alignment(-1.5 + 3 * _c.value, 0),
              end: Alignment(-0.5 + 3 * _c.value, 0),
              colors: const [
                Color(0xFFE8EEF5),
                Color(0xFFF7FAFC),
                Color(0xFFE8EEF5),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Live pulse nuqta — sync / faol vizit.
class SaLivePulse extends StatefulWidget {
  final Color color;
  final double size;

  const SaLivePulse({
    super.key,
    this.color = SaColors.salesBlue,
    this.size = 10,
  });

  @override
  State<SaLivePulse> createState() => _SaLivePulseState();
}

class _SaLivePulseState extends State<SaLivePulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.pulse,
    )..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size * 2.2,
      height: widget.size * 2.2,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = Curves.easeOut.transform(_c.value);
          return Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: (1 - t) * 0.55,
                child: Transform.scale(
                  scale: 0.7 + t * 1.4,
                  child: Container(
                    width: widget.size * 2,
                    height: widget.size * 2,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: widget.color.withValues(alpha: 0.45),
                      ),
                    ),
                  ),
                ),
              ),
              Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  color: widget.color,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// KPI count-up — 900ms tabular.
class SaCountUp extends StatefulWidget {
  final num value;
  final TextStyle? style;
  final String Function(num v)? format;
  final Duration duration;

  const SaCountUp({
    super.key,
    required this.value,
    this.style,
    this.format,
    this.duration = SaDurations.data,
  });

  @override
  State<SaCountUp> createState() => _SaCountUpState();
}

class _SaCountUpState extends State<SaCountUp>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late Animation<double> _anim;
  num _from = 0;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: widget.duration,
    );
    _anim = Tween<double>(begin: 0, end: widget.value.toDouble())
        .animate(CurvedAnimation(parent: _c, curve: SaCurves.enter));
    _c.forward();
  }

  @override
  void didUpdateWidget(covariant SaCountUp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _from = oldWidget.value;
      _anim = Tween<double>(
        begin: _from.toDouble(),
        end: widget.value.toDouble(),
      ).animate(CurvedAnimation(parent: _c, curve: SaCurves.enter));
      _c
        ..duration = widget.duration
        ..forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fmt = widget.format ?? (v) => v.round().toString();
    if (saReduceMotion(context)) {
      return Text(fmt(widget.value), style: widget.style);
    }
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) => Text(fmt(_anim.value), style: widget.style),
    );
  }
}

/// KPI bar grow — scaleY.
class SaBarGrow extends StatefulWidget {
  final double height;
  final double width;
  final Color color;
  final Duration delay;

  const SaBarGrow({
    super.key,
    required this.height,
    this.width = 16,
    required this.color,
    this.delay = Duration.zero,
  });

  @override
  State<SaBarGrow> createState() => _SaBarGrowState();
}

class _SaBarGrowState extends State<SaBarGrow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.data,
    );
    Future<void>.delayed(widget.delay, () {
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
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = saReduceMotion(context)
              ? 1.0
              : Curves.easeOut.transform(_c.value);
          return Align(
            alignment: Alignment.bottomCenter,
            child: Opacity(
              opacity: 0.4 + 0.6 * t,
              child: Container(
                width: widget.width,
                height: widget.height * (0.05 + 0.95 * t),
                decoration: BoxDecoration(
                  color: widget.color,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(4),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// CSS `.live-dot` — faol vizit / sync pulse (2000ms).
class SaLiveDot extends StatefulWidget {
  final Color color;
  final double size;

  const SaLiveDot({
    super.key,
    required this.color,
    this.size = 6,
  });

  @override
  State<SaLiveDot> createState() => _SaLiveDotState();
}

class _SaLiveDotState extends State<SaLiveDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.pulse,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (saReduceMotion(context)) {
        _c.value = 1;
      } else {
        _c.repeat();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (saReduceMotion(context)) {
      _c.stop();
      _c.value = 1;
    } else if (!_c.isAnimating && _c.value < 1) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size * 2.2,
      height: widget.size * 2.2,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = saReduceMotion(context) ? 0.0 : _c.value;
          final ring = (t < 0.5 ? t * 2 : (1 - t) * 2).clamp(0.0, 1.0);
          return Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: 0.35 * (1 - ring),
                child: Container(
                  width: widget.size * (1 + ring * 1.6),
                  height: widget.size * (1 + ring * 1.6),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: widget.color,
                  ),
                ),
              ),
              Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Pointer tilt — karta fokusi (240ms). Desktop/hover; mobil’da child o‘zi.
class SaTilt extends StatefulWidget {
  final Widget child;
  final double maxTilt;

  const SaTilt({super.key, required this.child, this.maxTilt = 0.04});

  @override
  State<SaTilt> createState() => _SaTiltState();
}

class _SaTiltState extends State<SaTilt> {
  double _dx = 0;
  double _dy = 0;

  @override
  Widget build(BuildContext context) {
    if (saReduceMotion(context)) return widget.child;
    return MouseRegion(
      onHover: (e) {
        final box = context.findRenderObject() as RenderBox?;
        if (box == null || !box.hasSize) return;
        final local = box.globalToLocal(e.position);
        final nx = (local.dx / box.size.width) * 2 - 1;
        final ny = (local.dy / box.size.height) * 2 - 1;
        setState(() {
          _dx = ny.clamp(-1.0, 1.0) * widget.maxTilt;
          _dy = -nx.clamp(-1.0, 1.0) * widget.maxTilt;
        });
      },
      onExit: (_) => setState(() {
        _dx = 0;
        _dy = 0;
      }),
      child: AnimatedContainer(
        duration: SaDurations.base,
        curve: SaCurves.press,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.001)
          ..rotateX(_dx)
          ..rotateY(_dy),
        transformAlignment: Alignment.center,
        child: widget.child,
      ),
    );
  }
}

/// Shablon `.auth-shake` — login/PIN xato holati.
class SaAuthShake extends StatefulWidget {
  final Widget child;
  final bool shake;

  const SaAuthShake({
    super.key,
    required this.child,
    required this.shake,
  });

  @override
  State<SaAuthShake> createState() => _SaAuthShakeState();
}

class _SaAuthShakeState extends State<SaAuthShake>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _offset;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: const Duration(milliseconds: 420),
    );
    _offset = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -2.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -2.0, end: 4.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: 4.0, end: -6.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -6.0, end: 6.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: 6.0, end: -6.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -6.0, end: 6.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: 6.0, end: -2.0), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -2.0, end: 0.0), weight: 30),
    ]).animate(CurvedAnimation(parent: _c, curve: const Cubic(0.36, 0.07, 0.19, 0.97)));
  }

  @override
  void didUpdateWidget(covariant SaAuthShake oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.shake && !oldWidget.shake) {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (saReduceMotion(context)) return widget.child;
    return AnimatedBuilder(
      animation: _offset,
      builder: (context, child) => Transform.translate(
        offset: Offset(_offset.value, 0),
        child: child,
      ),
      child: widget.child,
    );
  }
}

/// Shablon `.launch-zoom` — auth kirish scale.
class SaLaunchZoom extends StatefulWidget {
  final Widget child;

  const SaLaunchZoom({super.key, required this.child});

  @override
  State<SaLaunchZoom> createState() => _SaLaunchZoomState();
}

class _SaLaunchZoomState extends State<SaLaunchZoom>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.launchZoom,
    );
    final curved = CurvedAnimation(parent: _c, curve: SaCurves.standard);
    _scale = Tween<double>(begin: 0.7, end: 1).animate(curved);
    _opacity = Tween<double>(begin: 0.2, end: 1).animate(curved);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (saReduceMotion(context)) {
        _c.value = 1;
        return;
      }
      _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (saReduceMotion(context)) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final opacity = _opacity.value.clamp(0.0, 1.0);
        return Opacity(
          opacity: opacity,
          child: Transform.scale(
            scale: _scale.value,
            alignment: const Alignment(0, 0.62),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}
