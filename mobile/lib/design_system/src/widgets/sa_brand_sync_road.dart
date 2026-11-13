import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../tokens/sa_motion.dart';

/// Shablon `SplashArt.RoadScene` — burchakli yo‘l, pin pop, skuter/avto.
class SaBrandSyncRoadScene extends StatefulWidget {
  final String? role;
  final Color accent;
  final bool leaving;

  const SaBrandSyncRoadScene({
    super.key,
    required this.role,
    required this.accent,
    required this.leaving,
  });

  @override
  State<SaBrandSyncRoadScene> createState() => _SaBrandSyncRoadSceneState();
}

class _SaBrandSyncRoadSceneState extends State<SaBrandSyncRoadScene>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  final Stopwatch _clock = Stopwatch();
  double _ms = 0;
  double? _leaveAtMs;

  @override
  void initState() {
    super.initState();
    _clock.start();
    _ticker = createTicker((_) {
      if (!mounted) return;
      setState(() => _ms = _clock.elapsedMilliseconds.toDouble());
    })
      ..start();
  }

  @override
  void didUpdateWidget(covariant SaBrandSyncRoadScene oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.leaving && _leaveAtMs == null) {
      _leaveAtMs = _ms;
    } else if (!widget.leaving) {
      _leaveAtMs = null;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _clock.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = saReduceMotion(context);
    final leaveMs =
        _leaveAtMs == null ? null : (_ms - _leaveAtMs!).clamp(0.0, 1e9);

    return CustomPaint(
      painter: _RoadPainter(
        ms: reduce ? 1700 : _ms,
        leaveMs: leaveMs,
        accent: widget.accent,
        role: (widget.role ?? 'agent').toLowerCase(),
        leaving: widget.leaving,
        reduce: reduce,
      ),
      size: Size.infinite,
    );
  }
}

class _RoadPainter extends CustomPainter {
  static const double period = 160;
  static const double angleDeg = -32;
  static const double pinY = -47;

  final double ms;
  final double? leaveMs;
  final Color accent;
  final String role;
  final bool leaving;
  final bool reduce;

  const _RoadPainter({
    required this.ms,
    required this.leaveMs,
    required this.accent,
    required this.role,
    required this.leaving,
    required this.reduce,
  });

  double get _enter {
    if (reduce) return 1;
    final t = (ms / 1150).clamp(0.0, 1.0);
    return 1 - math.pow(1 - t, 3).toDouble();
  }

  double get _exit {
    if (!leaving || leaveMs == null || reduce) return 0;
    final t = (leaveMs! / 700).clamp(0.0, 1.0);
    return t * t * t;
  }

  @override
  void paint(Canvas canvas, Size size) {
    // Shablon: viewBox 300×300, xMidYMin — markazdan biroz yuqoriroq.
    final s = math.min(size.width, size.height) / 300;
    final cx = size.width / 2;
    final cy = size.height * 0.42;

    // Radial soft mask (SplashArt mask)
    canvas.saveLayer(Offset.zero & size, Paint());
    canvas.save();
    canvas.translate(cx, cy);
    canvas.scale(s);

    final scroll = (ms * 0.085) % period;
    final sway = reduce ? 0.0 : math.sin(ms / 270) * 1.5;
    final bob = reduce ? 0.0 : math.sin(ms / 130) * 0.45;
    final beat = 0.5 + 0.5 * math.sin(ms / 260);
    final vx = -230 * (1 - _enter) + _exit * 320;

    const road1 = Color(0xFFE2E5EA);
    const road2 = Color(0xFFECEEF2);
    const road3 = Color(0xFFF0F2F5);
    const paper = Colors.white;
    const glyph = Color(0xFF5B6677);
    const dust = Color(0xFF9AA3B2);

    canvas.save();
    canvas.rotate(angleDeg * math.pi / 180);

    // Scrolling map cells
    for (var k = -3; k <= 3; k++) {
      final x = k * period - scroll;
      canvas.drawRect(
        Rect.fromLTWH(x - 13, -300, 26, 600),
        Paint()..color = road2,
      );
      _strokeRRect(canvas, Rect.fromLTWH(x + 30, 44, 100, 84), 5, road3, 6);
      _strokeRRect(canvas, Rect.fromLTWH(x + 36, -150, 88, 96), 5, road3, 6);
      canvas.drawRect(
        Rect.fromLTWH(x + 62, 150, 40, 120),
        Paint()..color = road3,
      );
    }

    // Main road
    canvas.drawRect(
      const Rect.fromLTWH(-420, -25, 840, 50),
      Paint()..color = road1,
    );
    // Center dashes
    final dashPaint = Paint()
      ..color = paper
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    for (var x = -420.0 + scroll; x < 420; x += 26) {
      canvas.drawLine(Offset(x, 0), Offset(x + 13, 0), dashPaint);
    }

    // Supervisor — xarita nuqtalari (shablon RoadScene).
    if (role == 'supervisor' && !reduce) {
      for (var k = 1; k <= 5; k++) {
        final ix = k * period - scroll;
        final y = (k % 2 == 1 ? 1 : -1) * (70 + 34 * math.sin(ms / 900 + k * 1.7));
        const pinColors = [
          Color(0xFF5CC8F5),
          Color(0xFFA79BFF),
          Color(0xFFFFC24D),
          Color(0xFF5FE3B0),
          Color(0xFFF472B6),
        ];
        canvas.drawCircle(Offset(ix, y), 7, Paint()..color = accent.withValues(alpha: 0.16));
        canvas.drawCircle(
          Offset(ix, y),
          4.2,
          Paint()..color = pinColors[(k + 4) % 5],
        );
        canvas.drawCircle(
          Offset(ix, y),
          4.2,
          Paint()
            ..color = paper
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6,
        );
      }
    }

    // Pins
    for (var k = -3; k <= 3; k++) {
      final ix = k * period - scroll + 84;
      final dx = ix - vx;
      final passed = dx < -8;
      final near = dx.abs() < 42;
      final p = ((1 - (dx + 8) / 50).clamp(0.0, 1.0));
      final pop = near ? 1 + 0.2 * math.sin(p * math.pi) : 1.0;

      canvas.save();
      canvas.translate(ix, pinY);
      if (near && !reduce) {
        canvas.drawCircle(
          Offset.zero,
          12 + p * 12,
          Paint()
            ..color = accent.withValues(alpha: 0.7 * (1 - p))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6,
        );
      }
      canvas.rotate(-angleDeg * math.pi / 180);
      canvas.scale(pop);
      canvas.drawCircle(
        Offset.zero,
        12,
        Paint()..color = passed ? accent : paper,
      );
      canvas.drawCircle(
        Offset.zero,
        12,
        Paint()
          ..color = passed ? accent : road1
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6,
      );
      if (passed) {
        final check = Path()
          ..moveTo(-4.4, 0.2)
          ..lineTo(-1.2, 3.4)
          ..lineTo(4.8, -3);
        canvas.drawPath(
          check,
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round,
        );
      } else {
        _drawGlyph(canvas, role, glyph);
      }
      canvas.restore();
    }

  // Ekspeditor / kassir — pin oralig‘idagi qadoq va tangalar.
  if ((role == 'expeditor' || role == 'cashier') && !reduce) {
    for (var k = -3; k <= 3; k++) {
      final ix = k * period - scroll + 84;
      final dx = ix - vx;
      final p = ((1 - (dx + 8) / 50).clamp(0.0, 1.0));
      if (p <= 0.02 || p >= 0.98) continue;
      final q = role == 'expeditor' ? p : 1 - p;
      final x = vx + (ix - vx) * q;
      final y = pinY * q - math.sin(q * math.pi) * 14;
      canvas.save();
      canvas.translate(x, y);
      if (role == 'expeditor') {
        canvas.rotate(q * 140 * math.pi / 180);
        final box = RRect.fromRectAndRadius(
          const Rect.fromLTWH(-4.6, -4.6, 9.2, 9.2),
          const Radius.circular(1.8),
        );
        canvas.drawRRect(box, Paint()..color = const Color(0xFFE9C27A));
        canvas.drawRRect(
          box,
          Paint()
            ..color = const Color(0xFFB98A3C)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.8,
        );
        canvas.drawRect(
          const Rect.fromLTWH(-1, -4.6, 2, 9.2),
          Paint()..color = const Color(0xFFB98A3C).withValues(alpha: 0.6),
        );
      } else {
        canvas.drawCircle(
          Offset.zero,
          4.4,
          Paint()..color = const Color(0xFFF6C945),
        );
        canvas.drawCircle(
          Offset.zero,
          4.4,
          Paint()
            ..color = const Color(0xFFC99A19)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.9,
        );
        canvas.drawCircle(
          Offset.zero,
          1.7,
          Paint()..color = const Color(0xFFC99A19).withValues(alpha: 0.55),
        );
      }
      canvas.restore();
    }
  }

    // Dust trail behind vehicle
    if (!reduce) {
      for (var j = 0; j < 3; j++) {
        final ph = (ms / 420 + j / 3) % 1;
        canvas.drawCircle(
          Offset(vx - 40 - ph * 30, (j - 1) * 3.0),
          2 + ph * 4.6,
          Paint()..color = dust.withValues(alpha: 0.26 * (1 - ph)),
        );
      }
    }

    // Supervisor radar rings
    if (role == 'supervisor' && !reduce) {
      for (final o in [0.0, 0.5]) {
        final ph = (ms / 1500 + o) % 1;
        canvas.drawCircle(
          Offset(vx, 0),
          22 + ph * 74,
          Paint()
            ..color = accent.withValues(alpha: 0.42 * (1 - ph))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.4,
        );
      }
    }

    // Vehicle
    canvas.save();
    canvas.translate(vx, bob);
    // Shadow
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(1, 6), width: 72, height: 30),
      Paint()..color = Colors.black.withValues(alpha: 0.16),
    );
    canvas.rotate(sway * math.pi / 180);
    _drawVehicle(canvas, role, accent, beat);
    canvas.restore();

    canvas.restore(); // angle
    canvas.restore(); // center/scale

    // Soft vignette (shablon radial mask)
    final r = math.min(size.width, size.height) * 0.58;
    final mask = Paint()
      ..blendMode = BlendMode.dstIn
      ..shader = RadialGradient(
        colors: [
          Colors.white,
          Colors.white.withValues(alpha: 0),
        ],
        stops: const [0.42, 1.0],
      ).createShader(Rect.fromCircle(center: Offset(cx, cy), radius: r));
    canvas.drawRect(Offset.zero & size, mask);
    canvas.restore(); // saveLayer
  }

  void _strokeRRect(
    Canvas canvas,
    Rect r,
    double radius,
    Color color,
    double width,
  ) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(r, Radius.circular(radius)),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = width,
    );
  }

  void _drawGlyph(Canvas canvas, String role, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.25
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final p = Path();
    switch (role) {
      case 'expeditor':
        p
          ..moveTo(-5, -2)
          ..lineTo(0, -4.6)
          ..lineTo(5, -2)
          ..lineTo(5, 3.4)
          ..lineTo(0, 6)
          ..lineTo(-5, 3.4)
          ..close()
          ..moveTo(-5, -2)
          ..lineTo(0, 0.6)
          ..lineTo(5, -2)
          ..moveTo(0, 0.6)
          ..lineTo(0, 6);
        break;
      case 'supervisor':
        p
          ..moveTo(-4.6, 5)
          ..quadraticBezierTo(-4.6, 0.6, 0, 0.6)
          ..quadraticBezierTo(4.6, 0.6, 4.6, 5);
        canvas.drawCircle(const Offset(0, -2.6), 2.3, paint);
        return;
      case 'cashier':
        p
          ..moveTo(-5.6, -1.6)
          ..lineTo(0, -5)
          ..lineTo(5.6, -1.6)
          ..moveTo(-4, -0.2)
          ..lineTo(-4, 3.6)
          ..moveTo(0, -0.2)
          ..lineTo(0, 3.6)
          ..moveTo(4, -0.2)
          ..lineTo(4, 3.6)
          ..moveTo(-5.6, 5)
          ..lineTo(5.6, 5);
        break;
      default: // agent store
        p
          ..moveTo(-5.6, -1)
          ..lineTo(-4.2, -5)
          ..lineTo(4.2, -5)
          ..lineTo(5.6, -1)
          ..moveTo(-4.6, -1)
          ..lineTo(-4.6, 5)
          ..lineTo(4.6, 5)
          ..lineTo(4.6, -1)
          ..moveTo(-1.5, 5)
          ..lineTo(-1.5, 1.6)
          ..lineTo(1.5, 1.6)
          ..lineTo(1.5, 5);
    }
    canvas.drawPath(p, paint);
  }

  void _drawVehicle(Canvas canvas, String role, Color accent, double beat) {
    const ink = Color(0xFF1A1F28);

    if (role == 'expeditor') {
      // Truck (top-down)
      for (final o in const [
        Offset(-25, -17),
        Offset(-25, 13),
        Offset(15, -16),
        Offset(15, 12),
      ]) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(o.dx, o.dy, 11, 4.4),
            const Radius.circular(1.6),
          ),
          Paint()..color = ink,
        );
      }
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(-33, -14.5, 45, 29),
          const Radius.circular(3.6),
        ),
        Paint()..color = accent,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(14, -13, 20, 26),
          const Radius.circular(6.4),
        ),
        Paint()
          ..color = Colors.white
          ..style = PaintingStyle.fill,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(14, -13, 20, 26),
          const Radius.circular(6.4),
        ),
        Paint()
          ..color = const Color(0xFFD5DAE1)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8,
      );
      return;
    }

    if (role == 'supervisor') {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(-27, -12.6, 54, 25.2),
          const Radius.circular(9.6),
        ),
        Paint()..color = accent,
      );
      canvas.drawCircle(
        const Offset(-3.4, 0),
        1.9,
        Paint()..color = Color.lerp(Colors.white, accent, 0.3 + beat * 0.5)!,
      );
      return;
    }

    if (role == 'cashier') {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(-31, -14, 60, 28),
          const Radius.circular(6.4),
        ),
        Paint()..color = accent,
      );
      canvas.drawCircle(
        const Offset(-8, 0),
        5,
        Paint()..color = const Color(0xFFF6C945),
      );
      return;
    }

    // Agent scooter (top-down) — shablon Scooter
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(20, -2.8, 11, 5.6),
        const Radius.circular(2.8),
      ),
      Paint()..color = ink,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-21, -2.8, 11, 5.6),
        const Radius.circular(2.8),
      ),
      Paint()..color = ink,
    );
    final deck = Path()
      ..moveTo(-17, -6.4)
      ..quadraticBezierTo(-17, -8.4, -13, -8.4)
      ..lineTo(11, -8.4)
      ..quadraticBezierTo(20, -6.4, 22.6, 0)
      ..quadraticBezierTo(20, 6.4, 11, 8.4)
      ..lineTo(-13, 8.4)
      ..quadraticBezierTo(-17, 8.4, -17, 6.4)
      ..close();
    canvas.drawPath(deck, Paint()..color = accent);
    // Cargo box
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-33, -9.6, 17, 19.2),
        const Radius.circular(3.8),
      ),
      Paint()..color = Colors.white,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-33, -9.6, 17, 19.2),
        const Radius.circular(3.8),
      ),
      Paint()
        ..color = const Color(0xFFD5DAE1)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.9,
    );
    canvas.drawRect(
      const Rect.fromLTWH(-33, -2.2, 17, 4.4),
      Paint()..color = accent.withValues(alpha: 0.9),
    );
    // Handlebars
    final bar = Paint()
      ..color = ink
      ..strokeWidth = 4.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(4, -7.4), const Offset(16.6, -11.4), bar);
    canvas.drawLine(const Offset(4, 7.4), const Offset(16.6, 11.4), bar);
    // Rider
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(1, 0), width: 16.8, height: 18.8),
      Paint()..color = ink,
    );
    // Stem
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(15.4, -13.4, 3.2, 26.8),
        const Radius.circular(1.6),
      ),
      Paint()..color = ink,
    );
    canvas.drawCircle(
      const Offset(17, -12.4),
      2.5,
      Paint()..color = const Color(0xFFF3F5F8),
    );
    canvas.drawCircle(
      const Offset(17, 12.4),
      2.5,
      Paint()..color = const Color(0xFFF3F5F8),
    );
    // Helmet plate
    canvas.drawCircle(
      const Offset(6.4, 0),
      5.8,
      Paint()..color = Colors.white,
    );
    canvas.drawCircle(
      const Offset(6.4, 0),
      5.8,
      Paint()
        ..color = const Color(0xFFD5DAE1)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.9,
    );
    canvas.drawCircle(const Offset(4.6, 0), 1.5, Paint()..color = accent);
  }

  @override
  bool shouldRepaint(covariant _RoadPainter old) =>
      old.ms != ms ||
      old.leaveMs != leaveMs ||
      old.accent != accent ||
      old.leaving != leaving ||
      old.role != role;
}

class SaBrandSyncWavePainter extends CustomPainter {
  final Color accent;
  const SaBrandSyncWavePainter({required this.accent});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final soft = Path()
      ..moveTo(0, h * 0.4)
      ..cubicTo(w * 0.25, h * 0.15, w * 0.55, h * 0.7, w, h * 0.28)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(soft, Paint()..color = const Color(0xFF2563EB));
    final main = Path()
      ..moveTo(0, h * 0.55)
      ..cubicTo(w * 0.3, h * 0.3, w * 0.6, h * 0.8, w, h * 0.42)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(main, Paint()..color = accent.withValues(alpha: 0.75));
  }

  @override
  bool shouldRepaint(covariant SaBrandSyncWavePainter old) => old.accent != accent;
}
