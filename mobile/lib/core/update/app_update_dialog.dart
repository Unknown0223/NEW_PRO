import 'package:flutter/material.dart';

import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../../routing/app_router.dart';
import 'app_update_info.dart';
import 'app_update_installer.dart';

/// Majburiy/ixtiyoriy yangilash dialogi — APK serverdan yuklab o‘rnatiladi (kesh saqlanadi).
Future<bool> showAppUpdateDialog(
  AppUpdateInfo info, {
  required bool blocking,
  bool afterSync = false,
}) async {
  if (!info.hasAction) return true;

  final context = rootNavigatorKey.currentContext;
  if (context == null) return !blocking;

  final inApp = AppUpdateInstaller.canInstallInApp(info);
  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: !blocking,
    builder: (ctx) => _AppUpdateDialog(
      info: info,
      blocking: blocking,
      inApp: inApp,
      afterSync: afterSync,
    ),
  );

  return result ?? !blocking;
}

class _AppUpdateDialog extends StatefulWidget {
  final AppUpdateInfo info;
  final bool blocking;
  final bool inApp;
  final bool afterSync;

  const _AppUpdateDialog({
    required this.info,
    required this.blocking,
    required this.inApp,
    this.afterSync = false,
  });

  @override
  State<_AppUpdateDialog> createState() => _AppUpdateDialogState();
}

class _AppUpdateDialogState extends State<_AppUpdateDialog> {
  bool _busy = false;
  double _progress = 0;
  String? _status;

  Future<void> _startUpdate() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _progress = 0;
      _status = widget.inApp ? 'Yuklanmoqda…' : null;
    });

    if (widget.inApp) {
      final ok = await AppUpdateInstaller.downloadAndInstall(
        widget.info,
        onProgress: (p) {
          if (!mounted) return;
          setState(() {
            _progress = p;
            _status = 'Yuklanmoqda ${(p * 100).toStringAsFixed(0)}%';
          });
        },
      );
      if (!mounted) return;
      if (ok) {
        setState(() {
          _busy = false;
          _status =
              'O‘rnatish oynasi ochildi. «Yangilash» ni bosing — PIN, parol va kesh saqlanadi.';
        });
        Navigator.pop(context, true);
        return;
      }
      setState(() {
        _busy = false;
        _status = 'Yuklab bo‘lmadi. Ruxsatlar yoki internetni tekshiring.';
      });
      return;
    }

    final launched = await launchAppUpdateUrl(widget.info);
    if (!mounted) return;
    setState(() => _busy = false);
    if (launched) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    return PopScope(
      canPop: !widget.blocking && !_busy,
      child: AlertDialog(
        title: Text(widget.blocking ? S.appUpdateTitleRequired : S.appUpdateTitle),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.afterSync) ...[
                Text(
                  S.appUpdateAfterSyncHint,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.success),
                ),
                const SizedBox(height: 12),
              ],
              Text(
                'Текущая: ${info.currentVersion}'
                '${info.latestVersion != null ? ' → ${info.latestVersion}' : ''}',
                style: AppTypography.bodyMedium,
              ),
              if (info.minVersion != null) ...[
                const SizedBox(height: 6),
                Text('Минимальная версия: ${info.minVersion}', style: AppTypography.caption),
              ],
              if (info.notes != null && info.notes!.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(info.notes!, style: AppTypography.bodySmall),
              ],
              if (!widget.afterSync) ...[
                const SizedBox(height: 8),
                Text(
                  widget.inApp ? S.appUpdateBeforeInstallHint : storeUpdateHint(info),
                  style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                ),
              ],
              if (_busy && widget.inApp) ...[
                const SizedBox(height: 16),
                LinearProgressIndicator(value: _progress > 0 ? _progress : null),
                if (_status != null) ...[
                  const SizedBox(height: 8),
                  Text(_status!, style: AppTypography.caption),
                ],
              ] else if (_status != null) ...[
                const SizedBox(height: 12),
                Text(_status!, style: AppTypography.caption.copyWith(color: AppColors.primary)),
              ],
            ],
          ),
        ),
        actions: [
          if (widget.blocking && !_busy)
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Chiqish'),
            ),
          if (!widget.blocking && !_busy)
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Позже'),
            ),
          ElevatedButton(
            onPressed: _busy ? null : _startUpdate,
            child: Text(_busy ? 'Загрузка…' : 'Обновить'),
          ),
        ],
      ),
    );
  }
}
