import 'package:flutter/material.dart';

import '../tokens/sa_colors.dart';
import '../tokens/sa_motion.dart';

/// Sales Arena brend ranglari (prototip `Brand.tsx`).
class SaBrand {
  const SaBrand._();

  static const Color navy = SaColors.navy;
  static const Color blue = SaColors.salesBlue;
  static const Color bright = SaColors.brightSky;
}

/// Navy tile + zig-zag + ko‘k strelka (+ ixtiyoriy draw animatsiya).
class SaBrandMark extends StatefulWidget {
  final double size;
  final bool bare;
  final bool draw;

  const SaBrandMark({
    super.key,
    this.size = 64,
    this.bare = false,
    this.draw = true,
  });

  @override
  State<SaBrandMark> createState() => _SaBrandMarkState();
}

class _SaBrandMarkState extends State<SaBrandMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.emphatic,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!widget.draw || saReduceMotion(context)) {
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
      canvas.drawRRect(r, Paint()..color = SaBrand.navy);
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
    final arrowColor = bare ? Colors.white : SaBrand.blue;
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
        Paint()..color = arrowColor.withValues(alpha: ((t - 0.85) / 0.15).clamp(0, 1)),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BrandMarkPainter old) =>
      old.bare != bare || old.progress != progress;
}

enum SaBrandTone { light, dark, onBrand }

/// «Sales» + «Arena» wordmark.
class SaBrandWordmark extends StatelessWidget {
  final double size;
  final SaBrandTone tone;

  const SaBrandWordmark({
    super.key,
    this.size = 26,
    this.tone = SaBrandTone.light,
  });

  @override
  Widget build(BuildContext context) {
    final first = switch (tone) {
      SaBrandTone.light => SaBrand.navy,
      SaBrandTone.dark => Colors.white,
      SaBrandTone.onBrand => Colors.white,
    };
    final second = switch (tone) {
      SaBrandTone.light => SaBrand.blue,
      SaBrandTone.dark => SaBrand.bright,
      SaBrandTone.onBrand => Colors.white.withValues(alpha: 0.82),
    };
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

/// Auth / splash fon nuqtalari — shablon `.dot-grid`.
class SaDotGridPainter extends CustomPainter {
  const SaDotGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = const Color(0xFF14223F).withValues(alpha: 0.06);
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

/// Pastki brend to‘lqini — AuthScreen `BrandWave` (ko‘tarilish animatsiyasi).
class SaBrandWave extends StatefulWidget {
  final double topFraction;
  final bool animate;

  const SaBrandWave({
    super.key,
    this.topFraction = 0.71,
    this.animate = true,
  });

  @override
  State<SaBrandWave> createState() => _SaBrandWaveState();
}

class _SaBrandWaveState extends State<SaBrandWave>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late Animation<double> _top;
  double _fromTop = 1.0;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      animationBehavior: AnimationBehavior.preserve,
      duration: SaDurations.data,
    );
    // Launch: to‘lqin pastda (top=1) → form/cover ga ko‘tariladi.
    _fromTop = widget.topFraction >= 0.99 ? widget.topFraction : 1.0;
    _bindTween(begin: _fromTop, end: widget.topFraction);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _run();
    });
  }

  void _bindTween({required double begin, required double end}) {
    _top = Tween<double>(begin: begin, end: end).animate(
      CurvedAnimation(parent: _c, curve: SaCurves.standard),
    );
  }

  void _run() {
    if (!widget.animate || saReduceMotion(context)) {
      _c.value = 1;
      return;
    }
    _c.forward(from: 0);
  }

  @override
  void didUpdateWidget(covariant SaBrandWave oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.topFraction == widget.topFraction &&
        oldWidget.animate == widget.animate) {
      return;
    }
    final begin = _top.value;
    _bindTween(begin: begin, end: widget.topFraction);
    _run();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // LayoutBuilder ishlatilmaydi — PIN/Stack ichida layout loop chiqarmasligi uchun.
    return AnimatedBuilder(
      animation: _top,
      builder: (context, _) {
        final top = _top.value.clamp(0.0, 1.0);
        final heightFactor = (1.0 - top).clamp(0.0, 1.0);
        if (heightFactor <= 0.001) {
          return const SizedBox.shrink();
        }
        return Align(
          alignment: Alignment.bottomCenter,
          child: FractionallySizedBox(
            widthFactor: 1,
            heightFactor: heightFactor,
            alignment: Alignment.bottomCenter,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 72,
                  width: double.infinity,
                  child: CustomPaint(painter: _WavePainter()),
                ),
                const Expanded(child: ColoredBox(color: SaBrand.blue)),
              ],
            ),
          ),
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
    canvas.drawPath(
      soft,
      Paint()..color = SaBrand.bright.withValues(alpha: 0.35),
    );

    final main = Path()
      ..moveTo(0, h * 0.18)
      ..cubicTo(w * 0.3, h * 0.22, w * 0.62, h * 0.46, w, h * 0.86)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(main, Paint()..color = SaBrand.blue);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
