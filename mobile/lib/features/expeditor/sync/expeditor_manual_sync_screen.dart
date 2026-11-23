import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/user_facing_error.dart';
import '../../agent/sync/brand_sync_view.dart';
import '../expeditor_providers.dart';
import 'expeditor_brand_sync_adapter.dart';
import 'expeditor_sync_provider.dart';

/// Deep-link / legacy marshrut — BrandSync (shablon) animatsiyasi.
class ExpeditorManualSyncScreen extends ConsumerStatefulWidget {
  final bool full;

  const ExpeditorManualSyncScreen({super.key, required this.full});

  @override
  ConsumerState<ExpeditorManualSyncScreen> createState() =>
      _ExpeditorManualSyncScreenState();
}

class _ExpeditorManualSyncScreenState
    extends ConsumerState<ExpeditorManualSyncScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(expeditorSyncProvider.notifier).run(full: widget.full);
    });
  }

  void _finish() {
    ref.read(expeditorSyncProvider.notifier).reset();
    ref.invalidate(expeditorDashboardProvider);
    ref.invalidate(expeditorVisitsProvider);
    ref.invalidate(expeditorDebtorsProvider);
    ref.invalidate(expeditorHomeStatsProvider);
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final sync = ref.watch(expeditorSyncProvider);

    return Stack(
      children: [
        BrandSyncView(
          state: manualSyncStateFromExpeditor(sync),
          role: 'expeditor',
          onContinue: sync.status == ExpeditorSyncStatus.success
              ? _finish
              : () {},
        ),
        if (sync.status == ExpeditorSyncStatus.error &&
            sync.errorInfo != null)
          Positioned(
            left: 12,
            right: 12,
            bottom: 72,
            child: UserFacingErrorCard(
              error: sync.errorInfo!,
              onRetry: () => ref
                  .read(expeditorSyncProvider.notifier)
                  .run(full: widget.full),
            ),
          ),
      ],
    );
  }
}
