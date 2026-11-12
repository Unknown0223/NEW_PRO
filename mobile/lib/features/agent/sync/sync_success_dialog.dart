import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../design_system/design_system.dart';

/// Shablon 27 — sinxron muvaffaqiyat modali.
class SyncSuccessDialog extends StatelessWidget {
  final String subtitle;
  final VoidCallback onContinue;
  final bool showSyncRing;
  final List<String> syncSteps;
  final int syncDoneSteps;

  const SyncSuccessDialog({
    super.key,
    required this.subtitle,
    required this.onContinue,
    this.showSyncRing = false,
    this.syncSteps = const ['Клиенты', 'Товары', 'Цены', 'Заказы'],
    this.syncDoneSteps = 4,
  });

  static Future<void> show(
    BuildContext context, {
    required String subtitle,
    required VoidCallback onContinue,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (ctx) => SyncSuccessDialog(
        subtitle: subtitle,
        onContinue: () {
          Navigator.of(ctx).pop();
          onContinue();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: SaPopIn(
          child: Material(
            color: scheme.surface,
            borderRadius: BorderRadius.circular(SaRadius.sheet),
            elevation: 12,
            shadowColor: Colors.black26,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(SaSpace.xl, 28, SaSpace.xl, SaSpace.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (showSyncRing)
                    SaSyncView(
                      progress: 1,
                      steps: syncSteps,
                      doneSteps: syncDoneSteps,
                      done: true,
                    )
                  else
                    Container(
                      width: 70,
                      height: 70,
                      decoration: const BoxDecoration(
                        color: AppColors.successSoft,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check_rounded, color: AppColors.success, size: 32),
                    ),
                  const SizedBox(height: SaSpace.lg),
                  Text(
                    S.syncDataUpdated,
                    textAlign: TextAlign.center,
                    style: AppTypography.headlineSmall.copyWith(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                  ),
                  const SizedBox(height: SaSpace.xl),
                  SaPrimaryButton(
                    label: S.continueBtn,
                    onPressed: onContinue,
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
