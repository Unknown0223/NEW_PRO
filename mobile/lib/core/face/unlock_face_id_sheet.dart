import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'unlock_face_id.dart';

/// Kunlik / verify Face gate: glyph + «Сканировать» → caller kamera/verify qiladi.
Future<bool?> showUnlockFaceIdSheet({
  required BuildContext context,
  required String title,
  required String body,
  required Future<bool> Function() onScanAndVerify,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _UnlockFaceIdSheet(
      title: title,
      body: body,
      onScanAndVerify: onScanAndVerify,
    ),
  );
}

class _UnlockFaceIdSheet extends StatefulWidget {
  const _UnlockFaceIdSheet({
    required this.title,
    required this.body,
    required this.onScanAndVerify,
  });

  final String title;
  final String body;
  final Future<bool> Function() onScanAndVerify;

  @override
  State<_UnlockFaceIdSheet> createState() => _UnlockFaceIdSheetState();
}

class _UnlockFaceIdSheetState extends State<_UnlockFaceIdSheet> {
  UnlockFaceStatus _status = UnlockFaceStatus.idle;
  String _error = 'Лицо не распознано. Попробуйте ещё раз.';

  Future<void> _run() async {
    if (_status == UnlockFaceStatus.scanning ||
        _status == UnlockFaceStatus.success) {
      return;
    }
    setState(() {
      _status = UnlockFaceStatus.scanning;
      _error = 'Лицо не распознано. Попробуйте ещё раз.';
    });
    try {
      final ok = await widget.onScanAndVerify();
      if (!mounted) return;
      if (ok) {
        setState(() => _status = UnlockFaceStatus.success);
        await Future<void>.delayed(const Duration(milliseconds: 650));
        if (mounted) Navigator.pop(context, true);
      } else {
        setState(() => _status = UnlockFaceStatus.error);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _status = UnlockFaceStatus.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = _status == UnlockFaceStatus.scanning;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            const SizedBox(height: 16),
            Text(widget.title, style: AppTypography.titleMedium),
            const SizedBox(height: 8),
            Text(
              widget.body,
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
            ),
            const SizedBox(height: 24),
            UnlockFaceId(
              status: _status,
              size: 128,
              errorMessage: _error,
              onTap: busy ? null : _run,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: busy || _status == UnlockFaceStatus.success
                    ? null
                    : _run,
                child: Text(
                  _status == UnlockFaceStatus.error
                      ? 'Повторить'
                      : busy
                          ? 'Сканирование…'
                          : 'Сканировать',
                ),
              ),
            ),
            TextButton(
              onPressed: busy ? null : () => Navigator.pop(context, false),
              child: const Text('Отмена'),
            ),
          ],
        ),
      ),
    );
  }
}
