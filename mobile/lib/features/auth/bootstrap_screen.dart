import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session.dart';
import '../../core/errors/user_facing_error.dart';
import '../agent/sync/full_sync_view.dart';
import 'auth_provider.dart';

class BootstrapScreen extends ConsumerWidget {
  const BootstrapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final role = ref.watch(sessionProvider).user?.role;
    final isSuccess = auth.status == AuthStatus.syncComplete;
    final model = fullSyncViewModelFromBootstrap(
      isSuccess: isSuccess,
      stepIndex: auth.bootstrapStep.idx,
      syncPhaseIndex: auth.syncPhaseIndex,
      role: role,
    );

    void finish() => ref.read(authStateProvider.notifier).finishBootstrap();

    final errorInfo = auth.errorInfo ??
        UserFacingError.tryParseLegacy(auth.error);

    return Stack(
      children: [
        FullSyncView(
          isSuccess: model.isSuccess,
          progress: model.progress,
          items: model.items,
          title: model.title,
          onContinue: isSuccess ? finish : null,
          onBack: isSuccess ? finish : null,
        ),
        if (errorInfo != null)
          Positioned(
            left: 12,
            right: 12,
            bottom: 72,
            child: UserFacingErrorCard(
              error: errorInfo,
              onRetry: () => ref.read(authStateProvider.notifier).checkSession(),
            ),
          ),
      ],
    );
  }
}
