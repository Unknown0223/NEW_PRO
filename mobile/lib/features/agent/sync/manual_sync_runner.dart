import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/sync_policy_provider.dart';
import '../../../core/theme/app_colors.dart';
import 'manual_sync_provider.dart';

/// «Полная» / «Обычная» sinxronizatsiyani boshlash (alohida ekranga o‘tmasdan).
void startManualSync(
  BuildContext context,
  WidgetRef ref, {
  required bool full,
}) {
  final policy = ref.read(syncPolicyProvider);
  if (!policy.allowed) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(policy.denialMessage ?? 'Синхронизация недоступна'),
        backgroundColor: AppColors.warning,
      ),
    );
    return;
  }
  if (ref.read(manualSyncProvider.notifier).isRunning) return;
  ref.read(manualSyncProvider.notifier).run(full: full);
}
