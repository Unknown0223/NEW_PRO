import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/app_pin_store.dart';
import '../../core/auth/biometric_preferences.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/auth/session.dart';
import '../../core/l10n/app_strings_ru.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'auth_provider.dart';
import 'pin_pad.dart';

/// Mahalliy qulf — biometrik yoqilgan bo‘lsa avval skaner, bekor qilinsa PIN.
class PinUnlockScreen extends ConsumerStatefulWidget {
  const PinUnlockScreen({super.key});

  @override
  ConsumerState<PinUnlockScreen> createState() => _PinUnlockScreenState();
}

class _PinUnlockScreenState extends ConsumerState<PinUnlockScreen> {
  static const _pinLen = 4;
  String _pin = '';
  bool _bioEnabled = false;
  String _bioLabel = S.touchId;
  bool _bioInProgress = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    await ref.read(appPinStoreProvider).warmCache();
    final prefs = ref.read(biometricPreferencesProvider);
    final enabled = await prefs.isEnabled();
    final available = enabled && await ref.read(biometricServiceProvider).isAvailable();
    final label = available
        ? await ref.read(biometricServiceProvider).getBiometricLabel()
        : S.touchId;

    if (!mounted) return;
    setState(() {
      _bioEnabled = available;
      _bioLabel = label;
      _initialized = true;
    });

    if (available) {
      await Future<void>.delayed(const Duration(milliseconds: 450));
      if (!mounted) return;
      await _tryBiometric(auto: true);
    }
  }

  Future<void> _tryBiometric({bool auto = false}) async {
    if (!_bioEnabled || _bioInProgress) return;
    setState(() => _bioInProgress = true);
    final ok = await ref.read(authStateProvider.notifier).unlockWithBiometric();
    if (!mounted) return;
    setState(() => _bioInProgress = false);
    if (!ok && !auto) {
      setState(() => _pin = '');
    }
  }

  void _onDigit(String d) {
    if (_pin.length >= _pinLen) return;
    setState(() => _pin += d);
    if (_pin.length == _pinLen) {
      ref.read(authStateProvider.notifier).unlockWithPin(_pin);
      Future.microtask(() {
        if (mounted) setState(() => _pin = '');
      });
    }
  }

  void _backspace() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  String _userSubtitle(SessionState session) {
    final name = session.user?.name.trim();
    final code = session.user?.code?.trim();
    final login = session.user?.login.trim();

    final displayName = (name != null && name.isNotEmpty)
        ? name
        : ((login != null && login.isNotEmpty) ? login : '');
    final displayCode = (code != null && code.isNotEmpty) ? code : '';

    if (displayName.isNotEmpty && displayCode.isNotEmpty) {
      return '$displayName · $displayCode';
    }
    if (displayName.isNotEmpty) return displayName;
    if (displayCode.isNotEmpty) return displayCode;
    return session.tenantSlug ?? '';
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status == AuthStatus.locked && next.error != null && prev?.error != next.error) {
        setState(() => _pin = '');
      }
    });

    final session = ref.watch(sessionProvider);
    final auth = ref.watch(authStateProvider);
    final userSubtitle = _userSubtitle(session);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 26),
          child: Column(
            children: [
              const SizedBox(height: 56),
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(Icons.lock_rounded, size: 26, color: AppColors.primary),
              ),
              const SizedBox(height: 18),
              Text(
                S.pinEnter,
                style: AppTypography.headlineMedium.copyWith(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textTitle,
                ),
                textAlign: TextAlign.center,
              ),
              if (userSubtitle.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  userSubtitle,
                  style: AppTypography.bodyMedium.copyWith(
                    fontSize: 13,
                    color: AppColors.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 30),
              PinDots(
                filled: _pin.length,
                pinLength: _pinLen,
                variant: PinDotsVariant.unlock,
              ),
              if (auth.error != null) ...[
                const SizedBox(height: 12),
                Text(
                  auth.error!,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                ),
              ],
              const SizedBox(height: 38),
              if (!_initialized)
                const SizedBox(height: 248)
              else
                PinPad(
                  enabled: !_bioInProgress,
                  variant: PinPadVariant.unlock,
                  onDigit: _onDigit,
                  onBackspace: _backspace,
                ),
              const SizedBox(height: 22),
              if (_bioEnabled)
                PinBiometricButton(
                  label: _bioLabel,
                  loading: _bioInProgress,
                  onPressed: _tryBiometric,
                ),
              const Spacer(),
              TextButton(
                onPressed: () => ref.read(authStateProvider.notifier).logout(),
                child: Text(
                  S.loginOtherAccount,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
