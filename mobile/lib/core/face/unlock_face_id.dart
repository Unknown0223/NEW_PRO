import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// SmoothUI Unlock Face ID glyph (MIT) — Flutter port.
enum UnlockFaceStatus { idle, scanning, success, error }

class UnlockFaceId extends StatefulWidget {
  const UnlockFaceId({
    super.key,
    required this.status,
    this.size = 128,
    this.errorMessage = 'Лицо не распознано. Попробуйте ещё раз.',
    this.showStatusText = true,
    this.onTap,
  });

  final UnlockFaceStatus status;
  final double size;
  final String errorMessage;
  final bool showStatusText;
  final VoidCallback? onTap;

  @override
  State<UnlockFaceId> createState() => _UnlockFaceIdState();
}

class _UnlockFaceIdState extends State<UnlockFaceId>
    with TickerProviderStateMixin {
  late final AnimationController _draw;
  late final AnimationController _scan;
  late final AnimationController _shake;
  late final AnimationController _check;

  @override
  void initState() {
    super.initState();
    _draw = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _scan = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _shake = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _check = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _applyStatus(widget.status);
  }

  @override
  void didUpdateWidget(covariant UnlockFaceId oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) {
      _applyStatus(widget.status);
    }
  }

  void _applyStatus(UnlockFaceStatus status) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (status == UnlockFaceStatus.scanning) {
      if (reduce) {
        _scan.value = 0.5;
      } else if (!_scan.isAnimating) {
        _scan.repeat(reverse: true);
      }
    } else {
      _scan
        ..stop()
        ..value = 0;
    }
    if (status == UnlockFaceStatus.error && !reduce) {
      _shake.forward(from: 0);
    }
    if (status == UnlockFaceStatus.success) {
      if (reduce) {
        _check.value = 1;
      } else {
        _check.forward(from: 0);
      }
    } else {
      _check.value = 0;
    }
  }

  @override
  void dispose() {
    _draw.dispose();
    _scan.dispose();
    _shake.dispose();
    _check.dispose();
    super.dispose();
  }

  String get _statusText {
    switch (widget.status) {
      case UnlockFaceStatus.idle:
        return 'Готово к сканированию.';
      case UnlockFaceStatus.scanning:
        return 'Сканирование лица…';
      case UnlockFaceStatus.success:
        return 'Личность подтверждена.';
      case UnlockFaceStatus.error:
        return widget.errorMessage;
    }
  }

  Color get _statusColor {
    switch (widget.status) {
      case UnlockFaceStatus.error:
        return const Color(0xFFEF4444);
      case UnlockFaceStatus.success:
        return const Color(0xFF22C55E);
      case UnlockFaceStatus.idle:
      case UnlockFaceStatus.scanning:
        return Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65);
    }
  }

  double _shakeOffset(double t) {
    const keys = [0.0, -7.0, 7.0, -5.0, 5.0, -2.0, 0.0];
    final p = t.clamp(0.0, 1.0) * (keys.length - 1);
    final i = p.floor().clamp(0, keys.length - 2);
    final f = p - i;
    return ui.lerpDouble(keys[i], keys[i + 1], f)!;
  }

  @override
  Widget build(BuildContext context) {
    final brand = Theme.of(context).colorScheme.primary;
    final stroke = widget.status == UnlockFaceStatus.error
        ? const Color(0xFFEF4444)
        : Theme.of(context).colorScheme.onSurface;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: widget.onTap,
          child: SizedBox(
            width: widget.size,
            height: widget.size,
            child: AnimatedBuilder(
              animation: Listenable.merge([_draw, _scan, _shake, _check]),
              builder: (context, _) {
                final shakeX = widget.status == UnlockFaceStatus.error
                    ? _shakeOffset(_shake.value)
                    : 0.0;
                return Transform.translate(
                  offset: Offset(shakeX, 0),
                  child: CustomPaint(
                    painter: _UnlockFacePainter(
                      drawProgress: Curves.easeOut.transform(_draw.value),
                      scanT: _scan.value,
                      checkT: Curves.easeOutBack.transform(_check.value),
                      status: widget.status,
                      stroke: stroke,
                      brand: brand,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        if (widget.showStatusText) ...[
          const SizedBox(height: 12),
          Text(
            _statusText,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _statusColor,
            ),
          ),
        ],
      ],
    );
  }
}

class _UnlockFacePainter extends CustomPainter {
  _UnlockFacePainter({
    required this.drawProgress,
    required this.scanT,
    required this.checkT,
    required this.status,
    required this.stroke,
    required this.brand,
  });

  final double drawProgress;
  final double scanT;
  final double checkT;
  final UnlockFaceStatus status;
  final Color stroke;
  final Color brand;

  static final _bracketPaths = [
    'M8 34 L8 28 A20 20 0 0 1 28 8 L34 8',
    'M66 8 L72 8 A20 20 0 0 1 92 28 L92 34',
    'M92 66 L92 72 A20 20 0 0 1 72 92 L66 92',
    'M34 92 L28 92 A20 20 0 0 1 8 72 L8 66',
  ].map(parseUnlockSvgPath).toList();

  static final _facePaths = [
    'M36 38 L36 47',
    'M64 38 L64 47',
    'M50 38 L50 54 Q50 57.5 53.5 57.5 L56 57.5',
    'M36 61 L36 66 Q50 73 64 66 L64 61',
  ].map(parseUnlockSvgPath).toList();

  static final _checkPath = parseUnlockSvgPath('M30 52 L44 66 L72 34');

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 100);

    if (status == UnlockFaceStatus.success) {
      final paint = Paint()
        ..color = const Color(0xFF22C55E)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      drawPathPortion(canvas, _checkPath, paint, checkT);
      return;
    }

    final paint = Paint()
      ..color = stroke
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (var i = 0; i < _bracketPaths.length; i++) {
      final local = ((drawProgress - i * 0.07) / 0.4).clamp(0.0, 1.0);
      drawPathPortion(canvas, _bracketPaths[i], paint, local);
    }
    for (var i = 0; i < _facePaths.length; i++) {
      final local = ((drawProgress - 0.26 - i * 0.07) / 0.42).clamp(0.0, 1.0);
      drawPathPortion(canvas, _facePaths[i], paint, local);
    }

    if (status == UnlockFaceStatus.scanning) {
      final bandY = 50 - 9 + (scanT * 2 - 1) * 34;
      canvas.save();
      canvas.clipRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(8, 8, 84, 84),
          const Radius.circular(22),
        ),
      );
      final rect = Rect.fromLTWH(8, bandY - 9, 84, 18);
      final shader = ui.Gradient.linear(
        Offset(rect.left, rect.top),
        Offset(rect.left, rect.bottom),
        [brand.withValues(alpha: 0), brand.withValues(alpha: 0.45)],
      );
      canvas.drawRect(rect, Paint()..shader = shader);
      canvas.drawLine(
        Offset(10, bandY + 9),
        Offset(90, bandY + 9),
        Paint()
          ..color = brand.withValues(alpha: 0.9)
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _UnlockFacePainter old) {
    return old.drawProgress != drawProgress ||
        old.scanT != scanT ||
        old.checkT != checkT ||
        old.status != status ||
        old.stroke != stroke ||
        old.brand != brand;
  }
}

@visibleForTesting
void drawPathPortion(Canvas canvas, Path full, Paint paint, double t) {
  if (t <= 0) return;
  if (t >= 1) {
    canvas.drawPath(full, paint);
    return;
  }
  final metrics = full.computeMetrics().toList();
  if (metrics.isEmpty) return;
  final total = metrics.fold<double>(0, (a, m) => a + m.length);
  var remain = total * t;
  final out = Path();
  for (final m in metrics) {
    if (remain <= 0) break;
    final take = math.min(m.length, remain);
    out.addPath(m.extractPath(0, take), Offset.zero);
    remain -= take;
  }
  canvas.drawPath(out, paint);
}

@visibleForTesting
Path parseUnlockSvgPath(String d) {
  final path = Path();
  final re = RegExp(r'([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)');
  final parts = re.allMatches(d).map((m) => m.group(0)!).toList();
  var i = 0;
  String? cmd;
  while (i < parts.length) {
    final p = parts[i];
    if (RegExp(r'^[MmLlHhVvCcSsQqTtAaZz]$').hasMatch(p)) {
      cmd = p;
      i += 1;
      continue;
    }
    if (cmd == null) {
      i += 1;
      continue;
    }
    double numAt(int idx) => double.parse(parts[idx]);
    switch (cmd) {
      case 'M':
      case 'L':
        final x = numAt(i);
        final y = numAt(i + 1);
        if (cmd == 'M') {
          path.moveTo(x, y);
          cmd = 'L';
        } else {
          path.lineTo(x, y);
        }
        i += 2;
        break;
      case 'Q':
        path.quadraticBezierTo(numAt(i), numAt(i + 1), numAt(i + 2), numAt(i + 3));
        i += 4;
        break;
      case 'A':
        final rx = numAt(i);
        final ry = numAt(i + 1);
        // skip x-axis-rotation at i+2
        final sweep = numAt(i + 4) == 1;
        final x = numAt(i + 5);
        final y = numAt(i + 6);
        path.arcToPoint(
          Offset(x, y),
          radius: Radius.elliptical(rx, ry),
          clockwise: !sweep,
        );
        i += 7;
        break;
      default:
        i += 1;
    }
  }
  return path;
}
