import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'role_welcome_meta.dart';

/// Shablon RoadScene — rol transporti + yo‘l scroll (kirish/chiqish).
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
      if (widget.leaving && _leaveAt == null) _leaveAt = d;
      if (!widget.leaving) _leaveAt = null;
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
    final ms = _elapsed.inMilliseconds.toDouble();
    final leaveMs = _leaveAt?.inMilliseconds.toDouble();
    return CustomPaint(
      painter: _RoadPainter(
        role: widget.role ?? 'agent',
        accent: widget.accent,
        ms: ms,
        leaveMs: leaveMs,
      ),
      child: const SizedBox.expand(),
    );
  }
}

double _clamp01(double x) => x.clamp(0.0, 1.0);
double _easeOut(double x) => 1 - math.pow(1 - x, 3).toDouble();
double _easeIn(double x) => x * x * x;

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
    const period = 160.0;
    const angle = -32.0 * math.pi / 180;
    final enter = _easeOut(
      _clamp01(ms / roleWelcomeRevealHold.inMilliseconds),
    );
    final exit = leaveMs == null
        ? 0.0
        : _easeIn(_clamp01((ms - leaveMs!) / 700));
    final vx = -230 * (1 - enter) + exit * 320;
    final scroll = (ms * 0.085) % period;
    final sway = math.sin(ms / 270) * 1.5;
    final bob = math.sin(ms / 130) * 0.45;

    const road1 = Color(0xFFE2E5EA);
    const road2 = Color(0xFFECEEF2);
    const paper = Colors.white;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final scale = math.min(size.width, size.height) / 300;

    canvas.save();
    // Soft radial mask feel via clip oval.
    canvas.clipPath(
      Path()..addOval(Rect.fromCenter(center: Offset(cx, cy), width: size.width * 1.05, height: size.height * 1.05)),
    );
    canvas.translate(cx, cy);
    canvas.scale(scale);
    canvas.rotate(angle);

    for (var k = -3; k <= 3; k++) {
      final x = k * period - scroll;
      canvas.drawRect(
        Rect.fromLTWH(x - 13, -300, 26, 600),
        Paint()..color = road2,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x + 30, 44, 100, 84),
          const Radius.circular(5),
        ),
        Paint()
          ..color = const Color(0xFFF0F2F5)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 6,
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
      canvas.drawLine(
        Offset(x - scroll % 26, 0),
        Offset(x - scroll % 26 + 13, 0),
        dash,
      );
    }

    // Pins ahead of vehicle.
    for (var k = -2; k <= 3; k++) {
      final ix = k * period - scroll + 84;
      final dx = ix - vx;
      final passed = dx < -8;
      final near = dx.abs() < 42;
      canvas.save();
      canvas.translate(ix, -47);
      canvas.rotate(-angle);
      if (near) {
        final p = _clamp01(1 - (dx + 8) / 50);
        canvas.drawCircle(
          Offset.zero,
          12 + p * 12,
          Paint()
            ..color = accent.withValues(alpha: 0.35 * (1 - p))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6,
        );
      }
      canvas.drawCircle(
        Offset.zero,
        12,
        Paint()
          ..color = passed ? accent : paper
          ..style = PaintingStyle.fill,
      );
      canvas.drawCircle(
        Offset.zero,
        12,
        Paint()
          ..color = passed ? accent : road1
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6,
      );
      final icon = Paint()
        ..color = passed ? Colors.white : const Color(0xFF5B6677)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round;
      _drawRoleGlyph(canvas, role, icon);
      canvas.restore();
    }

    // Supervisor radar rings.
    if (role == 'supervisor') {
      for (final o in [0.0, 0.5]) {
        final ph = (ms / 1500 + o) % 1;
        canvas.drawCircle(
          Offset(vx, bob),
          22 + ph * 74,
          Paint()
            ..color = accent.withValues(alpha: 0.35 * (1 - ph))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.4,
        );
      }
    }

    // Vehicle.
    canvas.save();
    canvas.translate(vx, bob);
    canvas.rotate(sway * math.pi / 180);
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(1, 10), width: 72, height: 28),
      Paint()..color = Colors.black.withValues(alpha: 0.14),
    );
    _drawVehicle(canvas, role, accent);
    canvas.restore();
    canvas.restore();
  }

  void _drawRoleGlyph(Canvas canvas, String role, Paint p) {
    final path = Path();
    switch (role) {
      case 'expeditor':
        path
          ..moveTo(-5, -2)
          ..lineTo(0, -4.6)
          ..lineTo(5, -2)
          ..lineTo(5, 3.4)
          ..lineTo(0, 6)
          ..lineTo(-5, 3.4)
          ..close();
        break;
      case 'supervisor':
        path.addOval(Rect.fromCenter(center: const Offset(0, -2.6), width: 4.6, height: 4.6));
        path
          ..moveTo(-4.6, 5)
          ..quadraticBezierTo(-4.6, 0.6, 0, 0.6)
          ..quadraticBezierTo(4.6, 0.6, 4.6, 5);
        break;
      case 'cashier':
      case 'operator':
        path
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
      default:
        path
          ..moveTo(-5.6, -1)
          ..lineTo(-4.2, -5)
          ..lineTo(4.2, -5)
          ..lineTo(5.6, -1)
          ..moveTo(-4.6, -1)
          ..lineTo(-4.6, 5)
          ..lineTo(4.6, 5)
          ..lineTo(4.6, -1);
    }
    canvas.drawPath(path, p);
  }

  void _drawVehicle(Canvas canvas, String role, Color accent) {
    final body = Paint()..color = accent;
    final ink = Paint()..color = const Color(0xFF1A1F28);
    switch (role) {
      case 'expeditor':
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(-33, -14.5, 45, 29),
            const Radius.circular(3.6),
          ),
          body,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(14, -13, 20, 26),
            const Radius.circular(6.4),
          ),
          Paint()..color = Colors.white,
        );
        canvas.drawRect(const Rect.fromLTWH(14, -6.5, 8, 13), ink);
        break;
      case 'supervisor':
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(-27, -12.6, 54, 25.2),
            const Radius.circular(9.6),
          ),
          body,
        );
        canvas.drawCircle(const Offset(-3.4, 0), 3, Paint()..color = Colors.white);
        break;
      case 'cashier':
      case 'operator':
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(-31, -14, 60, 28),
            const Radius.circular(6.4),
          ),
          body,
        );
        canvas.drawCircle(
          const Offset(-8, 0),
          5,
          Paint()..color = const Color(0xFFF6C945),
        );
        break;
      default:
        // Scooter / agent.
        final scooter = Path()
          ..moveTo(-17, -6.4)
          ..quadraticBezierTo(-17, -8.4, -13, -8.4)
          ..lineTo(11, -8.4)
          ..quadraticBezierTo(20, -6.4, 22.6, 0)
          ..quadraticBezierTo(20, 6.4, 11, 8.4)
          ..lineTo(-13, 8.4)
          ..quadraticBezierTo(-17, 8.4, -17, 6.4)
          ..close();
        canvas.drawPath(scooter, body);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(-33, -9.6, 17, 19.2),
            const Radius.circular(3.8),
          ),
          Paint()..color = Colors.white,
        );
        canvas.drawCircle(const Offset(1, 0), 8.4, ink);
    }
  }

  @override
  bool shouldRepaint(covariant _RoadPainter old) =>
      old.ms != ms ||
      old.leaveMs != leaveMs ||
      old.role != role ||
      old.accent != accent;
}
