import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens/sa_motion.dart';
import 'sa_brand.dart';
import 'sa_brand_sync_road.dart';
import 'sa_motion.dart';

/// Shablon `BrandSync.tsx` — to‘liq ekran sinxron (yo‘l, brand, wave, qadamlar).
enum SaBrandSyncVariant { identity, quick, full }

class SaBrandSyncMeta {
  final String title;
  final String hint;
  final List<({String label, String kb})> steps;

  const SaBrandSyncMeta({
    required this.title,
    required this.hint,
    required this.steps,
  });

  static SaBrandSyncMeta of(SaBrandSyncVariant v) => switch (v) {
        SaBrandSyncVariant.identity => const SaBrandSyncMeta(
            title: 'Rol kartasi yangilanmoqda',
            hint: 'Profil, rasm va ruxsatlar tekshiriladi',
            steps: [
              (label: 'Profil rasmi', kb: '18 KB'),
              (label: 'Telefon raqami', kb: '1 yozuv'),
              (label: 'Ruxsatlar va GPS', kb: '4 ta'),
              (label: 'Sessiya kaliti', kb: 'yangi'),
            ],
          ),
        SaBrandSyncVariant.quick => const SaBrandSyncMeta(
            title: 'Oddiy sinxronlash',
            hint: "Faqat o'zgargan yozuvlar yuboriladi",
            steps: [
              (label: 'Farqni topish', kb: '3 yozuv'),
              (label: 'Buyurtmalar', kb: '2 ta'),
              (label: 'Foto hisobotlar', kb: '1.4 MB'),
              (label: 'Tasdiq qabul qilish', kb: 'ok'),
            ],
          ),
        SaBrandSyncVariant.full => const SaBrandSyncMeta(
            title: "To'liq sinxronlash",
            hint: "Kesh to'liq yangilanadi",
            steps: [
              (label: 'Savdo nuqtalari', kb: '342'),
              (label: 'Katalog va narxlar', kb: '1 208'),
              (label: 'Ombor qoldiqlari', kb: '3 ombor'),
              (label: 'Bonus va skidka', kb: '6 qoida'),
              (label: 'Buyurtmalar', kb: '24 ta'),
              (label: 'Foto hisobotlar', kb: '8 ta'),
              (label: 'Marshrut va tabel', kb: '12 vizit'),
            ],
          ),
      };
}

String saBrandSyncRoleWord(String? role) {
  switch ((role ?? 'agent').toLowerCase()) {
    case 'expeditor':
      return 'Dastavka';
    case 'supervisor':
      return 'Nazorat';
    case 'cashier':
      return 'Kassa';
    default:
      return 'Agent';
  }
}

/// Full-screen BrandSync overlay — shablon 1:1 tuzilma.
class SaBrandSync extends StatelessWidget {
  final SaBrandSyncVariant variant;
  final String? role;
  final double progress;
  final int? stepIndex;
  final bool done;
  final VoidCallback? onContinue;
  final VoidCallback? onClose;
  final VoidCallback? onRetry;
  final Color accent;

  const SaBrandSync({
    super.key,
    required this.variant,
    required this.progress,
    this.stepIndex,
    this.role,
    this.done = false,
    this.onContinue,
    this.onClose,
    this.onRetry,
    this.accent = SaBrand.blue,
  });

  @override
  Widget build(BuildContext context) {
    final meta = SaBrandSyncMeta.of(variant);
    final pct = (progress.clamp(0.0, 1.0) * 100).round();
    final stepIdx = done
        ? meta.steps.length
        : stepIndex != null
            ? stepIndex!.clamp(0, meta.steps.length - 1)
            : (progress.clamp(0.0, 0.999) * meta.steps.length).floor();
    final roleWord = saBrandSyncRoleWord(role);
    final reduce = saReduceMotion(context);
    final waveH = 0.14 + progress.clamp(0.0, 1.0) * 0.86;

    return Material(
      color: Colors.transparent,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: const Alignment(-0.2, -1),
                end: const Alignment(0.3, 1),
                colors: [
                  Color.lerp(Colors.white, accent, 0.12)!,
                  const Color(0xFFFBFCFE),
                  Color.lerp(Colors.white, accent, 0.07)!,
                ],
              ),
            ),
          ),
          Positioned(
            right: -64,
            top: -64,
            child: _Orb(color: accent.withValues(alpha: 0.18), size: 180),
          ),
          Positioned(
            left: -48,
            top: MediaQuery.sizeOf(context).height * 0.28,
            child: _Orb(color: accent.withValues(alpha: 0.12), size: 140),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: AnimatedContainer(
              duration: reduce ? Duration.zero : SaDurations.base,
              curve: SaCurves.standard,
              height: MediaQuery.sizeOf(context).height * waveH,
              width: double.infinity,
              child: Opacity(
                opacity: 0.16,
                child: CustomPaint(
                  painter: SaBrandSyncWavePainter(accent: accent),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Header(roleWord: roleWord, onClose: onClose, done: done, onContinue: onContinue),
                _RoadCard(role: role, accent: accent, done: done, pct: pct),
                _TitleBlock(done: done, meta: meta, variant: variant),
                _ProgressBlock(
                  variant: variant,
                  pct: pct,
                  progress: progress,
                  accent: accent,
                  reduce: reduce,
                  done: done,
                ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    itemCount: meta.steps.length,
                    itemBuilder: (context, i) {
                      final s = meta.steps[i];
                      final ok = i < stepIdx || done;
                      final now = i == stepIdx && !done;
                      return SaEnter(
                        delay: SaStaggerDelay.of(i),
                        preset: SaMotionPreset.rise,
                        child: _StepRow(
                          label: s.label,
                          kb: s.kb,
                          ok: ok,
                          now: now,
                          accent: accent,
                        ),
                      );
                    },
                  ),
                ),
                if (done) _SuccessBadge(accent: accent, reduce: reduce),
                _Footer(
                  done: done,
                  accent: accent,
                  variant: variant,
                  onContinue: onContinue,
                  onRetry: onRetry ?? onContinue,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String roleWord;
  final VoidCallback? onClose;
  final VoidCallback? onContinue;
  final bool done;

  const _Header({
    required this.roleWord,
    required this.done,
    this.onClose,
    this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 12, 0),
      child: Row(
        children: [
          const SaBrandMark(size: 28, draw: true),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SaBrandWordmark(size: 14),
                Text(
                  'SINXRONLASH · ${roleWord.toUpperCase()}',
                  style: const TextStyle(
                    fontSize: 8,
                    letterSpacing: 1.4,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF7A8697),
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          if (onClose != null)
            SaPressable(
              onTap: () {
                if (done) {
                  onContinue?.call();
                } else {
                  onClose?.call();
                }
              },
              borderRadius: BorderRadius.circular(99),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.9),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFE2E7EE)),
                ),
                child: const Icon(Icons.close, size: 16, color: Color(0xFF465060)),
              ),
            ),
        ],
      ),
    );
  }
}

class _RoadCard extends StatelessWidget {
  final String? role;
  final Color accent;
  final bool done;
  final int pct;

  const _RoadCard({
    required this.role,
    required this.accent,
    required this.done,
    required this.pct,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        height: 132,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE3E8EF)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            SaBrandSyncRoadScene(role: role, accent: accent, leaving: done),
            Positioned(
              right: 8,
              top: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SaLiveDot(
                      color: done ? const Color(0xFF22B573) : const Color(0xFFFBBF24),
                      size: 5,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      done ? 'TAYYOR' : '$pct%',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TitleBlock extends StatelessWidget {
  final bool done;
  final SaBrandSyncMeta meta;
  final SaBrandSyncVariant variant;

  const _TitleBlock({
    required this.done,
    required this.meta,
    required this.variant,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Column(
        children: [
          Text(
            done ? 'Sinxronlash yakunlandi' : meta.title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
              color: Color(0xFF0E1420),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            done
                ? '${meta.steps.length} bosqich · ${switch (variant) {
                    SaBrandSyncVariant.full => '18.4 MB',
                    SaBrandSyncVariant.quick => '1.6 MB',
                    SaBrandSyncVariant.identity => '0.2 MB',
                  }} · 0 xato'
                : meta.hint,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: Color(0xFF66717E)),
          ),
        ],
      ),
    );
  }
}

class _ProgressBlock extends StatelessWidget {
  final SaBrandSyncVariant variant;
  final int pct;
  final double progress;
  final Color accent;
  final bool reduce;
  final bool done;

  const _ProgressBlock({
    required this.variant,
    required this.pct,
    required this.progress,
    required this.accent,
    required this.reduce,
    required this.done,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.storage_outlined, size: 12, color: Color(0xFF7A8697)),
              const SizedBox(width: 4),
              Text(
                variant == SaBrandSyncVariant.identity ? 'profil' : 'lokal kesh',
                style: const TextStyle(
                  fontSize: 10,
                  color: Color(0xFF7A8697),
                  fontFamily: 'monospace',
                ),
              ),
              const Spacer(),
              Text(
                '$pct%',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: accent,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
              duration: reduce ? Duration.zero : SaDurations.base,
              curve: SaCurves.standard,
              builder: (_, v, child) {
                final active = done || reduce;
                return SizedBox(
                  height: 5,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(color: const Color(0xFFE8EDF3)),
                      if (v > 0)
                        FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: v,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(99),
                              gradient: LinearGradient(
                                colors: active
                                    ? [accent, Color.lerp(accent, SaBrand.bright, 0.45)!]
                                    : [SaBrand.blue, Color.lerp(SaBrand.blue, SaBrand.bright, 0.35)!],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StepRow extends StatefulWidget {
  final String label;
  final String kb;
  final bool ok;
  final bool now;
  final Color accent;

  const _StepRow({
    required this.label,
    required this.kb,
    required this.ok,
    required this.now,
    required this.accent,
  });

  @override
  State<_StepRow> createState() => _StepRowState();
}

class _StepRowState extends State<_StepRow> {
  int _checkKey = 0;

  @override
  void didUpdateWidget(covariant _StepRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.ok && !oldWidget.ok) {
      _checkKey++;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ok = widget.ok;
    final now = widget.now;
    final accent = widget.accent;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: AnimatedOpacity(
        duration: SaDurations.press,
        opacity: ok || now ? 1 : 0.5,
        child: AnimatedContainer(
          duration: SaDurations.press,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: ok ? accent.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: ok ? accent.withValues(alpha: 0.22) : const Color(0xFFE4E9F0),
            ),
            boxShadow: ok
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              Container(
                width: 16,
                height: 16,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: ok
                      ? accent
                      : now
                          ? SaBrand.bright
                          : const Color(0xFFE2E7EE),
                  shape: BoxShape.circle,
                ),
                child: ok
                    ? SaPopIn(
                        key: ValueKey(_checkKey),
                        child: const Icon(Icons.check_rounded, size: 10, color: Colors.white),
                      )
                    : Container(
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(
                          color: now ? accent : const Color(0xFF8A96A4),
                          shape: BoxShape.circle,
                        ),
                      ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0E1420),
                  ),
                ),
              ),
              Text(
                ok ? widget.kb : '···',
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: ok ? accent : const Color(0xFF8A96A4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuccessBadge extends StatelessWidget {
  final Color accent;
  final bool reduce;
  const _SuccessBadge({required this.accent, this.reduce = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SaPopIn(
        child: Center(
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              if (!reduce)
                Positioned(
                  top: 8,
                  child: SizedBox(
                    width: 120,
                    height: 80,
                    child: CustomPaint(painter: _SyncParticlePainter(accent: accent)),
                  ),
                ),
              Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: accent.withValues(alpha: 0.28)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 22,
                  height: 22,
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
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SyncParticlePainter extends CustomPainter {
  final Color accent;
  const _SyncParticlePainter({required this.accent});

  @override
  void paint(Canvas canvas, Size size) {
    final colors = [accent, const Color(0xFFC8F56A), SaBrand.bright, const Color(0xFFF5D08A)];
    final center = Offset(size.width / 2, size.height / 2);
    for (var i = 0; i < 12; i++) {
      final ang = (i / 12) * math.pi * 2;
      final dist = 46 + (i % 3) * 18;
      final p = center + Offset(math.cos(ang) * dist, math.sin(ang) * dist);
      canvas.drawCircle(p, 2, Paint()..color = colors[i % colors.length].withValues(alpha: 0.85));
    }
  }

  @override
  bool shouldRepaint(covariant _SyncParticlePainter old) => old.accent != accent;
}

class _Footer extends StatelessWidget {
  final bool done;
  final Color accent;
  final SaBrandSyncVariant variant;
  final VoidCallback? onContinue;
  final VoidCallback? onRetry;

  const _Footer({
    required this.done,
    required this.accent,
    required this.variant,
    this.onContinue,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.verified_user_outlined, size: 12, color: Color(0xFF8A93A1)),
              const SizedBox(width: 4),
              const Text('xavfsiz kanal', style: TextStyle(fontSize: 10, color: Color(0xFF8A93A1))),
              const SizedBox(width: 12),
              const Icon(Icons.upload_file_outlined, size: 12, color: Color(0xFF8A93A1)),
              const SizedBox(width: 4),
              Text(
                variant == SaBrandSyncVariant.full ? "to'liq kesh" : 'diff rejimi',
                style: const TextStyle(fontSize: 10, color: Color(0xFF8A93A1)),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.link, size: 12, color: Color(0xFF8A93A1)),
              const SizedBox(width: 4),
              const Text('api.salesarena.uz', style: TextStyle(fontSize: 10, color: Color(0xFF8A93A1))),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              SaPressable(
                onTap: onRetry,
                borderRadius: BorderRadius.circular(99),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFE2E7EE)),
                  ),
                  child: const Icon(Icons.refresh_rounded, size: 18, color: Color(0xFF465060)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SaPressable(
                  onTap: onContinue,
                  child: AnimatedContainer(
                    duration: SaDurations.press,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: done ? accent : const Color(0xFFEEF1F6),
                      borderRadius: BorderRadius.circular(99),
                      boxShadow: done
                          ? [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.35),
                                blurRadius: 18,
                                offset: const Offset(0, 8),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (done) ...[
                          const Icon(Icons.check_rounded, size: 16, color: Colors.white),
                          const SizedBox(width: 6),
                        ],
                        Text(
                          done ? 'Davom etish' : "O'tkazib yuborish",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: done ? Colors.white : const Color(0xFF8A93A1),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (variant == SaBrandSyncVariant.identity) ...[
            const SizedBox(height: 8),
            const Text(
              'Rol kartasi: rasm va raqam server bilan mos',
              style: TextStyle(fontSize: 10, color: Color(0xFF8A93A1)),
            ),
          ],
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  final Color color;
  final double size;
  const _Orb({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}
