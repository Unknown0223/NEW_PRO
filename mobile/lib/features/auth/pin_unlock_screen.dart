import 'dart:async';

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

/// Mahalliy qulf — PIN darhol ochadi; biometrik ixtiyoriy (telefon skaneri).
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
  bool _pinUnlocking = false;
  bool _initialized = false;
  int _bioGeneration = 0;

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

    // Avto-biometrik — foydalanuvchi PIN terayotganda bekor qilinadi.
    if (available) {
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (!mounted || _pin.isNotEmpty || _pinUnlocking) return;
      await _tryBiometric(auto: true);
    }
  }

  Future<void> _tryBiometric({bool auto = false}) async {
    if (!_bioEnabled || _bioInProgress || _pinUnlocking) return;
    if (auto && _pin.isNotEmpty) return;
    final gen = ++_bioGeneration;
    setState(() => _bioInProgress = true);
    final ok = await ref.read(authStateProvider.notifier).unlockWithBiometric();
    if (!mounted || gen != _bioGeneration) return;
    setState(() => _bioInProgress = false);
    if (!ok && !auto) {
      setState(() => _pin = '');
    }
  }

  void _cancelBiometricPrompt() {
    _bioGeneration++;
    if (_bioInProgress && mounted) {
      setState(() => _bioInProgress = false);
    } else {
      _bioInProgress = false;
    }
  }

  Future<void> _onDigit(String d) async {
    if (_pinUnlocking || _pin.length >= _pinLen) return;
    // PIN kiritilayotganda biometrik kutish PIN padni bloklamasligi kerak.
    _cancelBiometricPrompt();
    final next = _pin + d;
    setState(() => _pin = next);
    if (next.length != _pinLen) return;

    setState(() => _pinUnlocking = true);
    await ref.read(authStateProvider.notifier).unlockWithPin(next);
    if (!mounted) return;
    final status = ref.read(authStateProvider).status;
    if (status == AuthStatus.locked) {
      setState(() {
        _pin = '';
        _pinUnlocking = false;
      });
    }
    // ready/loading — ekran almashtiriladi; state tozalash shart emas.
  }

  void _backspace() {
    if (_pinUnlocking || _pin.isEmpty) return;
    _cancelBiometricPrompt();
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
        setState(() {
          _pin = '';
          _pinUnlocking = false;
        });
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
                  // Biometrik dialog ochiq bo‘lsa ham PIN terish mumkin.
                  enabled: !_pinUnlocking,
                  variant: PinPadVariant.unlock,
                  onDigit: (d) {
                    unawaited(_onDigit(d));
                  },
                  onBackspace: _backspace,
                ),
              const SizedBox(height: 22),
              if (_bioEnabled)
                PinBiometricButton(
                  label: _bioLabel,
                  loading: _bioInProgress && !_pinUnlocking,
                  onPressed: () => _tryBiometric(),
                ),
              const Spacer(),
              TextButton(
                onPressed: _pinUnlocking
                    ? null
                    : () => ref.read(authStateProvider.notifier).logout(),
                child: Text(
                  'Выйти',
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
