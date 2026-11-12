import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';
import 'manual_sync_provider.dart';

/// Shablon 26 — sinxronizatsiya jarayoni (pastki varaq, progress faqat oldinga).
class SyncProgressSheet extends StatelessWidget {
  final ManualSyncState state;

  const SyncProgressSheet({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final steps = state.uiSteps;
    final scheme = Theme.of(context).colorScheme;
    final doneSteps = steps.where((s) => s.status == SyncUiStepStatus.done).length;
    final syncDone = state.status == ManualSyncStatus.success;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Material(
        color: Colors.transparent,
        child: SaPopIn(
          child: Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: scheme.surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(SaRadius.sheet)),
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
                padding: const EdgeInsets.fromLTRB(SaSpace.lg, 10, SaSpace.lg, SaSpace.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: AgentSheetHandle()),
                    const SizedBox(height: 6),
                    Text(
                      S.syncTitle,
                      textAlign: TextAlign.center,
                      style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: SaSpace.md),
                    SaSyncView(
                      progress: state.progress,
                      steps: steps.map((s) => s.label).toList(),
                      doneSteps: doneSteps,
                      done: syncDone,
                    ),
                    const SizedBox(height: SaSpace.md),
                    ...steps.map((step) => _SyncStepRow(step: step)),
                  const SizedBox(height: 10),
                  Text(
                    S.syncProgressHint,
                    textAlign: TextAlign.center,
                    style: AppTypography.captionSmall.copyWith(color: const Color(0xFF8B6A00)),
                  ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SyncStepRow extends StatelessWidget {
  final SyncUiStep step;

  const _SyncStepRow({required this.step});

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (step.status) {
      SyncUiStepStatus.done => (Icons.check_rounded, AppColors.success),
      SyncUiStepStatus.running => (Icons.sync_rounded, AppColors.primary),
      SyncUiStepStatus.pending => (Icons.circle_outlined, AppColors.textMuted),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          _StepIcon(icon: icon, color: color, pulse: step.status == SyncUiStepStatus.running),
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
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _StepIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  final bool pulse;

  const _StepIcon({required this.icon, required this.color, required this.pulse});

  @override
  Widget build(BuildContext context) {
    if (pulse) {
      return SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: color,
        ),
      );
    }
    return Icon(icon, size: 18, color: color);
  }
}
