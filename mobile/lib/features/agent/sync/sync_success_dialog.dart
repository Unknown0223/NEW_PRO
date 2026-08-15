import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';

/// Shablon 27 — sinxron muvaffaqiyat modali.
class SyncSuccessDialog extends StatelessWidget {
  final String subtitle;
  final VoidCallback onContinue;

  const SyncSuccessDialog({
    super.key,
    required this.subtitle,
    required this.onContinue,
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Material(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          elevation: 12,
          shadowColor: Colors.black26,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 70,
                  height: 70,
                  decoration: const BoxDecoration(
                    color: AppColors.successSoft,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_rounded, color: AppColors.success, size: 32),
                ),
                const SizedBox(height: 20),
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
                const SizedBox(height: 24),
                AgentPrimaryButton(
                  label: S.continueBtn,
                  onPressed: onContinue,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
