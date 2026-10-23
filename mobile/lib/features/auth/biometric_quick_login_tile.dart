import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/biometric_preferences.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/ui/agent_ui.dart';
import 'auth_provider.dart';

/// Быстрый вход по Face ID / отпечатку — настройки профиля и «Настройки».
class BiometricQuickLoginTile extends ConsumerStatefulWidget {
  final Color? accentColor;
  final EdgeInsetsGeometry? padding;

  const BiometricQuickLoginTile({
    super.key,
    this.accentColor,
    this.padding,
  });

  @override
  ConsumerState<BiometricQuickLoginTile> createState() => _BiometricQuickLoginTileState();
}

class _BiometricQuickLoginTileState extends ConsumerState<BiometricQuickLoginTile> {
  bool _loading = true;
  bool _available = false;
  bool _enabled = false;
  String _label = 'биометрию';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final bio = ref.read(biometricServiceProvider);
    final prefs = ref.read(biometricPreferencesProvider);
    final available = await bio.isAvailable();
    final enabled = available && await prefs.isEnabled();
    final label = available ? await bio.getBiometricLabel() : 'биометрию';
    if (!mounted) return;
    setState(() {
      _available = available;
      _enabled = enabled;
      _label = label;
      _loading = false;
    });
  }

  Future<void> _onChanged(bool value) async {
    if (value) {
      final ok = await ref.read(authStateProvider.notifier).enableBiometricLock();
      if (!mounted) return;
      if (ok) {
        setState(() => _enabled = true);
        showAgentToast(
          context,
          'Быстрый вход по биометрии включён',
          accentColor: AppColors.success,
        );
      } else {
        showAgentToast(
          context,
          'Не удалось включить биометрию. Проверьте настройки телефона.',
          accentColor: AppColors.warning,
        );
      }
    } else {
      await ref.read(authStateProvider.notifier).disableBiometricLock();
      if (mounted) setState(() => _enabled = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || !_available) return const SizedBox.shrink();

    final accent = widget.accentColor ?? AppColors.primary;
    return Padding(
      padding: widget.padding ?? EdgeInsets.zero,
      child: SwitchListTile(
        value: _enabled,
        activeThumbColor: accent,
        onChanged: _onChanged,
        secondary: Icon(Icons.fingerprint_rounded, color: accent),
        title: const Text(
          'Быстрый вход',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '$_label — только на этом телефоне, не на сервере',
          style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
        ),
      ),
    );
  }
}
