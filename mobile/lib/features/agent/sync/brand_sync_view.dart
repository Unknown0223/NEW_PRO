import 'package:flutter/material.dart';

import '../../auth/entrance/role_road_scene.dart';
import '../../auth/entrance/role_welcome_meta.dart';
import '../../auth/entrance/template_auth_entrance.dart';
import 'brand_sync_meta.dart';
import 'brand_sync_parts.dart';
import 'manual_sync_provider.dart';

/// Shablon BrandSync — ManualSync presentation (ADR-009: Orchestrator emas).
class BrandSyncView extends StatelessWidget {
  final ManualSyncState state;
  final String? role;
  final VoidCallback onContinue;

  const BrandSyncView({
    super.key,
    required this.state,
    required this.role,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    final variant = brandSyncVariantFromFull(state.full);
    final meta = brandSyncMeta(variant);
    final accent = roleWelcomeAccent(role);
    final success = state.status == ManualSyncStatus.success;
    final step = brandSyncVisualStep(
      progress: state.progress,
      success: success,
      stepCount: meta.steps.length,
    );
    // CTA / TAYYOR — faqat ManualSync success (progress=1 emas).
    final done = success;
    final pct = success
        ? 100
        : meta.steps.isEmpty
            ? 0
            : ((step.clamp(0, meta.steps.length - 1) / meta.steps.length) * 100)
                .round()
                .clamp(0, 99);
    final waveH = 14 + pct * 0.86;

    return Material(
      color: const Color(0xFFFBFCFE),
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: const Alignment(-0.2, -1),
                    end: const Alignment(0.3, 1),
                    colors: [
                      Color.lerp(Colors.white, accent, 0.08)!,
                      const Color(0xFFFBFCFE),
                      Color.lerp(Colors.white, accent, 0.05)!,
                    ],
                  ),
                ),
              ),
            ),
          ),
          const Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(painter: AuthDotGridPainter()),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: MediaQuery.sizeOf(context).height * (waveH / 100),
            child: IgnorePointer(
              child: Opacity(
                opacity: 0.16,
                child: CustomPaint(
                  painter: BrandSyncWavePainter(
                    brand: const Color(0xFF1F66D1),
                    accent: accent,
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      const AuthBrandMark(size: 26, draw: true),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const AuthBrandWordmark(size: 13),
                            const SizedBox(height: 2),
                            Text(
                              'sinxronlash · ${brandSyncRoleWord(role)}',
                              style: const TextStyle(
                                fontSize: 9,
                                letterSpacing: 1.2,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF7A8697),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (done)
                        IconButton(
                          onPressed: onContinue,
                          icon: const Icon(Icons.close, size: 18),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white,
                            side: const BorderSide(color: Color(0xFFE2E7EE)),
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: SizedBox(
                    height: 132,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: const Color(0xFFE3E8EF)),
                        ),
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: RoleRoadScene(
                                role: role,
                                accent: accent,
                                leaving: done,
                              ),
                            ),
                            Positioned(
                              right: 8,
                              top: 8,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.9),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: done
                                            ? const Color(0xFF84CC16)
                                            : const Color(0xFFFCD34D),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 5),
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
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Column(
                    children: [
                      Text(
                        done ? 'Sinxronlash yakunlandi' : meta.title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0E1420),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        done
                            ? '${meta.steps.length} bosqich · ${variant == BrandSyncVariant.full ? '18.4 MB' : '1.6 MB'} · 0 xato'
                            : meta.hint,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF66717E),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.storage_outlined,
                            size: 14,
                            color: Color(0xFF7A8697),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            variant == BrandSyncVariant.full
                                ? 'lokal kesh'
                                : 'diff rejimi',
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
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: pct / 100,
                          minHeight: 5,
                          backgroundColor: const Color(0xFFE8EDF3),
                          color: accent,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    itemCount: meta.steps.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, i) {
                      final s = meta.steps[i];
                      return BrandSyncStepRow(
                        label: s.label,
                        kb: i < step ? s.kb : '···',
                        ok: i < step,
                        now: i == step && !done,
                        accent: accent,
                      );
                    },
                  ),
                ),
                if (done)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: BrandSyncSuccessBadge(accent: accent),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: done ? onContinue : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        disabledBackgroundColor: const Color(0xFFEEF1F6),
                        foregroundColor: Colors.white,
                        disabledForegroundColor: const Color(0xFF8A93A1),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      child: Text(done ? 'Davom etish' : 'Sinxronlanmoqda…'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
