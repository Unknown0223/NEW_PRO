import 'package:flutter/material.dart';

/// Shablon AuthScreen kirish bosqichlari — faqat ilova ochilishi.
enum AuthEntranceStage { launch, form, cover }

/// CSS: launch 100%, form 71%, cover `-160px` ≈ −0.18 viewport.
double authEntranceWaveTop(AuthEntranceStage stage) => switch (stage) {
      AuthEntranceStage.launch => 1.0,
      AuthEntranceStage.form => 0.71,
      AuthEntranceStage.cover => -0.18,
    };

const Duration authEntranceLaunchHold = Duration(milliseconds: 1600);
const Duration authEntranceCoverHold = Duration(milliseconds: 900);

const Color _navy = Color(0xFF14223F);
const Color _blue = Color(0xFF1F66D1);
const Color _bright = Color(0xFF6FA8FF);

class AuthBrandMark extends StatefulWidget {
  final double size;
  final bool bare;
  final bool draw;

  const AuthBrandMark({
    super.key,
    this.size = 64,
    this.bare = false,
    this.draw = true,
  });

  @override
  State<AuthBrandMark> createState() => _AuthBrandMarkState();
}

class _AuthBrandMarkState extends State<AuthBrandMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!widget.draw) {
        _c.value = 1;
      } else {
        _c.forward();
      }
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
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) => CustomPaint(
          painter: _BrandMarkPainter(
            bare: widget.bare,
            progress: Curves.easeOutCubic.transform(_c.value),
          ),
        ),
      ),
    );
  }
}

class _BrandMarkPainter extends CustomPainter {
  final bool bare;
  final double progress;
  const _BrandMarkPainter({required this.bare, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 512;
    if (!bare) {
      final r = RRect.fromRectAndRadius(
        Rect.fromLTWH(0, 0, size.width, size.height),
        Radius.circular(116 * s),
      );
      canvas.drawRRect(r, Paint()..color = _navy);
    }

    final zig = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 36 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final zigPath = Path()
      ..moveTo(148 * s, 330 * s)
      ..lineTo(200 * s, 256 * s)
      ..lineTo(248 * s, 290 * s);
    final zigMetric = zigPath.computeMetrics().first;
    canvas.drawPath(
      zigMetric.extractPath(0, zigMetric.length * progress.clamp(0, 1)),
      zig,
    );

    if (progress < 0.35) return;
    final t = ((progress - 0.35) / 0.65).clamp(0.0, 1.0);
    final arrowColor = bare ? Colors.white : _blue;
    final arrow = Paint()
      ..color = arrowColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 36 * s
      ..strokeCap = StrokeCap.round;
    final p0 = Offset(248 * s, 292 * s);
    final p1 = Offset(336 * s, 194 * s);
    canvas.drawLine(p0, Offset.lerp(p0, p1, t)!, arrow);

    if (t > 0.85) {
      final head = Path()
        ..moveTo(282 * s, 188 * s)
        ..lineTo(356 * s, 174 * s)
        ..lineTo(328 * s, 242 * s)
        ..close();
      canvas.drawPath(
        head,
        Paint()
          ..color =
              arrowColor.withValues(alpha: ((t - 0.85) / 0.15).clamp(0, 1)),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BrandMarkPainter old) =>
      old.bare != bare || old.progress != progress;
}

class AuthBrandWordmark extends StatelessWidget {
  final double size;
  final bool onBrand;

  const AuthBrandWordmark({
    super.key,
    this.size = 26,
    this.onBrand = false,
  });

  @override
  Widget build(BuildContext context) {
    final first = onBrand ? Colors.white : _navy;
    final second =
        onBrand ? Colors.white.withValues(alpha: 0.82) : _blue;
    return Text.rich(
      TextSpan(
        style: TextStyle(
          fontSize: size,
          fontWeight: FontWeight.w800,
          height: 1,
          letterSpacing: -0.6,
        ),
        children: [
          TextSpan(text: 'Sales', style: TextStyle(color: first)),
          TextSpan(text: 'Arena', style: TextStyle(color: second)),
        ],
      ),
    );
  }
}

class AuthDotGridPainter extends CustomPainter {
  const AuthDotGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = _navy.withValues(alpha: 0.06);
    const step = 18.0;
    for (var y = 0.0; y < size.height; y += step) {
      for (var x = 0.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 0.8, p);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AuthBrandWave extends StatefulWidget {
  final double topFraction;
  final bool animate;

  const AuthBrandWave({
    super.key,
    this.topFraction = 0.71,
    this.animate = true,
  });

  @override
  State<AuthBrandWave> createState() => _AuthBrandWaveState();
}

class _AuthBrandWaveState extends State<AuthBrandWave>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late Animation<double> _top;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    final from = widget.topFraction >= 0.99 ? widget.topFraction : 1.0;
    _bindTween(begin: from, end: widget.topFraction);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _run();
    });
  }

  void _bindTween({required double begin, required double end}) {
    _top = Tween<double>(begin: begin, end: end).animate(
      CurvedAnimation(parent: _c, curve: const Cubic(0.16, 0.99, 0.3, 1)),
    );
  }

  void _run() {
    if (!widget.animate) {
      _c.value = 1;
      return;
    }
    _c.forward(from: 0);
  }

  @override
  void didUpdateWidget(covariant AuthBrandWave oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.topFraction == widget.topFraction &&
        oldWidget.animate == widget.animate) {
      return;
    }
    _bindTween(begin: _top.value, end: widget.topFraction);
    _run();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return AnimatedBuilder(
          animation: _top,
          builder: (context, _) {
            // Cover overshoot: top < 0 → height > parent (shablon −160px).
            final fill = (1.0 - _top.value).clamp(0.0, 1.25);
            if (fill <= 0.001) return const SizedBox.shrink();
            final h = constraints.maxHeight * fill;
            return Align(
              alignment: Alignment.bottomCenter,
              child: SizedBox(
                width: constraints.maxWidth,
                height: h,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 72,
                      width: double.infinity,
                      child: CustomPaint(painter: _WavePainter()),
                    ),
                    const Expanded(child: ColoredBox(color: _blue)),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _WavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final soft = Path()
      ..moveTo(0, h * 0.22)
      ..cubicTo(w * 0.26, h * 0.22, w * 0.6, h * 0.42, w, h * 0.88)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(soft, Paint()..color = _bright.withValues(alpha: 0.35));

    final main = Path()
      ..moveTo(0, h * 0.18)
      ..cubicTo(w * 0.3, h * 0.22, w * 0.62, h * 0.46, w, h * 0.86)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(main, Paint()..color = _blue);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AuthLaunchZoom extends StatefulWidget {
  final Widget child;
  const AuthLaunchZoom({super.key, required this.child});

  @override
  State<AuthLaunchZoom> createState() => _AuthLaunchZoomState();
}

class _AuthLaunchZoomState extends State<AuthLaunchZoom>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    final curved =
        CurvedAnimation(parent: _c, curve: const Cubic(0.16, 0.99, 0.3, 1));
    _scale = Tween<double>(begin: 0.7, end: 1).animate(curved);
    _opacity = Tween<double>(begin: 0.2, end: 1).animate(curved);
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
        return Opacity(
          opacity: _opacity.value.clamp(0.0, 1.0),
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
