import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/theme/app_colors.dart';
import 'auth_provider.dart';

/// Bootstrap — oddiy progress; brend splash / RoleWelcome yo‘q (orqani to‘smaydi).
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
      WidgetsBinding.instance.addPostFrameCallback((_) => finish());
      return const SizedBox.shrink();
    }

    final progress = auth.bootstrapProgress.clamp(0.0, 0.99);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              ),
              const SizedBox(height: 20),
              const Text(
                'Ma’lumotlar yuklanmoqda…',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textTitle,
                ),
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: progress <= 0 ? null : progress,
                  minHeight: 4,
                  backgroundColor: const Color(0xFFE8ECF1),
                  color: accent,
                ),
              ),
              if (errorInfo != null) ...[
                const SizedBox(height: 24),
                UserFacingErrorCard(
                  error: errorInfo,
                  onRetry: () =>
                      ref.read(authStateProvider.notifier).checkSession(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
