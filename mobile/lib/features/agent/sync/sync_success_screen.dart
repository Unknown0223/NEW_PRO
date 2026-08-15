import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../../core/time/work_region_time.dart';
import '../../auth/auth_provider.dart';
import 'sync_success_dialog.dart';

class SyncSuccessScreen extends ConsumerWidget {
  const SyncSuccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extra = GoRouterState.of(context).extra;
    final result = extra is AgentSyncResult ? extra : const AgentSyncResult(ok: true);
    final records = result.clients + result.products + result.prices + result.orders;
    final subtitle =
        '${formatWorkRegionDateTime(DateTime.now().toUtc().toIso8601String())} · ${S.syncRecordsCount(records)}';

    void goHome() {
      invalidateSyncedData(ref.invalidate);
      context.go('/home');
    }

    return Scaffold(
      backgroundColor: Colors.black.withValues(alpha: 0.45),
      body: Center(
        child: SyncSuccessDialog(
          subtitle: subtitle,
          onContinue: goHome,
        ),
      ),
    );
  }
}
