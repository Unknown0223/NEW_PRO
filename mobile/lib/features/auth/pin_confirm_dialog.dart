import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/app_pin_store.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'pin_pad.dart';

/// Muhim amal uchun PIN tasdiq (biometrika yo'q bo'lsa).
Future<bool> showPinConfirmDialog(
  BuildContext context,
  WidgetRef ref, {
  required String title,
}) async {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (ctx) => _PinConfirmSheet(title: title),
  );
  return ok == true;
}

class _PinConfirmSheet extends ConsumerStatefulWidget {
  final String title;
  const _PinConfirmSheet({required this.title});

  @override
  ConsumerState<_PinConfirmSheet> createState() => _PinConfirmSheetState();
}

class _PinConfirmSheetState extends ConsumerState<_PinConfirmSheet> {
  String _pin = '';
  String? _error;
  bool _checking = false;

  Future<void> _onDigit(String d) async {
    if (_checking || _pin.length >= 4) return;
    setState(() {
      _pin += d;
      _error = null;
    });
    if (_pin.length < 4) return;

    setState(() => _checking = true);
    final ok = await ref.read(appPinStoreProvider).verifyPin(_pin);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context, true);
      return;
    }
    setState(() {
      _checking = false;
      _pin = '';
      _error = 'Неверный PIN';
    });
  }

  void _backspace() {
    if (_checking || _pin.isEmpty) return;
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.title,
              textAlign: TextAlign.center,
              style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'Введите PIN для подтверждения',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
            ),
            const SizedBox(height: 16),
            PinDots(filled: _pin.length, variant: PinDotsVariant.unlock),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: AppTypography.bodySmall.copyWith(color: AppColors.error)),
            ],
            const SizedBox(height: 20),
            PinPad(
              enabled: !_checking,
              variant: PinPadVariant.unlock,
              onDigit: (d) => _onDigit(d),
              onBackspace: _backspace,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _checking ? null : () => Navigator.pop(context, false),
              child: const Text('Отмена'),
            ),
          ],
        ),
      ),
    );
  }
}
