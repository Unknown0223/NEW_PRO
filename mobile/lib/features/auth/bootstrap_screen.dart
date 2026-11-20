import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session.dart';
import '../../core/errors/user_facing_error.dart';
import 'auth_provider.dart';
import 'entrance/role_welcome_view.dart';

class BootstrapScreen extends ConsumerWidget {
  const BootstrapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final session = ref.watch(sessionProvider);
    final role = session.user?.role;
    final isSuccess = auth.status == AuthStatus.syncComplete;

    void finish() => ref.read(authStateProvider.notifier).finishBootstrap();

    final errorInfo =
        auth.errorInfo ?? UserFacingError.tryParseLegacy(auth.error);

    return Stack(
      children: [
        RoleWelcomeView(
          role: role,
          displayName: session.user?.name,
          isSuccess: isSuccess,
          onContinue: isSuccess ? finish : null,
        ),
        if (errorInfo != null)
          Positioned(
            left: 12,
            right: 12,
            bottom: 72,
            child: UserFacingErrorCard(
              error: errorInfo,
              onRetry: () =>
                  ref.read(authStateProvider.notifier).checkSession(),
            ),
          ),
      ],
    );
  }
}
