import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_env.dart';
import '../../core/errors/user_facing_error.dart';
import '../../core/theme/app_colors.dart';
import '../../core/ui/agent_ui.dart';
import '../../design_system/design_system.dart';
import 'auth_provider.dart';

/// Shablon `AuthScreen` — launch-zoom + au-in + BrandWave.
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

  static const _fieldBg = Color(0xFFEEF1F5);
  static const _ink = Color(0xFF0E1420);
  static const _sub = Color(0xFF677386);
  static const _line = Color(0xFFE4E8EF);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _showPendingAuthError());
  }

  void _presentError(UserFacingError info) {
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

  void _submit() {
    setState(() => _touched = true);
    if (_slugErr != null || _loginErr != null || _passErr != null) {
      _bumpForm();
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
    final loading =
        auth.status == AuthStatus.loading || auth.status == AuthStatus.bootstrapping;

    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.error == null || prev?.error == next.error) return;
      final info = next.errorInfo ?? UserFacingError.tryParseLegacy(next.error);
      if (info != null) {
        _presentError(info);
      } else {
        showAuthBottomToast(context, next.error!, accentColor: AppColors.error);
      }
    });

    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: Colors.white,
      resizeToAvoidBottomInset: true,
      body: SaLaunchZoom(
        child: Stack(
          children: [
            const Positioned.fill(
              child: RepaintBoundary(
                child: IgnorePointer(child: CustomPaint(painter: _DotGridPainter())),
              ),
            ),
            const Positioned.fill(
              child: RepaintBoundary(
                child: SaBrandWave(topFraction: 0.70, animate: true),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(24, 28, 24, 16 + bottomInset),
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      child: Column(
                        children: [
                          const SaBrandMark(size: 64, draw: true),
                          const SizedBox(height: 12),
                          SaEnter(
                            delay: const Duration(milliseconds: 40),
                            child: const SaBrandWordmark(size: 26),
                          ),
                          const SizedBox(height: 8),
                          SaEnter(
                            delay: const Duration(milliseconds: 80),
                            child: const Text(
                              'Savdo jamoasi uchun mobil ilova',
                              style: TextStyle(
                                fontSize: 12,
                                color: _sub,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          SaAuthShake(
                            shake: _shakeForm,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: _form(loading),
                            ),
                          ),
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
          ],
        ),
      ),
    );
  }

  List<Widget> _form(bool loading) {
    return [
      const SizedBox(height: 28),
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
            const Text(
              'Parolni unutdingizmi?',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _ink),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      SaEnter(
        delay: const Duration(milliseconds: 180),
        child: const Text.rich(
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

class _DotGridPainter extends CustomPainter {
  const _DotGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = const Color(0xFF14223F).withValues(alpha: 0.06);
    const step = 18.0;
    for (var y = 0.0; y < size.height; y += step) {
      for (var x = 0.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 0.8, p);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
