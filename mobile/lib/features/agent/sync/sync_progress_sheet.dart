import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import 'manual_sync_provider.dart';

/// Shablon 26 — sinxronizatsiya jarayoni (pastki varaq, progress faqat oldinga).
class SyncProgressSheet extends StatelessWidget {
  final ManualSyncState state;

  const SyncProgressSheet({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final steps = state.uiSteps;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            boxShadow: [
              BoxShadow(
                color: Color(0x26000000),
                blurRadius: 24,
                offset: Offset(0, -6),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
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
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(end: state.progress.clamp(0.0, 1.0)),
                      duration: const Duration(milliseconds: 450),
                      curve: Curves.easeOutCubic,
                      builder: (context, value, _) {
                        return LinearProgressIndicator(
                          value: value,
                          backgroundColor: const Color(0xFFE6ECF2),
                          valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                          minHeight: 8,
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
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

class _StepIcon extends StatefulWidget {
  final IconData icon;
  final Color color;
  final bool pulse;

  const _StepIcon({required this.icon, required this.color, required this.pulse});

  @override
  State<_StepIcon> createState() => _StepIconState();
}

class _StepIconState extends State<_StepIcon> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    if (!widget.pulse) _ctrl.stop();
  }

  @override
  void didUpdateWidget(covariant _StepIcon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pulse && !_ctrl.isAnimating) {
      _ctrl.repeat(reverse: true);
    } else if (!widget.pulse) {
      _ctrl.stop();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final child = Icon(widget.icon, size: 18, color: widget.color);
    if (!widget.pulse) return child;
    return FadeTransition(
      opacity: Tween(begin: 0.55, end: 1.0).animate(_ctrl),
      child: child,
    );
  }
}
