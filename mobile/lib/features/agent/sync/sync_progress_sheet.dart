import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';
import 'manual_sync_provider.dart';

/// Shablon BrandSync — progress sheet (qadamlar bir marta, markaziy eski spinner yo‘q).
class SyncProgressSheet extends StatelessWidget {
  final ManualSyncState state;

  const SyncProgressSheet({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final steps = state.uiSteps;
    final scheme = Theme.of(context).colorScheme;
    final syncDone = state.status == ManualSyncStatus.success;
    final pct = (state.progress.clamp(0.0, 1.0) * 100).round();
    final title = state.full ? 'Полная синхронизация' : 'Обычная синхронизация';
    const accent = AppColors.primary;

    return Stack(
      children: [
        // Fon dim — eski ko‘k kvadrat overlay o‘rniga.
        ModalBarrier(
          color: Colors.black.withValues(alpha: 0.28),
          dismissible: false,
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: Material(
            color: Colors.transparent,
            child: SaPopIn(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: scheme.surface,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(SaRadius.sheet),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 24,
                      offset: const Offset(0, -6),
                    ),
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      SaSpace.lg,
                      10,
                      SaSpace.lg,
                      SaSpace.lg,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Center(child: AgentSheetHandle()),
                        const SizedBox(height: 6),
                        Text(
                          syncDone ? 'Синхронизация завершена' : title,
                          textAlign: TextAlign.center,
                          style: AppTypography.headlineMedium.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          syncDone
                              ? S.syncAllDone
                              : S.syncProgressHint,
                          textAlign: TextAlign.center,
                          style: AppTypography.captionSmall.copyWith(
                            color: syncDone
                                ? AppColors.textMuted
                                : const Color(0xFF8B6A00),
                          ),
                        ),
                        const SizedBox(height: SaSpace.md),
                        // Foiz + linear bar (BrandSync).
                        Row(
                          children: [
                            const Icon(Icons.storage_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 6),
                            Text(
                              state.full ? 'полный кэш' : 'diff / изменения',
                              style: AppTypography.caption.copyWith(
                                color: AppColors.textMuted,
                                fontFamily: 'monospace',
                                fontSize: 11,
                              ),
                            ),
                            const Spacer(),
                            SaCountUp(
                              value: pct,
                              format: (v) => '${v.round()}%',
                              style: AppTypography.titleMedium.copyWith(
                                fontWeight: FontWeight.w800,
                                color: accent,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: TweenAnimationBuilder<double>(
                            tween: Tween(
                              begin: 0,
                              end: state.progress.clamp(0.0, 1.0),
                            ),
                            duration: SaDurations.data,
                            curve: SaCurves.standard,
                            builder: (_, v, __) => LinearProgressIndicator(
                              value: v,
                              minHeight: 6,
                              backgroundColor: const Color(0xFFE8EDF3),
                              valueColor: AlwaysStoppedAnimation(accent),
                            ),
                          ),
                        ),
                        const SizedBox(height: SaSpace.md),
                        // Qadamlar — faqat shu yerda (SaSyncView steps takrorlanmaydi).
                        ...steps.asMap().entries.map((e) {
                          return SaEnter(
                            delay: SaStaggerDelay.of(e.key),
                            preset: SaMotionPreset.rise,
                            child: _SyncStepCard(
                              step: e.value,
                              accent: accent,
                            ),
                          );
                        }),
                        if (syncDone) ...[
                          const SizedBox(height: 12),
                          SaEnter(
                            delay: SaStaggerDelay.of(steps.length),
                            preset: SaMotionPreset.spring,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: accent.withValues(alpha: 0.25),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: accent,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check_rounded,
                                      color: Colors.white,
                                      size: 16,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      S.syncDataUpdated,
                                      style: AppTypography.bodySmall.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  SaLiveDot(color: accent, size: 5),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SyncStepCard extends StatelessWidget {
  final SyncUiStep step;
  final Color accent;

  const _SyncStepCard({required this.step, required this.accent});

  @override
  Widget build(BuildContext context) {
    final ok = step.status == SyncUiStepStatus.done;
    final now = step.status == SyncUiStepStatus.running;
    final bg = ok
        ? accent.withValues(alpha: 0.08)
        : Colors.white.withValues(alpha: 0.9);
    final border = ok
        ? accent.withValues(alpha: 0.28)
        : AppColors.border;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: AnimatedOpacity(
        duration: SaDurations.press,
        opacity: ok || now ? 1 : 0.55,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border),
          ),
          child: Row(
            children: [
              _StepLeading(status: step.status, accent: accent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  step.label,
                  style: AppTypography.bodySmall.copyWith(
                    fontWeight: FontWeight.w600,
                    color: step.status == SyncUiStepStatus.pending
                        ? AppColors.textMuted
                        : AppColors.textTitle,
                  ),
                ),
              ),
              Text(
                step.value,
                style: AppTypography.bodySmall.copyWith(
                  fontWeight: FontWeight.w800,
                  fontFamily: 'monospace',
                  color: ok
                      ? accent
                      : now
                          ? AppColors.primary
                          : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepLeading extends StatelessWidget {
  final SyncUiStepStatus status;
  final Color accent;

  const _StepLeading({required this.status, required this.accent});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case SyncUiStepStatus.done:
        return Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, size: 12, color: Colors.white),
        );
      case SyncUiStepStatus.running:
        return SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2, color: accent),
        );
      case SyncUiStepStatus.pending:
        return Container(
          width: 18,
          height: 18,
          decoration: const BoxDecoration(
            color: Color(0xFFE2E7EE),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: Color(0xFF8A96A4),
                shape: BoxShape.circle,
              ),
            ),
          ),
        );
    }
  }
}
