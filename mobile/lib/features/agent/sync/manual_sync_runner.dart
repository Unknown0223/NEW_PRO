import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/sync_policy_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/auth_provider.dart';
import 'manual_sync_provider.dart';

/// «Полная» / «Обычная» sinxronizatsiyani boshlash (alohida ekranga o‘tmasdan).
Future<void> startManualSync(
  BuildContext context,
  WidgetRef ref, {
  required bool full,
}) async {
  var policy = ref.read(syncPolicyProvider);
  if (!policy.allowed) {
    policy = await ref.read(authStateProvider.notifier).refreshConfigAndEvaluateSyncPolicy();
  }
  if (!policy.allowed) {
    if (!context.mounted) return;
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
