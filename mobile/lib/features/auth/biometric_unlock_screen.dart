import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/biometric_service.dart';
import '../../core/auth/session.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import 'auth_provider.dart';

/// Tez kirish — telefon biometriyasi (login/parol so‘ralmaydi).
class BiometricUnlockScreen extends ConsumerStatefulWidget {
  const BiometricUnlockScreen({super.key});

  @override
  ConsumerState<BiometricUnlockScreen> createState() => _BiometricUnlockScreenState();
}

class _BiometricUnlockScreenState extends ConsumerState<BiometricUnlockScreen> {
  String _bioLabel = 'отпечаток пальца или Face ID';
  bool _autoTriggered = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadLabel();
      _tryAutoUnlock();
    });
  }

  Future<void> _loadLabel() async {
    final label = await ref.read(biometricServiceProvider).getBiometricLabel();
    if (mounted) setState(() => _bioLabel = label);
  }

  Future<void> _tryAutoUnlock() async {
    if (_autoTriggered) return;
    _autoTriggered = true;
    final auth = ref.read(authStateProvider);
    if (auth.status == AuthStatus.loading) return;
    await ref.read(authStateProvider.notifier).unlockWithBiometric();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final auth = ref.watch(authStateProvider);
    final loading = auth.status == AuthStatus.loading;
    final tenantLabel = session.tenantName?.trim().isNotEmpty == true
        ? session.tenantName!
        : (session.tenantSlug ?? '');
    final userLabel = session.user?.name.trim().isNotEmpty == true
        ? session.user!.name.trim()
        : session.user?.login ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 32),
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.fingerprint_rounded, size: 40, color: AppColors.primary),
                ),
                const SizedBox(height: 12),
                Text(
                  'Вход в SalesDoc',
                  style: AppTypography.displayMedium.copyWith(color: AppColors.textTitle),
                ),
                const SizedBox(height: 4),
                Text(
                  tenantLabel.isEmpty ? 'Быстрый вход' : tenantLabel,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                ),
                if (userLabel.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    userLabel,
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textTitle,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                AgentSurfaceCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        'Используйте $_bioLabel — как при разблокировке телефона. '
                        'Логин и пароль не нужны.',
                        textAlign: TextAlign.center,
                        style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                      ),
                      if (auth.error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          auth.error!,
                          textAlign: TextAlign.center,
                          style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                        ),
                      ],
                      const SizedBox(height: 20),
                      AgentPrimaryButton(
                        label: 'Войти',
                        height: 52,
                        onPressed: loading
                            ? null
                            : () => ref.read(authStateProvider.notifier).unlockWithBiometric(),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: loading
                            ? null
                            : () => ref.read(authStateProvider.notifier).logout(),
                        child: const Text('Войти другим аккаунтом'),
                      ),
                      if (loading)
                        const Padding(
                          padding: EdgeInsets.only(top: 12),
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
