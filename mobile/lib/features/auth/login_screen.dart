import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/biometric_login_attempt.dart';
import '../../core/config/app_env.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/theme/app_colors.dart';
import '../../core/ui/agent_ui.dart';
import '../../design_system/design_system.dart';
import 'auth_provider.dart';

/// Shablon `AuthScreen` — launch settle + BrandWave rise + cover flood.
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
  bool _remember = true;
  bool _shownInitialError = false;
  bool _touched = false;
  bool _shakeForm = false;
  bool _faceIdBusy = false;
  SaAuthEntranceStage _stage = SaAuthEntranceStage.launch;
  Timer? _launchTimer;

  static const _fieldBg = Color(0xFFEEF1F5);
  static const _ink = Color(0xFF0E1420);
  static const _sub = Color(0xFF677386);
  static const _line = Color(0xFFE4E8EF);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _showPendingAuthError());
    _launchTimer = Timer(saAuthEntranceLaunchHold, () {
      if (!mounted || _stage != SaAuthEntranceStage.launch) return;
      setState(() => _stage = SaAuthEntranceStage.form);
    });
  }

  void _presentError(UserFacingError info) {
    if (_stage == SaAuthEntranceStage.cover) {
      setState(() => _stage = SaAuthEntranceStage.form);
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

  String? get _slugErr =>
      _touched && _slug.text.trim().isEmpty ? 'Kompaniya kodini kiriting' : null;
  String? get _loginErr =>
      _touched && _login.text.trim().length < 3 ? 'Login kamida 3 belgidan iborat' : null;
  String? get _passErr =>
      _touched && _pass.text.length < 6 ? 'Parol kamida 6 belgidan iborat' : null;

  void _bumpForm() {
    setState(() => _shakeForm = true);
    Future<void>.delayed(const Duration(milliseconds: 460), () {
      if (mounted) setState(() => _shakeForm = false);
    });
  }

  Future<void> _submit() async {
    setState(() => _touched = true);
    if (_slugErr != null || _loginErr != null || _passErr != null) {
      _bumpForm();
      return;
    }
    if (_stage == SaAuthEntranceStage.launch) {
      _launchTimer?.cancel();
      setState(() => _stage = SaAuthEntranceStage.form);
    }
    // Cover faqat muvaffaqiyatli auth dan keyin (ref.listen) — shablon ketma-ketligi.
    ref.read(authStateProvider.notifier).login(
          slug: _slug.text.trim(),
          login: _login.text.trim(),
          password: _pass.text,
        );
  }

  Future<void> _onFaceId() async {
    if (_faceIdBusy) return;
    setState(() => _faceIdBusy = true);
    final result =
        await ref.read(authStateProvider.notifier).tryLoginScreenBiometric();
    if (!mounted) return;
    setState(() => _faceIdBusy = false);
    if (result == BiometricLoginAttempt.success) {
      setState(() => _stage = SaAuthEntranceStage.cover);
      return;
    }
    showAuthBottomToast(context, result.toastUz, accentColor: AppColors.error);
  }

  void _onForgotPassword() {
    showAuthBottomToast(
      context,
      'Parolni tiklash uchun administratorga murojaat qiling',
      accentColor: SaBrand.blue,
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    final loading =
        auth.status == AuthStatus.loading || auth.status == AuthStatus.bootstrapping;
    final launch = _stage == SaAuthEntranceStage.launch;
    final cover = _stage == SaAuthEntranceStage.cover;
    final form = _stage == SaAuthEntranceStage.form;
    final waveTop = saAuthEntranceWaveTop(_stage);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final h = MediaQuery.sizeOf(context).height;

    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.error != null && prev?.error != next.error) {
        final info = next.errorInfo ?? UserFacingError.tryParseLegacy(next.error);
        if (info != null) {
          _presentError(info);
        } else {
          if (_stage == SaAuthEntranceStage.cover) {
            setState(() => _stage = SaAuthEntranceStage.form);
          }
          showAuthBottomToast(context, next.error!, accentColor: AppColors.error);
        }
        return;
      }
      // Cover flood — faqat muvaffaqiyatli kirishdan keyin (katalog AuthScreen).
      if (next.status == AuthStatus.authenticated &&
          _stage != SaAuthEntranceStage.cover) {
        setState(() => _stage = SaAuthEntranceStage.cover);
      }
    });

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: true,
      body: SaLaunchZoom(
        child: Stack(
          children: [
            const Positioned.fill(
              child: RepaintBoundary(
                child: IgnorePointer(child: CustomPaint(painter: SaDotGridPainter())),
              ),
            ),
            Positioned.fill(
              child: RepaintBoundary(
                child: SaBrandWave(topFraction: waveTop, animate: true),
              ),
            ),

            // Brand lockup — launch markazda, formada tepada kichrayadi.
            AnimatedPositioned(
              duration: SaDurations.screen,
              curve: SaCurves.standard,
              left: 0,
              right: 0,
              top: cover ? h * 0.28 : (launch ? h * 0.32 : 48),
              child: AnimatedOpacity(
                duration: SaDurations.base,
                opacity: cover ? 0 : 1,
                child: AnimatedScale(
                  duration: SaDurations.screen,
                  curve: SaCurves.standard,
                  scale: launch ? 1 : 0.66,
                  child: Column(
                    children: [
                      const SaBrandMark(size: 64, draw: true),
                      const SizedBox(height: 10),
                      const SaEnter(
                        delay: Duration(milliseconds: 40),
                        child: SaBrandWordmark(size: 26),
                      ),
                      AnimatedOpacity(
                        duration: SaDurations.base,
                        opacity: launch ? 1 : 0,
                        child: const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'Savdo jamoasi uchun mobil ilova',
                            style: TextStyle(
                              fontSize: 12,
                              color: _sub,
                              fontWeight: FontWeight.w500,
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
              SafeArea(
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(24, 132, 24, 16 + bottomInset),
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        child: SaAuthShake(
                          shake: _shakeForm,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ..._form(loading),
                              if (kDebugMode || isLocalApiEnv()) ...[
                                const SizedBox(height: 12),
                                Text(
                                  apiEnvDisplayLabel(),
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.orange.shade800,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 120),
                            ],
                          ),
                        ),
                      ),
                    ),
                    SaEnter(
                      delay: const Duration(milliseconds: 200),
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
                              'Yordam · Texnik qo‘llab-quvvatlash',
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

            // Cover flood — brend ustida mark + «Kirish tasdiqlandi».
            if (cover)
              Positioned.fill(
                child: IgnorePointer(
                  child: Center(
                    child: SaEnter(
                      delay: const Duration(milliseconds: 120),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SaBrandMark(size: 72, bare: true, draw: false),
                          const SizedBox(height: 8),
                          const SaBrandWordmark(
                            size: 22,
                            tone: SaBrandTone.onBrand,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            loading ? 'Kirish tasdiqlandi…' : 'Kirish tasdiqlandi',
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

  List<Widget> _form(bool loading) {
    return [
      SaEnter(
        delay: const Duration(milliseconds: 50),
        child: _field(
          icon: Icons.apartment_outlined,
          controller: _slug,
          hint: 'Kompaniya kodi',
          enabled: !loading,
          error: _slugErr,
          textInputAction: TextInputAction.next,
        ),
      ),
      if (_slugErr != null) _err(_slugErr!),
      const SizedBox(height: 8),
      SaEnter(
        delay: const Duration(milliseconds: 90),
        child: _field(
          icon: Icons.person_outline_rounded,
          controller: _login,
          hint: 'Login yoki telefon',
          enabled: !loading,
          error: _loginErr,
          textInputAction: TextInputAction.next,
        ),
      ),
      if (_loginErr != null) _err(_loginErr!),
      const SizedBox(height: 8),
      SaEnter(
        delay: const Duration(milliseconds: 130),
        child: _field(
          icon: Icons.lock_outline_rounded,
          controller: _pass,
          hint: 'Parol',
          enabled: !loading,
          error: _passErr,
          obscure: _obscure,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
          suffix: IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: () => setState(() => _obscure = !_obscure),
            icon: Icon(
              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              size: 18,
              color: _sub,
            ),
          ),
        ),
      ),
      if (_passErr != null) _err(_passErr!),
      const SizedBox(height: 12),
      SaEnter(
        delay: const Duration(milliseconds: 160),
        child: Row(
          children: [
            InkWell(
              onTap: () => setState(() => _remember = !_remember),
              borderRadius: BorderRadius.circular(6),
              child: Row(
                children: [
                  Container(
                    width: 16,
                    height: 16,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _remember ? SaBrand.blue : Colors.transparent,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: _remember ? SaBrand.blue : _line),
                    ),
                    child: _remember
                        ? const Icon(Icons.check, size: 11, color: Colors.white)
                        : null,
                  ),
                  const SizedBox(width: 8),
                  const Text('Meni eslab qol', style: TextStyle(fontSize: 11, color: _sub)),
                ],
              ),
            ),
            const Spacer(),
            InkWell(
              onTap: _onForgotPassword,
              child: const Text(
                'Parolni unutdingizmi?',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _ink),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      const SaEnter(
        delay: Duration(milliseconds: 180),
        child: Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 10, height: 1.45, color: _sub),
            children: [
              TextSpan(text: 'Davom etish orqali '),
              TextSpan(
                text: 'Foydalanish shartlari',
                style: TextStyle(color: _ink, fontWeight: FontWeight.w700),
              ),
              TextSpan(text: ' va '),
              TextSpan(
                text: 'Maxfiylik siyosati',
                style: TextStyle(color: _ink, fontWeight: FontWeight.w700),
              ),
              TextSpan(text: 'ga rozilik bildirasiz.'),
            ],
          ),
          textAlign: TextAlign.center,
        ),
      ),
      const SizedBox(height: 14),
      SaEnter(
        delay: const Duration(milliseconds: 200),
        child: SaPressable(
          onTap: loading ? null : _submit,
          child: SizedBox(
            width: MediaQuery.sizeOf(context).width * 0.84,
            height: 48,
            child: ElevatedButton(
              onPressed: loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: SaBrand.blue,
                foregroundColor: Colors.white,
                disabledBackgroundColor: SaBrand.blue.withValues(alpha: 0.45),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
              ),
              child: loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Kirish',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                    ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 14),
      SaPressable(
        onTap: (loading || _faceIdBusy) ? null : _onFaceId,
        child: SizedBox(
          width: MediaQuery.sizeOf(context).width * 0.84,
          height: 48,
          child: OutlinedButton.icon(
            onPressed: (loading || _faceIdBusy) ? null : _onFaceId,
            icon: _faceIdBusy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: SaBrand.blue,
                    ),
                  )
                : const Icon(
                    Icons.face_retouching_natural,
                    size: 22,
                    color: SaBrand.blue,
                  ),
            label: const Text(
              'Face ID',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: _ink,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: _line),
              backgroundColor: Colors.white,
              foregroundColor: _ink,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  Widget _err(String t) => Padding(
        padding: const EdgeInsets.only(top: 4, left: 4),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            t,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xFFE0574B),
            ),
          ),
        ),
      );

  Widget _field({
    required IconData icon,
    required TextEditingController controller,
    required String hint,
    required bool enabled,
    String? error,
    bool obscure = false,
    Widget? suffix,
    TextInputAction? textInputAction,
    ValueChanged<String>? onSubmitted,
  }) {
    final err = error != null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: _fieldBg,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(
          color: err ? const Color(0xFFE0574B) : Colors.transparent,
          width: 1.2,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: _sub),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              obscureText: obscure,
              textInputAction: textInputAction,
              onSubmitted: onSubmitted,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: _ink,
              ),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: _sub,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          if (suffix != null) suffix,
        ],
      ),
    );
  }
}


