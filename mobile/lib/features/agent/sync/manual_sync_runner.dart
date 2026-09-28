import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/error_reporter.dart';
import '../../../core/sync/photo_report_queue.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/errors/user_facing_error.dart';
import '../../auth/auth_provider.dart';
import '../home/agent_home_page.dart';
import '../home/sync_count_provider.dart';
import '../shell/agent_scaffold_key.dart';
import '../visits/visit_stats_helper.dart';
import 'manual_sync_provider.dart';

void _showSyncSnack(String msg, {Color? color}) {
  final ctx = agentShellScaffoldKey.currentContext;
  if (ctx == null || !ctx.mounted) return;
  ScaffoldMessenger.of(ctx).showSnackBar(
    SnackBar(
      content: Text(msg),
      backgroundColor: color ?? AppColors.warning,
      duration: const Duration(seconds: 6),
    ),
  );
}

/// Sheet yopilgach [WidgetRef] o‘lik — faqat [ProviderContainer] ishlatiladi.
Future<void> startManualSyncWithContainer(
  ProviderContainer container, {
  required bool full,
}) async {
  try {
    final policy =
        await container.read(authStateProvider.notifier).refreshConfigAndEvaluateSyncPolicy();
    if (!policy.allowed) {
      final slot = container.read(sessionProvider).user?.workSlotCode?.trim();
      final base = policy.denialMessage ?? 'Синхронизация недоступна';
      final msg = (slot != null && slot.isNotEmpty) ? '$base · Рабочее место: $slot' : base;
      if (kDebugMode) {
        debugPrint('startManualSync denied: $msg');
      }
      _showSyncSnack(msg, color: AppColors.warning);
      return;
    }
    if (container.read(manualSyncProvider.notifier).isRunning) return;
    unawaited(container.read(manualSyncProvider.notifier).run(full: full));
  } catch (e, st) {
    if (kDebugMode) {
      debugPrint('startManualSync error: $e\n$st');
    }
    ErrorReporter.instance?.reportCaught(
      e,
      stack: st,
      module: ErrorModules.sync,
      code: 'ManualSyncStartFailed',
      message: 'Синхронизация: не удалось начать',
      path: '/mobile/sync',
      payload: {'full': full},
    );
    _showSyncSnack(UserFacingError.toast(e, action: 'Не удалось начать синхронизацию'), color: AppColors.error);
  }
}

/// Fotolar — to‘liq katalog sinxronisiz, vaqt oynasiga bog‘liq emas, loader yo‘q.
Future<void> startPhotoSyncWithContainer(ProviderContainer container) async {
  try {
    final slug = container.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      _showSyncSnack('Компания не выбрана', color: AppColors.error);
      return;
    }
    final pending = await AppDatabase().pendingPhotoReportCount();
    if (pending == 0) {
      _showSyncSnack('Нет фото в очереди', color: AppColors.success);
      return;
    }
    _showSyncSnack('Отправка фото ($pending)…');
    final result = await PhotoReportQueue.flush(
      api: container.read(mobileApiProvider),
      slug: slug,
      photoConfig: container.read(sessionProvider).mobileConfig?.photo,
    );
    container.invalidate(pendingPhotoCountProvider);
    container.invalidate(syncedPhotoCountTodayProvider);
    container.invalidate(failedPhotoCountProvider);
    container.invalidate(homeStatsProvider);
    refreshVisitStatsProviders(container.invalidate);
    if (result.failed > 0 && result.sent == 0) {
      _showSyncSnack(
        'Фото не отправлены ($pending). Проверьте интернет.',
        color: AppColors.error,
      );
      return;
    }
    if (result.failed > 0) {
      _showSyncSnack(
        'Фото: отправлено ${result.sent}, ошибка ${result.failed}',
        color: AppColors.warning,
      );
      return;
    }
    _showSyncSnack('Фото отправлены: ${result.sent}', color: AppColors.success);
  } catch (e, st) {
    if (kDebugMode) {
      debugPrint('startPhotoSync error: $e\n$st');
    }
    ErrorReporter.instance?.reportCaught(
      e,
      stack: st,
      module: ErrorModules.photos,
      code: 'PhotoSyncStartFailed',
      message: 'Синхронизация фото: не удалось начать',
      path: '/mobile/clients/photo-reports',
    );
    _showSyncSnack(
      UserFacingError.toast(e, action: 'Не удалось отправить фото'),
      color: AppColors.error,
    );
  }
}

/// Sahifa hali mounted bo‘lsa — [context] dan container olinadi.
Future<void> startManualSync(
  BuildContext context,
  WidgetRef ref, {
  required bool full,
}) {
  final container = ProviderScope.containerOf(context);
  return startManualSyncWithContainer(container, full: full);
}
