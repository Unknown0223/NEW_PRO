import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/biometric_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import 'auth_provider.dart';

/// Bank ilovalari kabi: telefon biometriyasidan foydalanishga ruxsat so‘rash.
Future<void> showBiometricSetupDialog(BuildContext context, WidgetRef ref) async {
  final bio = ref.read(biometricServiceProvider);
  if (!await bio.isAvailable()) return;

  final label = await bio.getBiometricLabel();
  if (!context.mounted) return;

  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.fingerprint_rounded, color: AppColors.primary, size: 28),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Биометрия телефона',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Разрешить Sales Arena использовать $label для быстрого входа после PIN?',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textTitle, height: 1.45),
          ),
          const SizedBox(height: 12),
          Text(
            'Данные хранятся только на этом устройстве. При следующем запуске можно войти по PIN или биометрии.',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted, height: 1.4),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () async {
            await ref.read(authStateProvider.notifier).declineBiometricSetup();
            if (ctx.mounted) Navigator.pop(ctx);
          },
          child: const Text('Не сейчас'),
        ),
        FilledButton(
          onPressed: () async {
            final ok = await ref.read(authStateProvider.notifier).enableBiometricLock();
            if (ctx.mounted) Navigator.pop(ctx);
            if (!context.mounted) return;
            if (ok) {
              showAgentToast(
                context,
                'Быстрый вход по биометрии включён',
                accentColor: AppColors.success,
              );
            } else {
              showAgentToast(
                context,
                'Не удалось включить биометрию. Проверьте отпечаток в настройках телефона.',
                accentColor: AppColors.warning,
              );
            }
          },
          style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
          child: const Text('Разрешить'),
        ),
      ],
    ),
  );
}
