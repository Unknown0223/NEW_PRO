import 'dart:async';

import 'package:flutter/material.dart';

import '../app/app_build_info.dart';
import '../device/mobile_device_info.dart';
import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../../routing/app_router.dart';
import 'app_update_info.dart';
import 'app_update_installer.dart';

int _compareSemver(String a, String b) {
  List<int> parts(String v) {
    final core = v.replaceFirst(RegExp(r'^v', caseSensitive: false), '').split(RegExp(r'[+-]')).first;
    return core.split('.').map((x) => int.tryParse(x) ?? 0).toList();
  }

  final pa = parts(a);
  final pb = parts(b);
  final len = [pa.length, pb.length, 3].reduce((x, y) => x > y ? x : y);
  for (var i = 0; i < len; i++) {
    final da = i < pa.length ? pa[i] : 0;
    final db = i < pb.length ? pb[i] : 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

/// Majburiy/ixtiyoriy yangilash dialogi — APK serverdan yuklab o‘rnatiladi (kesh saqlanadi).
/// Majburiy: o‘rnatish oynasi ochilganda yopilmaydi — versiya haqiqatan o‘zgarguncha kutadi.
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

class _AppUpdateDialogState extends State<_AppUpdateDialog> with WidgetsBindingObserver {
  bool _busy = false;
  bool _waitingInstall = false;
  double _progress = 0;
  String? _status;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_onResumedAfterInstall());
    }
  }

  Future<void> _onResumedAfterInstall() async {
    if (!_waitingInstall || !mounted) return;
    AppBuildInfo.clearCache();
    MobileDeviceInfo.clearApkCache();
    final current = await MobileDeviceInfo.apkVersion;
    final latest = widget.info.latestVersion?.trim();
    if (latest != null && latest.isNotEmpty && _compareSemver(current, latest) >= 0) {
      if (!mounted) return;
      Navigator.pop(context, true);
      return;
    }
    if (!mounted) return;
    setState(() {
      _waitingInstall = false;
      _status =
          'Hali o‘rnatilmadi (hozir: $current). «Обновить» ni qayta bosing va Android oynasida «Yangilash» ni tasdiqlang.';
    });
  }

  String _friendlyUpdateError(Object e) {
    final raw = e.toString();
    final lower = raw.toLowerCase();
    if (lower.contains('404') || lower.contains('apknotfound')) {
      return 'APK serverda topilmadi (404). Administrator «Mobil ilova» bo‘limida '
          'APK ni qayta yuklashi kerak. Redeploydan keyin fayl yo‘qolishi mumkin.';
    }
    if (lower.contains('tenantnotfound')) {
      return 'Kompaniya kodi topilmadi. Qayta kiring yoki administrator bilan bog‘laning.';
    }
    if (lower.contains('connection') || lower.contains('socket') || lower.contains('timeout')) {
      return 'Tarmoq xatosi. Internetni tekshiring va qayta urinib ko‘ring.';
    }
    // Xom Dio stack ni UI da ko‘rsatmaslik
    if (raw.length > 180) {
      return 'Yuklab bo‘lmadi. Qayta urinib ko‘ring yoki administratorga murojaat qiling.';
    }
    return 'Xato: $raw';
  }

  Future<void> _startUpdate() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _progress = 0;
      _waitingInstall = false;
      _status = widget.inApp ? 'Yuklanmoqda…' : null;
    });

    if (widget.inApp) {
      try {
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
            _waitingInstall = true;
            _status =
                'Android o‘rnatish oynasi ochildi. «Yangilash» / «Установить» ni bosing. '
                'O‘rnatilgach ilova qayta ochiladi — PIN va kesh saqlanadi.';
          });
          // Majburiy yangilashda dialogni yopmaymiz — aks holda 3.1.5 da qolib qayta chiqadi.
          if (!widget.blocking) {
            Navigator.pop(context, true);
          }
          return;
        }
        setState(() {
          _busy = false;
          _status =
              'Yuklab/o‘rnatib bo‘lmadi. Sozlamalarda «Noma’lum manbalardan o‘rnatish» ruxsatini yoqing va qayta urinib ko‘ring.';
        });
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _busy = false;
          _status = _friendlyUpdateError(e);
        });
      }
      return;
    }

    final launched = await launchAppUpdateUrl(widget.info);
    if (!mounted) return;
    setState(() => _busy = false);
    if (launched) {
      if (widget.blocking) {
        setState(() {
          _waitingInstall = true;
          _status = 'Brauzerda APK ni yuklab o‘rnating, keyin ilovani qayta oching.';
        });
      } else {
        Navigator.pop(context, true);
      }
    }
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
              if (!widget.afterSync && !_waitingInstall) ...[
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
                Text(
                  _status!,
                  style: AppTypography.caption.copyWith(
                    color: _waitingInstall ? AppColors.primary : AppColors.error,
                  ),
                ),
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
            child: Text(
              _busy
                  ? 'Загрузка…'
                  : (_waitingInstall ? 'Снова обновить' : 'Обновить'),
            ),
          ),
        ],
      ),
    );
  }
}
