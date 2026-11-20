import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'role_road_math.dart';
import 'role_road_vehicles.dart';
import 'role_welcome_meta.dart';

/// Shablon SplashArt `RoadScene` — shakl/animatsiya; accent = ilova rangi.
class RoleRoadScene extends StatefulWidget {
  final String? role;
  final Color accent;
  final bool leaving;

  const RoleRoadScene({
    super.key,
    required this.role,
    required this.accent,
    this.leaving = false,
  });

  @override
  State<RoleRoadScene> createState() => _RoleRoadSceneState();
}

class _RoleRoadSceneState extends State<RoleRoadScene>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _elapsed = Duration.zero;
  Duration? _leaveAt;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((d) {
      _elapsed = d;
      setState(() {});
    })
      ..start();
  }

  @override
  void didUpdateWidget(covariant RoleRoadScene oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.leaving && !oldWidget.leaving) {
      _leaveAt = _elapsed;
    } else if (!widget.leaving) {
      _leaveAt = null;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _RoadPainter(
        role: widget.role ?? 'agent',
        accent: widget.accent,
        ms: _elapsed.inMilliseconds.toDouble(),
        leaveMs: _leaveAt?.inMilliseconds.toDouble(),
      ),
      child: const SizedBox.expand(),
    );
  }
}

class _RoadPainter extends CustomPainter {
  final String role;
  final Color accent;
  final double ms;
  final double? leaveMs;

  _RoadPainter({
    required this.role,
    required this.accent,
    required this.ms,
    required this.leaveMs,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const angle = roleRoadAngleRad;
    final enter = roleRoadEaseOut(
      roleRoadClamp01(ms / roleWelcomeRevealHold.inMilliseconds),
    );
    final exit = leaveMs == null
        ? 0.0
        : roleRoadEaseIn(roleRoadClamp01((ms - leaveMs!) / 700));
    final vx = -230 * (1 - enter) + exit * 320;
    final scroll = (ms * 0.085) % roleRoadPeriod;
    final sway = math.sin(ms / 270) * 1.5;
    final bob = math.sin(ms / 130) * 0.45;
    final beat = 0.5 + 0.5 * math.sin(ms / 260);
    final bright = Color.lerp(accent, Colors.white, 0.45)!;

    const road1 = Color(0xFFE2E5EA);
    const road2 = Color(0xFFECEEF2);
    const road3 = Color(0xFFF0F2F5);
    const paper = Colors.white;
    const glyphC = Color(0xFF5B6677);
    const dust = Color(0xFF9AA3B2);
    const cells = [-3, -2, -1, 0, 1, 2, 3];

    canvas.saveLayer(Offset.zero & size, Paint());
    roleRoadApplyViewBox(canvas, size);

    canvas.save();
    canvas.rotate(angle);
    for (final k in cells) {
      final x = k * roleRoadPeriod - scroll;
      canvas.drawRect(
        Rect.fromLTWH(x - 13, -300, 26, 600),
        Paint()..color = road2,
      );
      final stroke = Paint()
        ..color = road3
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x + 30, 44, 100, 84),
          const Radius.circular(5),
        ),
        stroke,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x + 36, -150, 88, 96),
          const Radius.circular(5),
        ),
        stroke,
      );
      canvas.drawRect(
        Rect.fromLTWH(x + 62, 150, 40, 120),
        Paint()..color = road3,
      );
    }
    canvas.drawRect(
      const Rect.fromLTWH(-420, -25, 840, 50),
      Paint()..color = road1,
    );
    final dash = Paint()
      ..color = paper
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    for (var x = -420.0; x < 420; x += 26) {
      final sx = x - (scroll % 26);
      canvas.drawLine(Offset(sx, 0), Offset(sx + 13, 0), dash);
    }

    for (final k in cells) {
      final ix = k * roleRoadPeriod - scroll + 84;
      final dx = ix - vx;
      final passed = dx < -8;
      final near = dx.abs() < 42;
      final p = roleRoadClamp01(1 - (dx + 8) / 50);
      final pop = near ? 1 + 0.2 * math.sin(p * math.pi) : 1.0;

      canvas.save();
      canvas.translate(ix, roleRoadPinY);
      if (near) {
        canvas.drawCircle(
          Offset.zero,
          12 + p * 12,
          Paint()
            ..color = accent.withValues(alpha: 0.7 * (1 - p))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6,
        );
      }
      canvas
        ..rotate(-angle)
        ..scale(pop);
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
        canvas.drawPath(
          Path()
            ..moveTo(-4.4, 0.2)
            ..lineTo(-1.2, 3.4)
            ..lineTo(4.8, -3),
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round,
        );
      } else {
        roleRoadDrawGlyph(
          canvas,
          role,
          Paint()
            ..color = glyphC
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.25
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round,
        );
      }
      canvas.restore();
    }

    // Expeditor boxes / cashier coins flying to pins.
    if (role == 'expeditor' || role == 'cashier' || role == 'operator') {
      for (final k in cells) {
        final ix = k * roleRoadPeriod - scroll + 84;
        final dx = ix - vx;
        final p = roleRoadClamp01(1 - (dx + 8) / 50);
        if (p <= 0.02 || p >= 0.98) continue;
        final q = role == 'expeditor' ? p : 1 - p;
        final x = vx + (ix - vx) * q;
        final y = roleRoadPinY * q - math.sin(q * math.pi) * 14;
        canvas.save();
        canvas.translate(x, y);
        if (role == 'expeditor') {
          canvas.rotate(q * 140 * math.pi / 180);
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              const Rect.fromLTWH(-4.6, -4.6, 9.2, 9.2),
              const Radius.circular(1.8),
            ),
            Paint()..color = const Color(0xFFE9C27A),
          );
        } else {
          canvas.drawCircle(
            Offset.zero,
            4.4,
            Paint()..color = const Color(0xFFF6C945),
          );
        }
        canvas.restore();
      }
    }

    canvas.save();
    canvas.translate(vx, bob);
    for (var j = 0; j < 3; j++) {
      final ph = (ms / 420 + j / 3) % 1;
      canvas.drawCircle(
        Offset(-40 - ph * 30, (j - 1) * 3.0),
        2 + ph * 4.6,
        Paint()..color = dust.withValues(alpha: 0.26 * (1 - ph)),
      );
    }
    if (role == 'supervisor') {
      for (final o in [0.0, 0.5]) {
        final ph = (ms / 1500 + o) % 1;
        canvas.drawCircle(
          Offset.zero,
          22 + ph * 74,
          Paint()
            ..color = accent.withValues(alpha: 0.42 * (1 - ph))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.4,
        );
      }
    }
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(1, 6), width: 72, height: 30),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.16)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.6),
    );
    canvas.rotate(sway * math.pi / 180);
    roleRoadDrawVehicle(
      canvas,
      role: role,
      accent: accent,
      onAccent: Colors.white,
      bright: bright,
      beat: beat,
    );
    canvas.restore();
    canvas.restore();

    // Radial fade in scene space (center = 0,0 after viewBox).
    canvas.drawRect(
      const Rect.fromLTWH(-200, -200, 400, 400),
      Paint()
        ..blendMode = BlendMode.dstIn
        ..shader = ui.Gradient.radial(
          Offset.zero,
          155,
          [Colors.white, Colors.white.withValues(alpha: 0)],
          const [0.42, 1.0],
        ),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _RoadPainter old) =>
      old.ms != ms ||
      old.leaveMs != leaveMs ||
      old.role != role ||
      old.accent != accent;
}
