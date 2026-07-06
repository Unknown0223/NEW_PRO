import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_env.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/l10n/app_strings_ru.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import 'auth_provider.dart';

/// Birinchi kirish: slug + login + parol (server). Keyin mahalliy PIN o‘rnatiladi.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _slug = TextEditingController();
  final _login = TextEditingController();
  final _pass = TextEditingController();
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    final slug = defaultTenantSlug();
    if (slug != null) _slug.text = slug;
    final login = defaultLogin();
    if (login != null) _login.text = login;
  }

  void _submit() {
    if (_slug.text.isEmpty || _login.text.isEmpty || _pass.text.isEmpty) {
      showAgentToast(context, S.fillAllFields, accentColor: AppColors.error);
      return;
    }
    ref.read(authStateProvider.notifier).login(
      slug: _slug.text.trim(), login: _login.text.trim(), password: _pass.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    final loading = auth.status == AuthStatus.loading || auth.status == AuthStatus.bootstrapping;

    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.error == null || prev?.error == next.error) return;
      final info = next.errorInfo ?? UserFacingError.tryParseLegacy(next.error);
      if (info != null && info.steps.isNotEmpty) {
        UserFacingError.showDialog(context, info);
      } else {
        showAgentToast(context, next.error!, accentColor: AppColors.error);
      }
    });

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
                  child: const Icon(Icons.point_of_sale_rounded, size: 36, color: AppColors.primary),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isLocalApiEnv()
                        ? AppColors.primary.withValues(alpha: 0.12)
                        : Colors.orange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isLocalApiEnv()
                          ? AppColors.primary.withValues(alpha: 0.35)
                          : Colors.orange.withValues(alpha: 0.45),
                    ),
                  ),
                  child: Text(
                    apiEnvDisplayLabel(),
                    textAlign: TextAlign.center,
                    style: AppTypography.bodySmall.copyWith(
                      color: isLocalApiEnv() ? AppColors.primary : Colors.orange.shade800,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(S.loginTitle, style: AppTypography.displayMedium.copyWith(color: AppColors.textTitle)),
                const SizedBox(height: 4),
                Text(S.loginSubtitle, style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted)),
                const SizedBox(height: 32),
                AgentSurfaceCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      AgentFloatingInput(
                        controller: _slug,
                        enabled: !loading,
                        label: S.companySlug,
                      ),
                      const SizedBox(height: 14),
                      AgentFloatingInput(
                        controller: _login,
                        enabled: !loading,
                        label: S.login,
                      ),
                      const SizedBox(height: 14),
                      AgentFloatingInput(
                        controller: _pass,
                        enabled: !loading,
                        label: S.password,
                        obscureText: _obscure,
                        onSubmitted: (_) => _submit(),
                        suffix: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      const SizedBox(height: 20),
                      AgentPrimaryButton(
                        label: S.signIn,
                        height: 52,
                        onPressed: loading ? null : _submit,
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
