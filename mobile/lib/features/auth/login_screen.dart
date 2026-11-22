import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_env.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/l10n/app_strings_ru.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import 'auth_provider.dart';
import 'entrance/auth_enter.dart';
import 'entrance/template_auth_entrance.dart';

/// Eski login forma + shablon Auth kirish: launch → form → cover.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _slug = TextEditingController();
  final _login = TextEditingController();
  final _pass = TextEditingController();
  bool _obscure = true;
  bool _shownInitialError = false;
  AuthEntranceStage _stage = AuthEntranceStage.launch;
  Timer? _launchTimer;

  @override
  void initState() {
    super.initState();
    _launchTimer = Timer(authEntranceLaunchHold, () {
      if (!mounted || _stage != AuthEntranceStage.launch) return;
      setState(() => _stage = AuthEntranceStage.form);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _showPendingAuthError());
  }

  void _presentError(UserFacingError info) {
    if (_stage == AuthEntranceStage.cover) {
      setState(() => _stage = AuthEntranceStage.form);
    }
    if (info.isLoginAuthSnack) {
      showAuthBottomToast(context, info.snackbarText, accentColor: AppColors.error);
      return;
    }
    if (info.steps.isNotEmpty) {
      UserFacingError.showDialog(context, info);
    } else {
      showAuthBottomToast(context, info.snackbarText, accentColor: AppColors.error);
    }
  }

  void _showPendingAuthError() {
    if (!mounted || _shownInitialError) return;
    _shownInitialError = true;
    final auth = ref.read(authStateProvider);
    if (auth.error == null) return;
    final info = auth.errorInfo ?? UserFacingError.tryParseLegacy(auth.error);
    if (info != null) _presentError(info);
  }

  @override
  void dispose() {
    _launchTimer?.cancel();
    _slug.dispose();
    _login.dispose();
    _pass.dispose();
    super.dispose();
  }

  void _submit() {
    if (_slug.text.isEmpty || _login.text.isEmpty || _pass.text.isEmpty) {
      showAuthBottomToast(context, S.fillAllFields, accentColor: AppColors.error);
      return;
    }
    if (_stage == AuthEntranceStage.launch) {
      _launchTimer?.cancel();
      setState(() => _stage = AuthEntranceStage.form);
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
    final loading =
        auth.status == AuthStatus.loading || auth.status == AuthStatus.bootstrapping;
    final launch = _stage == AuthEntranceStage.launch;
    final cover = _stage == AuthEntranceStage.cover;
    final form = _stage == AuthEntranceStage.form;
    final waveTop = authEntranceWaveTop(_stage);
    final h = MediaQuery.sizeOf(context).height;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    const delays = authEntranceFormDelays;

    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.error != null && prev?.error != next.error) {
        final info = next.errorInfo ?? UserFacingError.tryParseLegacy(next.error);
        if (info != null) {
          _presentError(info);
        } else {
          if (_stage == AuthEntranceStage.cover) {
            setState(() => _stage = AuthEntranceStage.form);
          }
          showAuthBottomToast(context, next.error!, accentColor: AppColors.error);
        }
        return;
      }
      if (next.status == AuthStatus.authenticated &&
          _stage != AuthEntranceStage.cover) {
        setState(() => _stage = AuthEntranceStage.cover);
      }
    });

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: true,
      body: AuthLaunchZoom(
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            const Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(painter: AuthDotGridPainter()),
              ),
            ),
            Positioned.fill(
              child: AuthBrandWave(topFraction: waveTop, animate: true),
            ),

            // Brand lockup — CSS .sa-logo: top 36%→6%, scale 1→0.66, 0.8s.
            AnimatedPositioned(
              duration: authEntranceLogoMove,
              curve: authEntranceCurve,
              left: 0,
              right: 0,
              top: launch ? h * 0.36 : h * 0.06,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 400),
                opacity: cover ? 0 : 1,
                child: AnimatedScale(
                  duration: authEntranceLogoMove,
                  curve: authEntranceCurve,
                  scale: launch ? 1 : 0.66,
                  alignment: Alignment.topCenter,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const AuthBrandMark(size: 64, draw: true),
                      const SizedBox(height: 10),
                      const AuthEnter(
                        delay: authEntranceWordmarkDelay,
                        child: AuthBrandWordmark(size: 26),
                      ),
                      AnimatedOpacity(
                        duration: const Duration(milliseconds: 500),
                        opacity: launch ? 1 : 0,
                        child: const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: AuthEnter(
                            delay: authEntranceTaglineDelay,
                            child: Text(
                              'Savdo jamoasi uchun mobil ilova',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF677386),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            if (form)
              Positioned.fill(
                key: const ValueKey('auth-form'),
                child: SafeArea(
                  child: Column(
                    children: [
                      Expanded(
                        child: SingleChildScrollView(
                          padding: EdgeInsets.fromLTRB(
                            24,
                            132,
                            24,
                            16 + bottomInset,
                          ),
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              AuthEnter(
                                delay: const Duration(milliseconds: 40),
                                child: Text(
                                  S.loginTitle,
                                  textAlign: TextAlign.center,
                                  style: AppTypography.bodyMedium
                                      .copyWith(color: AppColors.textMuted),
                                ),
                              ),
                              const SizedBox(height: 16),
                              AuthEnter(
                                delay: delays[0],
                                child: AgentAuthTextField(
                                  controller: _slug,
                                  enabled: !loading,
                                  label: S.companySlug,
                                  hint: S.companyHint,
                                ),
                              ),
                              const SizedBox(height: 12),
                              AuthEnter(
                                delay: delays[1],
                                child: AgentAuthTextField(
                                  controller: _login,
                                  enabled: !loading,
                                  label: S.login,
                                  hint: S.loginHint,
                                ),
                              ),
                              const SizedBox(height: 12),
                              AuthEnter(
                                delay: delays[2],
                                child: AgentAuthTextField(
                                  controller: _pass,
                                  enabled: !loading,
                                  label: S.password,
                                  hint: '••••••••',
                                  obscureText: _obscure,
                                  onSubmitted: (_) => _submit(),
                                  suffix: IconButton(
                                    icon: Icon(
                                      _obscure
                                          ? Icons.visibility_off_rounded
                                          : Icons.visibility_rounded,
                                      color: AppColors.textMuted,
                                      size: 20,
                                    ),
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 18),
                              AuthEnter(
                                delay: delays[3],
                                child: AgentPrimaryButton(
                                  label: S.signIn,
                                  height: 52,
                                  borderRadius: 14,
                                  color: authBrandBlue,
                                  onPressed: loading ? null : _submit,
                                ),
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
                                      style: AppTypography.captionSmall
                                          .copyWith(color: AppColors.textMuted),
                                    ),
                                  ],
                                ),
                              ],
                              if (kDebugMode || isLocalApiEnv()) ...[
                                const SizedBox(height: 12),
                                Text(
                                  apiEnvDisplayLabel(),
                                  textAlign: TextAlign.center,
                                  style: AppTypography.captionSmall
                                      .copyWith(color: Colors.orange.shade800),
                                ),
                              ],
                              const SizedBox(height: 100),
                            ],
                          ),
                        ),
                      ),
                      AuthEnter(
                        delay: delays[4],
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                          child: Column(
                            children: [
                              Text.rich(
                                TextSpan(
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.white.withValues(alpha: 0.85),
                                  ),
                                  children: const [
                                    TextSpan(text: 'Hisobingiz yo‘qmi? '),
                                    TextSpan(
                                      text: 'Administratorga murojaat qiling.',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${S.help} · ${S.support}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white.withValues(alpha: 0.95),
                                  decoration: TextDecoration.underline,
                                  decorationColor: Colors.white70,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            if (cover)
              Positioned.fill(
                key: const ValueKey('auth-cover'),
                child: IgnorePointer(
                  child: Center(
                    child: AuthEnter(
                      delay: authEntranceCoverBrandDelay,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const AuthBrandMark(
                            size: 72,
                            bare: true,
                            draw: false,
                          ),
                          const SizedBox(height: 8),
                          const AuthBrandWordmark(size: 22, onBrand: true),
                          const SizedBox(height: 12),
                          Text(
                            loading
                                ? 'Kirish tasdiqlandi…'
                                : 'Kirish tasdiqlandi',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
