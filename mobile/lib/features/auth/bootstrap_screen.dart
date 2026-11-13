import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/theme/app_colors.dart';
import '../../design_system/design_system.dart';
import 'auth_provider.dart';
import 'role_welcome_screen.dart';

/// Bootstrap — `SaBrandSync` + muvaffaqiyatdan keyin `RoleWelcome`.
class BootstrapScreen extends ConsumerWidget {
  const BootstrapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final role = ref.watch(sessionProvider).user?.role;
    final isSuccess = auth.status == AuthStatus.syncComplete;
    final accent = switch (role) {
      'supervisor' => AppColors.supervisorAccent,
      'expeditor' => AppColors.expeditorAccent,
      _ => AppColors.primary,
    };

    void finish() => ref.read(authStateProvider.notifier).finishBootstrap();

    final errorInfo = auth.errorInfo ?? UserFacingError.tryParseLegacy(auth.error);

    if (isSuccess) {
      return RoleWelcomeScreen(
        role: role,
        accent: accent,
        onDone: finish,
      );
    }

    final progress = auth.bootstrapProgress.clamp(0.0, 0.99);
    final stepIdx = auth.syncPhaseIndex ?? auth.bootstrapStep.idx;

    return Stack(
      children: [
        SaBrandSync(
          variant: SaBrandSyncVariant.full,
          role: role,
          progress: progress,
          stepIndex: stepIdx,
          done: false,
          accent: accent,
          onClose: null,
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
