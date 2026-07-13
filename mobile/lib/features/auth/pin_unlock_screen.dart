import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/app_pin_store.dart';
import '../../core/auth/biometric_preferences.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/auth/session.dart';
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
  bool _showPinPad = true;
  String _bioLabel = 'отпечаток пальца';
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
        : 'отпечаток пальца';

    if (!mounted) return;
    setState(() {
      _bioEnabled = available;
      _showPinPad = !available;
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
    if (!ok) {
      setState(() => _showPinPad = true);
    }
  }

  void _showPinFallback() {
    setState(() => _showPinPad = true);
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

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status == AuthStatus.locked && next.error != null && prev?.error != next.error) {
        setState(() => _pin = '');
      }
    });

    final session = ref.watch(sessionProvider);
    final auth = ref.watch(authStateProvider);
    final tenantLabel = session.tenantName?.trim().isNotEmpty == true
        ? session.tenantName!
        : (session.tenantSlug ?? '');
    final userLabel = session.user?.name.trim().isNotEmpty == true
        ? session.user!.name.trim()
        : session.user?.login ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 32),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  _bioEnabled && !_showPinPad ? Icons.fingerprint_rounded : Icons.lock_rounded,
                  size: 36,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _showPinPad ? 'Введите PIN' : 'Подтвердите $_bioLabel',
                style: AppTypography.displayMedium.copyWith(color: AppColors.textTitle),
                textAlign: TextAlign.center,
              ),
              if (tenantLabel.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(tenantLabel, style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted)),
              ],
              if (userLabel.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  userLabel,
                  style: AppTypography.bodyMedium.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textTitle,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              if (_showPinPad) ...[
                PinDots(filled: _pin.length, pinLength: _pinLen),
                if (auth.error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    auth.error!,
                    textAlign: TextAlign.center,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                  ),
                ],
              ] else ...[
                const SizedBox(height: 8),
                if (_bioInProgress)
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  )
                else
                  Text(
                    'Приложение SalesDoc заблокировано',
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                  ),
              ],
              const Spacer(),
              if (!_initialized)
                const SizedBox(height: 120)
              else if (_showPinPad) ...[
                PinPad(
                  enabled: true,
                  onDigit: _onDigit,
                  onBackspace: _backspace,
                  showBiometric: _bioEnabled,
                  onBiometric: _bioEnabled ? () => _tryBiometric() : null,
                ),
              ] else ...[
                Material(
                  color: AppColors.surfaceVariant,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _bioInProgress ? null : () => _tryBiometric(),
                    child: SizedBox(
                      width: 88,
                      height: 88,
                      child: Icon(
                        Icons.fingerprint_rounded,
                        size: 48,
                        color: _bioInProgress ? AppColors.textMuted : AppColors.primary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                TextButton(
                  onPressed: _bioInProgress ? null : _showPinFallback,
                  child: const Text('Ввести PIN'),
                ),
                const SizedBox(height: 48),
              ],
              TextButton(
                onPressed: () => ref.read(authStateProvider.notifier).logout(),
                child: const Text('Войти другим аккаунтом'),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
