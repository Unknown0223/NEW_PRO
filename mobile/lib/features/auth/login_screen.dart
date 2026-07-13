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

class _LoginScreenState extends ConsumerState<LoginScreen> with SingleTickerProviderStateMixin {
  final _slug = TextEditingController();
  final _login = TextEditingController();
  final _pass = TextEditingController();
  bool _obscure = true;
  late final AnimationController _animController;
  late final Animation<double> _logoFade;
  late final Animation<Offset> _cardSlide;

  @override
  void initState() {
    super.initState();
    // Login maydonlari bo'sh — foydalanuvchi o'zi kiritadi (autofill yo'q)

    _animController = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _logoFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animController, curve: const Interval(0, 0.4, curve: Curves.easeOut)),
    );
    _cardSlide = Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
      CurvedAnimation(parent: _animController, curve: const Interval(0.2, 0.8, curve: Curves.easeOutCubic)),
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _slug.dispose();
    _login.dispose();
    _pass.dispose();
    super.dispose();
  }

  void _submit() {
    if (_slug.text.isEmpty || _login.text.isEmpty || _pass.text.isEmpty) {
      showAgentToast(context, S.fillAllFields, accentColor: AppColors.error);
      return;
    }
    ref.read(authStateProvider.notifier).login(
          slug: _slug.text.trim(),
          login: _login.text.trim(),
          password: _pass.text,
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
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            22,
            50,
            22,
            MediaQuery.viewInsetsOf(context).bottom + 24,
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FadeTransition(
                opacity: _logoFade,
                child: Column(
                  children: [
                    Image.asset(
                      'assets/brand/app_icon.png',
                      width: 88,
                      height: 88,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                      errorBuilder: (_, __, ___) => Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: const Icon(Icons.trending_up_rounded, color: Colors.white, size: 40),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text.rich(
                      TextSpan(
                        style: AppTypography.displayLarge.copyWith(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                          height: 1.1,
                        ),
                        children: const [
                          TextSpan(text: 'Sales', style: TextStyle(color: Color(0xFF16233F))),
                          TextSpan(text: 'Arena', style: TextStyle(color: Color(0xFF1E63C9))),
                        ],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      S.loginTitle,
                      textAlign: TextAlign.center,
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 34),
              SlideTransition(
                position: _cardSlide,
                child: FadeTransition(
                  opacity: _logoFade,
                  child: AgentOnboardingCard(
                    child: Column(
                      children: [
                        AgentAuthTextField(
                          controller: _slug,
                          enabled: !loading,
                          label: S.companySlug,
                          hint: S.companyHint,
                        ),
                        const SizedBox(height: 16),
                        AgentAuthTextField(
                          controller: _login,
                          enabled: !loading,
                          label: S.login,
                          hint: S.loginHint,
                        ),
                        const SizedBox(height: 16),
                        AgentAuthTextField(
                          controller: _pass,
                          enabled: !loading,
                          label: S.password,
                          hint: '••••••••',
                          obscureText: _obscure,
                          onSubmitted: (_) => _submit(),
                          suffix: IconButton(
                            icon: Icon(
                              _obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                              color: AppColors.textMuted,
                              size: 20,
                            ),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        const SizedBox(height: 20),
                        AgentPrimaryButton(
                          label: S.signIn,
                          height: 52,
                          borderRadius: 14,
                          onPressed: loading ? null : _submit,
                        ),
                        if (loading) ...[
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                S.connecting,
                                style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 12),
                        Text.rich(
                          TextSpan(
                            text: '${S.help} · ',
                            style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
                            children: [
                              TextSpan(
                                text: S.support,
                                style: AppTypography.captionSmall.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (!isLocalApiEnv()) ...[
                const SizedBox(height: 16),
                Text(
                  apiEnvDisplayLabel(),
                  textAlign: TextAlign.center,
                  style: AppTypography.captionSmall.copyWith(color: Colors.orange.shade800),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
