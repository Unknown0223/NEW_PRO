import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'role_road_math.dart';

/// SplashArt Truck / Scooter / Car / Van — shakllar to‘liq; fill = ilova accent.
void roleRoadDrawVehicle(
  Canvas canvas, {
  required String role,
  required Color accent,
  required Color onAccent,
  required Color bright,
  required double beat,
}) {
  switch (role) {
    case 'expeditor':
      _truck(canvas, accent, onAccent);
      break;
    case 'supervisor':
      _car(canvas, accent, bright, beat);
      break;
    case 'cashier':
    case 'operator':
      _van(canvas, accent, onAccent);
      break;
    default:
      _scooter(canvas, accent);
  }
}

void _rrect(Canvas c, double x, double y, double w, double h, double r, Paint p) {
  c.drawRRect(
    RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)),
    p,
  );
}

void _scooter(Canvas canvas, Color accent) {
  final ink = Paint()..color = roleRoadInk;
  final body = Paint()..color = accent;
  _rrect(canvas, 20, -2.8, 11, 5.6, 2.8, ink);
  _rrect(canvas, -21, -2.8, 11, 5.6, 2.8, ink);
  final deck = Path()
    ..moveTo(-17, -6.4)
    ..quadraticBezierTo(-17, -8.4, -13, -8.4)
    ..lineTo(11, -8.4)
    ..quadraticBezierTo(20, -6.4, 22.6, 0)
    ..quadraticBezierTo(20, 6.4, 11, 8.4)
    ..lineTo(-13, 8.4)
    ..quadraticBezierTo(-17, 8.4, -17, 6.4)
    ..close();
  canvas.drawPath(deck, body);
  final shine = Path()
    ..moveTo(-13, -8.4)
    ..lineTo(11, -8.4)
    ..quadraticBezierTo(18, -7, 21, -2)
    ..lineTo(-17, -2)
    ..lineTo(-17, -6.4)
    ..quadraticBezierTo(-17, -8.4, -13, -8.4)
    ..close();
  canvas.drawPath(shine, Paint()..color = Colors.white.withValues(alpha: 0.2));
  _rrect(canvas, -33, -9.6, 17, 19.2, 3.8, Paint()..color = Colors.white);
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
  final arm = Paint()
    ..color = roleRoadInk
    ..strokeWidth = 4.2
    ..strokeCap = StrokeCap.round
    ..style = PaintingStyle.stroke;
  canvas
    ..drawLine(const Offset(4, -7.4), const Offset(16.6, -11.4), arm)
    ..drawLine(const Offset(4, 7.4), const Offset(16.6, 11.4), arm);
  canvas.drawOval(
    Rect.fromCenter(center: const Offset(1, 0), width: 16.8, height: 18.8),
    ink,
  );
  _rrect(canvas, 15.4, -13.4, 3.2, 26.8, 1.6, ink);
  canvas.drawCircle(const Offset(17, -12.4), 2.5, Paint()..color = const Color(0xFFF3F5F8));
  canvas.drawCircle(
    const Offset(17, -12.4),
    2.5,
    Paint()
      ..color = roleRoadInk
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8,
  );
  canvas.drawCircle(const Offset(17, 12.4), 2.5, Paint()..color = const Color(0xFFF3F5F8));
  canvas.drawCircle(
    const Offset(17, 12.4),
    2.5,
    Paint()
      ..color = roleRoadInk
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8,
  );
  canvas.drawCircle(const Offset(6.4, 0), 5.8, Paint()..color = Colors.white);
  canvas.drawCircle(
    const Offset(6.4, 0),
    5.8,
    Paint()
      ..color = const Color(0xFFD5DAE1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.9,
  );
  final grip = Path()
    ..moveTo(9.6, -4)
    ..quadraticBezierTo(12.4, 0, 9.6, 4);
  canvas.drawPath(
    grip,
    Paint()
      ..color = roleRoadInk
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round,
  );
  canvas.drawCircle(const Offset(4.6, 0), 1.5, body);
}

void _truck(Canvas canvas, Color accent, Color onAccent) {
  final ink = Paint()..color = roleRoadInk;
  for (final p in [
    [-25.0, -17.0],
    [-25.0, 13.0],
    [15.0, -16.0],
    [15.0, 12.0],
  ]) {
    _rrect(canvas, p[0], p[1], 11, 4.4, 1.6, ink);
  }
  canvas.drawRect(const Rect.fromLTWH(10, -6.5, 5, 13), ink);
  _rrect(canvas, -33, -14.5, 45, 29, 3.6, Paint()..color = accent);
  _rrect(
    canvas,
    -33,
    -14.5,
    45,
    13,
    3.6,
    Paint()..color = Colors.white.withValues(alpha: 0.22),
  );
  canvas
    ..drawLine(
      const Offset(-18, -14.5),
      const Offset(-18, 14.5),
      Paint()..color = Colors.black.withValues(alpha: 0.1),
    )
    ..drawLine(
      const Offset(-3, -14.5),
      const Offset(-3, 14.5),
      Paint()..color = Colors.black.withValues(alpha: 0.1),
    );
  canvas.save();
  canvas
    ..translate(-10.5, 0)
    ..rotate(math.pi / 2);
  final mark = Paint()
    ..color = onAccent
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;
  canvas
    ..drawPath(
      Path()
        ..moveTo(-6.4, 3.6)
        ..lineTo(-3, -1.2)
        ..lineTo(0, 1),
      mark,
    )
    ..drawPath(
      Path()
        ..moveTo(0, 1)
        ..lineTo(5.4, -4.8),
      mark,
    );
  canvas.drawPath(
    Path()
      ..moveTo(2.6, -5.4)
      ..lineTo(6.4, -6)
      ..lineTo(5, -2.4)
      ..close(),
    Paint()..color = onAccent,
  );
  canvas.restore();
  _rrect(canvas, -34.2, -11, 1.8, 5, 0.9, Paint()..color = const Color(0xFFEF4444));
  _rrect(canvas, -34.2, 6, 1.8, 5, 0.9, Paint()..color = const Color(0xFFEF4444));
  _rrect(canvas, 14, -13, 20, 26, 6.4, Paint()..color = Colors.white);
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
  final glass = Path()
    ..moveTo(24.5, -10.4)
    ..quadraticBezierTo(32, -9, 32, 0)
    ..quadraticBezierTo(32, 9, 24.5, 10.4)
    ..close();
  canvas.drawPath(glass, Paint()..color = roleRoadGlass);
  _rrect(canvas, 16.4, -9.4, 7, 18.8, 2.2, Paint()..color = const Color(0xFFEEF1F5));
  _rrect(canvas, 20.5, -16, 4.4, 3.2, 1.2, ink);
  _rrect(canvas, 20.5, 12.8, 4.4, 3.2, 1.2, ink);
  _rrect(canvas, 33, -10.4, 2, 4.4, 1, Paint()..color = const Color(0xFFFFE39A));
  _rrect(canvas, 33, 6, 2, 4.4, 1, Paint()..color = const Color(0xFFFFE39A));
}

void _car(Canvas canvas, Color accent, Color bright, double beat) {
  final ink = Paint()..color = roleRoadInk;
  for (final p in [
    [-19.0, -15.0],
    [-19.0, 11.4],
    [11.0, -15.0],
    [11.0, 11.4],
  ]) {
    _rrect(canvas, p[0], p[1], 9, 3.6, 1.4, ink);
  }
  _rrect(canvas, -27, -12.6, 54, 25.2, 9.6, Paint()..color = accent);
  _rrect(
    canvas,
    -27,
    -12.6,
    54,
    11,
    9.6,
    Paint()..color = Colors.white.withValues(alpha: 0.16),
  );
  final glass = Path()
    ..moveTo(7, -9.6)
    ..quadraticBezierTo(15.4, -8.6, 15.4, 0)
    ..quadraticBezierTo(15.4, 8.6, 7, 9.6)
    ..lineTo(3.6, 7.6)
    ..lineTo(3.6, -7.6)
    ..close();
  canvas.drawPath(glass, Paint()..color = roleRoadGlass);
  _rrect(canvas, 2.4, -15.4, 4, 3, 1.2, ink);
  _rrect(canvas, 2.4, 12.4, 4, 3, 1.2, ink);
  _rrect(canvas, 25.4, -9.6, 2, 4.4, 1, Paint()..color = const Color(0xFFFFE39A));
  _rrect(canvas, 25.4, 5.2, 2, 4.4, 1, Paint()..color = const Color(0xFFFFE39A));
  _rrect(canvas, -27.6, -9, 1.8, 4.4, 0.9, Paint()..color = const Color(0xFFEF4444));
  _rrect(canvas, -27.6, 4.6, 1.8, 4.4, 0.9, Paint()..color = const Color(0xFFEF4444));
  canvas.drawCircle(const Offset(-3.4, 0), 3, Paint()..color = Colors.white);
  canvas.drawCircle(
    const Offset(-3.4, 0),
    1.9,
    Paint()..color = bright.withValues(alpha: 0.5 + beat * 0.5),
  );
}

void _van(Canvas canvas, Color accent, Color onAccent) {
  final ink = Paint()..color = roleRoadInk;
  for (final p in [
    [-23.0, -16.6],
    [-23.0, 12.6],
    [13.0, -16.0],
    [13.0, 12.0],
  ]) {
    _rrect(canvas, p[0], p[1], 10, 4, 1.5, ink);
  }
  _rrect(canvas, -31, -14, 60, 28, 6.4, Paint()..color = accent);
  _rrect(
    canvas,
    -31,
    -14,
    60,
    12,
    6.4,
    Paint()..color = Colors.white.withValues(alpha: 0.16),
  );
  final glass = Path()
    ..moveTo(17, -11)
    ..quadraticBezierTo(26.4, -9.6, 26.4, 0)
    ..quadraticBezierTo(26.4, 9.6, 17, 11)
    ..close();
  canvas.drawPath(glass, Paint()..color = roleRoadGlass);
  canvas.drawLine(
    const Offset(-24, -14),
    const Offset(-24, 14),
    Paint()..color = Colors.black.withValues(alpha: 0.14),
  );
  canvas.drawCircle(
    const Offset(-8, 0),
    8,
    Paint()
      ..color = onAccent.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2,
  );
  canvas.drawCircle(const Offset(-8, 0), 5, Paint()..color = const Color(0xFFF6C945));
  canvas.drawCircle(
    const Offset(-8, 0),
    5,
    Paint()
      ..color = const Color(0xFFC99A19)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.9,
  );
  _rrect(canvas, 14, -16.8, 4.2, 3, 1.2, ink);
  _rrect(canvas, 14, 13.8, 4.2, 3, 1.2, ink);
  _rrect(canvas, 27.6, -10.6, 2, 4.4, 1, Paint()..color = const Color(0xFFFFE39A));
  _rrect(canvas, 27.6, 6.2, 2, 4.4, 1, Paint()..color = const Color(0xFFFFE39A));
  _rrect(canvas, -32, -10, 1.8, 5, 0.9, Paint()..color = const Color(0xFFEF4444));
  _rrect(canvas, -32, 5, 1.8, 5, 0.9, Paint()..color = const Color(0xFFEF4444));
}

void roleRoadDrawGlyph(Canvas canvas, String role, Paint stroke) {
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
        ..close()
        ..moveTo(-5, -2)
        ..lineTo(0, 0.6)
        ..lineTo(5, -2)
        ..moveTo(0, 0.6)
        ..lineTo(0, 6);
      break;
    case 'supervisor':
      path
        ..moveTo(-4.6, 5)
        ..quadraticBezierTo(-4.6, 0.6, 0, 0.6)
        ..quadraticBezierTo(4.6, 0.6, 4.6, 5);
      path.addOval(
        Rect.fromCenter(center: const Offset(0, -2.6), width: 4.6, height: 4.6),
      );
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
      // Agent: uy / savdo nuqtasi.
      path
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
  canvas.drawPath(path, stroke);
}
