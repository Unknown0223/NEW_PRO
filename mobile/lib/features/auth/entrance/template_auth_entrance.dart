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
const Duration authEntranceAuIn = Duration(milliseconds: 600);
const Duration authEntranceLaunchZoom = Duration(milliseconds: 750);
const Duration authEntranceLogoMove = Duration(milliseconds: 800);
const Duration authEntranceWaveMove = Duration(milliseconds: 900);
const Duration authEntranceWordmarkDelay = Duration(milliseconds: 650);
const Duration authEntranceTaglineDelay = Duration(milliseconds: 900);
const Duration authEntranceCoverBrandDelay = Duration(milliseconds: 380);
const Duration authEntranceMarkDraw = Duration(milliseconds: 1180);

/// `.au-in` / `.sa-logo` / `.launch-zoom` cubic-bezier(0.16, 1, 0.3, 1)
const Cubic authEntranceCurve = Cubic(0.16, 1.0, 0.3, 1.0);

/// `.sa-wave` cubic-bezier(0.7, 0, 0.2, 1)
const Cubic authEntranceWaveCurve = Cubic(0.7, 0.0, 0.2, 1.0);

/// Form au-in ladder (slug → login → pass → button → footer).
const List<Duration> authEntranceFormDelays = [
  Duration(milliseconds: 80),
  Duration(milliseconds: 140),
  Duration(milliseconds: 200),
  Duration(milliseconds: 300),
  Duration(milliseconds: 350),
];

/// Login / cover brand — shablon `BRAND.navy` / `BRAND.blue`.
const Color authBrandNavy = Color(0xFF14223F);
const Color authBrandBlue = Color(0xFF1F66D1);
const Color authBrandBright = Color(0xFF6FA8FF);

const Color _navy = authBrandNavy;
const Color _blue = authBrandBlue;
const Color _bright = authBrandBright;

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
    _c = AnimationController(vsync: this, duration: authEntranceMarkDraw);
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
            // Timeline matches CSS bm-zig / bm-arrow / bm-head delays.
            progress: _c.value,
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

    // zig: 0.15s delay + 0.45s draw → ~0.13–0.51 of 1180ms
    final zigT = ((progress - 0.13) / 0.38).clamp(0.0, 1.0);
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
    canvas.drawPath(zigMetric.extractPath(0, zigMetric.length * zigT), zig);

    // arrow: 0.55s delay + 0.3s → ~0.47–0.72
    final arrowT = ((progress - 0.47) / 0.25).clamp(0.0, 1.0);
    if (arrowT <= 0) return;
    final arrowColor = bare ? Colors.white : _blue;
    final arrow = Paint()
      ..color = arrowColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 36 * s
      ..strokeCap = StrokeCap.round;
    final p0 = Offset(248 * s, 292 * s);
    final p1 = Offset(336 * s, 194 * s);
    canvas.drawLine(p0, Offset.lerp(p0, p1, arrowT)!, arrow);

    // head: 0.78s delay + 0.4s → ~0.66–1.0
    final headT = ((progress - 0.66) / 0.34).clamp(0.0, 1.0);
    if (headT <= 0) return;
    final head = Path()
      ..moveTo(282 * s, 188 * s)
      ..lineTo(356 * s, 174 * s)
      ..lineTo(328 * s, 242 * s)
      ..close();
    canvas.drawPath(
      head,
      Paint()..color = arrowColor.withValues(alpha: headT),
    );
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

/// CSS `.sa-wave`: absolute `top` + h-[150%], transition 0.9s wave curve.
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
  double _from = 1.0;
  double _to = 1.0;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: authEntranceWaveMove);
    final from = widget.topFraction >= 0.99 ? widget.topFraction : 1.0;
    _bindTween(begin: from, end: widget.topFraction);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _run();
    });
  }

  void _bindTween({required double begin, required double end}) {
    _from = begin;
    _to = end;
    _top = Tween<double>(begin: begin, end: end).animate(
      CurvedAnimation(parent: _c, curve: authEntranceWaveCurve),
    );
  }

  void _run() {
    if (!widget.animate || (_from - _to).abs() < 0.0001) {
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
        final h = constraints.maxHeight;
        final w = constraints.maxWidth;
        return AnimatedBuilder(
          animation: _top,
          builder: (context, _) {
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: 0,
                  width: w,
                  top: h * _top.value,
                  height: h * 1.5,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: 150,
                        width: w,
                        child: CustomPaint(painter: _WavePainter()),
                      ),
                      const Expanded(child: ColoredBox(color: _blue)),
                    ],
                  ),
                ),
              ],
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
    _c = AnimationController(vsync: this, duration: authEntranceLaunchZoom);
    final curved = CurvedAnimation(parent: _c, curve: authEntranceCurve);
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
