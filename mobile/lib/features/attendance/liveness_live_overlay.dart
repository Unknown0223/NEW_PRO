import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'liveness_challenge.dart';

/// HR Hub kamera sahna: cover preview + oval + strelka + chip lar.
class LivenessPreviewStage extends StatelessWidget {
  const LivenessPreviewStage({
    super.key,
    required this.controller,
    required this.anim,
    required this.tone,
    required this.faces,
    required this.failed,
    required this.passed,
    required this.capturing,
    required this.turning,
    required this.turnProgress,
  });

  final CameraController controller;
  final Animation<double> anim;
  final Color tone;
  final int faces;
  final bool failed;
  final bool passed;
  final bool capturing;
  final HeadDirection? turning;
  final double turnProgress;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: tone.withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          fit: StackFit.expand,
          children: [
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: controller.value.previewSize?.height ?? 480,
                height: controller.value.previewSize?.width ?? 640,
                child: CameraPreview(controller),
              ),
            ),
            IgnorePointer(
              child: AnimatedBuilder(
                animation: anim,
                builder: (_, __) => CustomPaint(
                  painter: LivenessFaceGuidePainter(
                    color: tone,
                    t: anim.value,
                    scanning: faces == 1 && !failed,
                  ),
                ),
              ),
            ),
            if (turning != null)
              LivenessDirectionArrow(
                direction: turning!,
                anim: anim,
                progress: turnProgress,
              ),
            Positioned(
              top: 12,
              left: 12,
              child: LivenessGlassChip(
                icon: faces == 1
                    ? Icons.face_retouching_natural
                    : faces > 1
                        ? Icons.group_rounded
                        : Icons.face_outlined,
                text: faces == 1
                    ? 'Лицо найдено'
                    : faces > 1
                        ? '$faces лица'
                        : 'Поиск лица…',
                color: faces == 1 ? AppColors.primaryLight : Colors.white,
              ),
            ),
            const Positioned(
              top: 12,
              right: 12,
              child: LivenessGlassChip(
                icon: Icons.lock_rounded,
                text: 'Живая проверка',
                color: Colors.white,
              ),
            ),
            if (capturing || passed) const LivenessCaptureFlash(),
          ],
        ),
      ),
    );
  }
}

/// HR Hub oval ramka + skan chizig‘i.
class LivenessFaceGuidePainter extends CustomPainter {
  LivenessFaceGuidePainter({
    required this.color,
    required this.t,
    required this.scanning,
  });

  final Color color;
  final double t;
  final bool scanning;

  @override
  void paint(Canvas canvas, Size size) {
    final oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.46),
      width: size.width * 0.64,
      height: size.height * 0.6,
    );
    final shade = Path()
      ..addRect(Offset.zero & size)
      ..addOval(oval)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(shade, Paint()..color = const Color(0x8C101218));

    canvas.drawOval(
      oval.inflate(6),
      Paint()
        ..color = color.withValues(alpha: 0.35 + 0.25 * math.sin(t * 2 * math.pi).abs())
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.drawOval(
      oval,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.85)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    if (scanning) {
      final sweep = Paint()
        ..shader = SweepGradient(
          colors: [color.withValues(alpha: 0), color, color.withValues(alpha: 0)],
          stops: const [0.0, 0.5, 1.0],
          transform: GradientRotation(t * 2 * math.pi),
        ).createShader(oval)
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 5;
      canvas.drawArc(oval, t * 2 * math.pi, math.pi * 0.9, false, sweep);

      canvas.save();
      canvas.clipPath(Path()..addOval(oval));
      final y = oval.top + oval.height * (0.5 + 0.5 * math.sin(t * 2 * math.pi));
      canvas.drawRect(
        Rect.fromLTWH(oval.left, y - 18, oval.width, 36),
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              color.withValues(alpha: 0),
              color.withValues(alpha: 0.28),
              color.withValues(alpha: 0),
            ],
          ).createShader(Rect.fromLTWH(oval.left, y - 18, oval.width, 36)),
      );
      canvas.restore();
    } else {
      canvas.drawOval(
        oval,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4,
      );
    }
  }

  @override
  bool shouldRepaint(LivenessFaceGuidePainter old) =>
      old.t != t || old.color != color || old.scanning != scanning;
}

/// HR Hub katta strelka + burish progressi.
class LivenessDirectionArrow extends StatelessWidget {
  const LivenessDirectionArrow({
    super.key,
    required this.direction,
    required this.anim,
    required this.progress,
  });

  final HeadDirection direction;
  final Animation<double> anim;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final v = direction.screenVector;
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: anim,
        builder: (_, __) {
          final bounce = 10 * math.sin(anim.value * 2 * math.pi).abs();
          return Align(
            alignment: Alignment(v.dx * 0.82, -0.08 + v.dy * 0.78),
            child: Transform.translate(
              offset: v * bounce,
              child: SizedBox(
                width: 78,
                height: 78,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox.expand(
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(end: progress),
                        duration: const Duration(milliseconds: 180),
                        builder: (_, value, __) => CircularProgressIndicator(
                          value: value,
                          strokeWidth: 5,
                          color: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.25),
                        ),
                      ),
                    ),
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primary,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.6),
                            blurRadius: 18,
                          ),
                        ],
                      ),
                      child: Icon(direction.icon, color: Colors.white, size: 36),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class LivenessGlassChip extends StatelessWidget {
  const LivenessGlassChip({
    super.key,
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 5),
          Text(
            text,
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class LivenessCaptureFlash extends StatelessWidget {
  const LivenessCaptureFlash({super.key});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.9, end: 0.35),
      duration: const Duration(milliseconds: 500),
      builder: (_, v, child) => ColoredBox(
        color: Colors.white.withValues(alpha: v),
        child: child,
      ),
      child: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.verified_rounded, color: AppColors.primary, size: 72),
            SizedBox(height: 8),
            Text(
              'Подтверждено',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: Color(0xFF13202B),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
