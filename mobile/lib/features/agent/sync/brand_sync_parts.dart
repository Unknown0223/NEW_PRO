import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

class BrandSyncStepRow extends StatelessWidget {
  final String label;
  final String kb;
  final bool ok;
  final bool now;
  final Color accent;

  const BrandSyncStepRow({
    super.key,
    required this.label,
    required this.kb,
    required this.ok,
    required this.now,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ok
            ? accent.withValues(alpha: 0.08)
            : Colors.white.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: ok ? accent.withValues(alpha: 0.22) : const Color(0xFFE4E9F0),
        ),
      ),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 280),
            width: 15,
            height: 15,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: ok
                  ? accent
                  : now
                      ? Color.lerp(accent, Colors.white, 0.35)!
                      : const Color(0xFFE2E7EE),
              shape: BoxShape.circle,
            ),
            child: ok
                ? const Icon(Icons.check, size: 10, color: Colors.white)
                : Container(
                    width: 4,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: Color(0xFF8A93A1),
                      shape: BoxShape.circle,
                    ),
                  ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: ok || now ? AppColors.textTitle : AppColors.textMuted,
              ),
            ),
          ),
          Text(
            kb,
            style: TextStyle(
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w600,
              color: ok ? accent : const Color(0xFF8A96A4),
            ),
          ),
        ],
      ),
    );
  }
}

class BrandSyncWavePainter extends CustomPainter {
  final Color brand;
  final Color accent;
  BrandSyncWavePainter({required this.brand, required this.accent});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final top = Path()
      ..moveTo(0, h * 0.4)
      ..cubicTo(w * 0.25, h * 0.15, w * 0.55, h * 0.7, w, h * 0.28)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(top, Paint()..color = brand);
    final bot = Path()
      ..moveTo(0, h * 0.55)
      ..cubicTo(w * 0.3, h * 0.35, w * 0.6, h * 0.8, w, h * 0.45)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(bot, Paint()..color = accent.withValues(alpha: 0.7));
  }

  @override
  bool shouldRepaint(covariant BrandSyncWavePainter old) =>
      old.brand != brand || old.accent != accent;
}

class BrandSyncSuccessBadge extends StatelessWidget {
  final Color accent;
  const BrandSyncSuccessBadge({super.key, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded, size: 14, color: Colors.white),
          ),
          const SizedBox(width: 8),
          Text(
            'Muvaffaqiyatli sinxronlandi',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: accent,
            ),
          ),
        ],
      ),
    );
  }
}
