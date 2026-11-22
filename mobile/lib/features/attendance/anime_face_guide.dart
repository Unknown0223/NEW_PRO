import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Shablondagi Face ID halqasi: qisqa kulrang chiziqlar, bosh burilganda
/// cho‘ziladigan yashil sektorlar va sfera yo‘naltiruvchi chiziqlari.
class AnimeFaceGuide extends StatelessWidget {
  const AnimeFaceGuide({
    super.key,
    required this.t,
    required this.tracked,
    required this.yaw,
    required this.pitch,
    required this.sectors,
    required this.failed,
  });

  /// 0–1, yuz topilmaganda yo‘riqnoma aylanasi.
  final double t;
  final bool tracked;

  /// ML Kit darajalari. Old kamera oynada teskari.
  final double yaw;
  final double pitch;
  final List<bool> sectors;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    final guide = !tracked && !failed;
    final orbit = t * 2 * math.pi;
    final showYaw = guide ? math.sin(orbit) * 26 : -yaw;
    final showPitch = guide ? -math.cos(orbit) * 18 : pitch;
    return CustomPaint(
      painter: _FaceIdRingPainter(
        yaw: showYaw,
        pitch: showPitch,
        sectors: sectors,
        guide: guide,
        t: t,
        failed: failed,
      ),
    );
  }
}

class _FaceIdRingPainter extends CustomPainter {
  _FaceIdRingPainter({
    required this.yaw,
    required this.pitch,
    required this.sectors,
    required this.guide,
    required this.t,
    required this.failed,
  });

  static const _ticks = 64;
  static const _green = Color(0xFF4CD964);
  static const _grey = Color(0xFF787880);
  static const _near = Color(0xFFA8E6B4);
  static const _cyan = Color(0xFF64D2FF);

  final double yaw;
  final double pitch;
  final List<bool> sectors;
  final bool guide;
  final double t;
  final bool failed;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.46);
    final radius = math.min(size.width, size.height) * 0.34;
    final hole = Path()
      ..addRect(Offset.zero & size)
      ..addOval(Rect.fromCircle(center: center, radius: radius))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(hole, Paint()..color = const Color(0xE6101218));

    final tilt = (math.sqrt(yaw * yaw + pitch * pitch) / 25).clamp(0.0, 1.0);
    final active = tilt > 0.12 ? (math.atan2(yaw, -pitch) * 180 / math.pi + 360) % 360 : null;

    _ticksOf(canvas, center, radius, active, tilt);
    _sphere(canvas, center, radius, active);
  }

  void _ticksOf(Canvas canvas, Offset center, double radius, double? active, double tilt) {
    final inner = radius + radius * 0.06;
    for (var i = 0; i < _ticks; i++) {
      final deg = i / _ticks * 360;
      final rad = (deg - 90) * math.pi / 180;
      final verified = !failed && i < sectors.length && sectors[i];
      var proximity = 0.0;
      if (active != null && tilt > 0.1) {
        final dist = _angDist(deg, active);
        if (dist < 28) proximity = (1 - dist / 28) * math.min(1, tilt * 1.25);
      }
      var len = radius * 0.045;
      if (verified) {
        len = radius * 0.16 + proximity * radius * 0.03;
      } else if (proximity > 0.15) {
        len = radius * 0.05 + proximity * radius * 0.09;
      }
      if (guide) {
        final sweep = (t * _ticks).floor() % _ticks;
        final d = (i - sweep).abs();
        final near = math.min(d, _ticks - d);
        if (near < 5) len = radius * (0.08 + (5 - near) * 0.018);
      }
      final dir = Offset(math.cos(rad), math.sin(rad));
      final color = failed
          ? const Color(0xFFFF6B6B)
          : verified
              ? _green
              : proximity > 0.35
                  ? _near
                  : _grey;
      canvas.drawLine(
        center + dir * inner,
        center + dir * (inner + len),
        Paint()
          ..color = color
          ..strokeWidth = math.max(2.2, radius * 0.018)
          ..strokeCap = StrokeCap.round,
      );
    }
    if (active != null && tilt > 0.2 && !failed) {
      final rad = (active - 90) * math.pi / 180;
      final dir = Offset(math.cos(rad), math.sin(rad));
      canvas.drawLine(
        center + dir * inner,
        center + dir * (inner + radius * 0.2),
        Paint()
          ..color = _green.withValues(alpha: 0.12 + 0.1 * tilt)
          ..strokeWidth = radius * 0.16
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
      );
    }
  }

  void _sphere(Canvas canvas, Offset center, double radius, double? active) {
    final eqY = center.dy + (pitch / 28) * radius * 0.32;
    final merX = center.dx + (yaw / 35) * radius * 0.34;
    final horiz = Paint()
      ..shader = const LinearGradient(
        colors: [
          Color(0x0D64D2FF),
          Color(0xD9FFFFFF),
          Color(0x0D64D2FF),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2;
    final equator = Path()
      ..moveTo(center.dx - radius, center.dy)
      ..quadraticBezierTo(center.dx, eqY + radius * 0.2, center.dx + radius, center.dy);
    final meridian = Path()
      ..moveTo(center.dx, center.dy - radius)
      ..quadraticBezierTo(merX, center.dy, center.dx, center.dy + radius);
    canvas.drawPath(equator, horiz);
    canvas.drawPath(meridian, horiz);

    canvas.drawOval(
      Rect.fromCenter(center: center, width: radius * 0.84, height: radius * 0.74),
      Paint()
        ..color = _cyan.withValues(alpha: guide ? 0.45 : 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.1,
    );

    final nose = Offset(merX, eqY.clamp(center.dy - radius, center.dy + radius));
    canvas.drawCircle(nose, 6.5, Paint()..color = _cyan.withValues(alpha: 0.75)..style = PaintingStyle.stroke..strokeWidth = 1.2);
    canvas.drawCircle(nose, 2.8, Paint()..color = Colors.white);

    if (active != null) {
      final rad = (active - 90) * math.pi / 180;
      final target = center + Offset(math.cos(rad), math.sin(rad)) * radius;
      canvas.drawLine(
        nose,
        target,
        Paint()
          ..color = _cyan.withValues(alpha: 0.7)
          ..strokeWidth = 1.4,
      );
      canvas.drawCircle(target, 3.5, Paint()..color = _green);
    }
  }

  double _angDist(double a, double b) {
    final d = ((a - b + 540) % 360) - 180;
    return d.abs();
  }

  @override
  bool shouldRepaint(_FaceIdRingPainter old) => true;
}

/// Bosh yetarli burilganda shu yo‘nalishdagi sektorlarni yondiradi.
void markFaceSectors(List<bool> sectors, double yaw, double pitch) {
  final designYaw = -yaw;
  final tilt = math.sqrt(designYaw * designYaw + pitch * pitch) / 24;
  if (tilt < 0.28 || sectors.length != 64) return;
  final deg = (math.atan2(designYaw, -pitch) * 180 / math.pi + 360) % 360;
  final tick = (deg / 360 * 64).round() % 64;
  for (var i = -1; i <= 1; i++) {
    sectors[(tick + i + 64) % 64] = true;
  }
}
