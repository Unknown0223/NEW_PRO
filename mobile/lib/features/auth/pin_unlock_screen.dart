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
import '../../design_system/design_system.dart';
import 'auth_provider.dart';
import 'pin_pad.dart';

/// Shablon Auth PIN unlock — BrandWave + square dots + bio keypad.
class PinUnlockScreen extends ConsumerStatefulWidget {
  const PinUnlockScreen({super.key});

  @override
  ConsumerState<PinUnlockScreen> createState() => _PinUnlockScreenState();
}

class _PinUnlockScreenState extends ConsumerState<PinUnlockScreen> {
  static const _pinLen = 4;
  String _pin = '';
  bool _bioEnabled = false;
  bool _bioInProgress = false;
  bool _pinUnlocking = false;
  bool _initialized = false;
  bool _errorShake = false;
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

    if (!mounted) return;
    setState(() {
      _bioEnabled = available;
      _initialized = true;
    });

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
    _cancelBiometricPrompt();
    final next = _pin + d;
    setState(() {
      _pin = next;
      _errorShake = false;
    });
    if (next.length != _pinLen) return;

    setState(() => _pinUnlocking = true);
    await ref.read(authStateProvider.notifier).unlockWithPin(next);
    if (!mounted) return;
    final status = ref.read(authStateProvider).status;
    if (status == AuthStatus.locked) {
      setState(() {
        _pin = '';
        _pinUnlocking = false;
        _errorShake = true;
      });
      Future<void>.delayed(const Duration(milliseconds: 520), () {
        if (mounted) setState(() => _errorShake = false);
      });
    }
  }

  void _backspace() {
    if (_pinUnlocking || _pin.isEmpty) return;
    _cancelBiometricPrompt();
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _errorShake = false;
    });
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
          _errorShake = true;
        });
      }
    });

    final session = ref.watch(sessionProvider);
    final auth = ref.watch(authStateProvider);
    final userSubtitle = _userSubtitle(session);
    final initials = () {
      final n = session.user?.name.trim() ?? '';
      if (n.isEmpty) return 'SA';
      final parts = n.split(RegExp(r'\s+'));
      if (parts.length >= 2) {
        return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      }
      return n.substring(0, n.length.clamp(0, 2)).toUpperCase();
    }();

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const IgnorePointer(
            child: SaBrandWave(topFraction: 0.88, animate: true),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 26),
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: SaBrand.navy,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          initials,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SaBrandWordmark(size: 16),
                            if (userSubtitle.isNotEmpty)
                              Text(
                                userSubtitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.bodyMedium.copyWith(
                                  fontSize: 12,
                                  color: const Color(0xFF677386),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 36),
                  Text(
                    S.pinEnter,
                    style: AppTypography.headlineMedium.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0E1420),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 22),
                  SaAuthShake(
                    shake: _errorShake,
                    child: PinDots(
                      filled: _pin.length,
                      pinLength: _pinLen,
                      variant: PinDotsVariant.unlock,
                      error: _errorShake || auth.error != null,
                    ),
                  ),
                  if (auth.error != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      auth.error!,
                      textAlign: TextAlign.center,
                      style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                    ),
                  ] else if (_bioInProgress && !_pinUnlocking) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Biometrika tekshirilmoqda…',
                      textAlign: TextAlign.center,
                      style: AppTypography.bodySmall.copyWith(color: const Color(0xFF677386)),
                    ),
                  ],
                  const Spacer(),
                  if (!_initialized)
                    const SizedBox(height: 220)
                  else
                    PinPad(
                      enabled: !_pinUnlocking,
                      variant: PinPadVariant.unlock,
                      showBiometricSlot: _bioEnabled,
                      onBiometric: () => unawaited(_tryBiometric()),
                      onDigit: (d) => unawaited(_onDigit(d)),
                      onBackspace: _backspace,
                    ),
                  const SizedBox(height: 18),
                  TextButton(
                    onPressed: _pinUnlocking
                        ? null
                        : () => ref.read(authStateProvider.notifier).logout(),
                    child: Text(
                      'Выйти',
                      style: AppTypography.bodySmall.copyWith(color: const Color(0xFF677386)),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
