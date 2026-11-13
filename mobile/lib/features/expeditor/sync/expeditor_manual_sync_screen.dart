import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/errors/user_facing_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../design_system/design_system.dart';
import '../expeditor_providers.dart';
import 'expeditor_sync_provider.dart';

/// Ekspeditor qo‘lda sync — `SaBrandSync` + road.
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
    final role = ref.watch(sessionProvider).user?.role ?? 'expeditor';
    final isSuccess = sync.status == ExpeditorSyncStatus.success;
    final progress = isSuccess
        ? 1.0
        : ((sync.phaseIndex + 1) / 6).clamp(0.05, 0.95);

    return Stack(
      children: [
        SaBrandSync(
          variant: widget.full ? SaBrandSyncVariant.full : SaBrandSyncVariant.quick,
          role: role,
          progress: progress,
          stepIndex: sync.phaseIndex,
          done: isSuccess,
          accent: AppColors.expeditorAccent,
          onContinue: isSuccess ? _finish : null,
          onClose: isSuccess ? _finish : null,
          onRetry: () =>
              ref.read(expeditorSyncProvider.notifier).run(full: widget.full),
        ),
        if (sync.status == ExpeditorSyncStatus.error && sync.errorInfo != null)
          Positioned(
            left: 12,
            right: 12,
            bottom: 72,
            child: UserFacingErrorCard(
              error: sync.errorInfo!,
              onRetry: () =>
                  ref.read(expeditorSyncProvider.notifier).run(full: widget.full),
            ),
          ),
      ],
    );
  }
}
