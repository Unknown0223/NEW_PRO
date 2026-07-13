import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/sync/sync_data_refresh.dart';
import '../../auth/auth_provider.dart';
import 'full_sync_view.dart';

class SyncSuccessScreen extends ConsumerWidget {
  const SyncSuccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extra = GoRouterState.of(context).extra;
    final result = extra is AgentSyncResult ? extra : const AgentSyncResult(ok: true);

    void goHome() {
      invalidateSyncedData(ref.invalidate);
      context.go('/home');
    }

    final items = [
      const FullSyncItemState('Товары', FullSyncItemStatus.done),
      const FullSyncItemState('Склады', FullSyncItemStatus.done),
      const FullSyncItemState('Тара продукты', FullSyncItemStatus.done),
      const FullSyncItemState('Клиенты', FullSyncItemStatus.done),
      const FullSyncItemState('Заказы', FullSyncItemStatus.done),
      const FullSyncItemState('Библиотека', FullSyncItemStatus.done),
      FullSyncItemState('Другие', result.ok ? FullSyncItemStatus.done : FullSyncItemStatus.pending),
    ];

    return FullSyncView(
      isSuccess: result.ok,
      progress: 1,
      items: items,
      onContinue: goHome,
      onBack: goHome,
    );
  }
}
