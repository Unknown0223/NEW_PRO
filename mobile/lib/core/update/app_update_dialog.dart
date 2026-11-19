import 'dart:async';

import 'package:flutter/material.dart';

import '../app/app_build_info.dart';
import '../device/mobile_device_info.dart';
import '../errors/error_reporter.dart';
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

Completer<bool>? _inFlightUpdateDialog;

/// Boshqa joylar (listener / notification) dialog ochiqligini bilishi uchun.
bool get isAppUpdateDialogInFlight {
  final g = _inFlightUpdateDialog;
  return g != null && !g.isCompleted;
}

const kAppUpdateDialogRouteName = 'app_update_dialog';

/// Kalit mos: ustiga yangilash. Kalit mos emas: Downloads → o‘chirish → qayta o‘rnatish.
/// Bir vaqtda bitta oyna — ustma-ust dialog ochilmasin.
Future<bool> showAppUpdateDialog(
  AppUpdateInfo info, {
  required bool blocking,
  bool afterSync = false,
  BuildContext? context,
}) async {
  if (!info.hasAction) return true;
  final existing = _inFlightUpdateDialog;
  if (existing != null && !existing.isCompleted) {
    return existing.future;
  }

  final ctx = context ?? rootNavigatorKey.currentContext;
  if (ctx == null || !ctx.mounted) {
    return !blocking;
  }

  // Slotni sync band qilamiz — ikkinchi chaqiriq shu yerda qo‘shiladi.
  final gate = Completer<bool>();
  _inFlightUpdateDialog = gate;

  try {
    final nav = Navigator.of(ctx, rootNavigator: true);
    // Orphan / oldingi yangilash overlay qolgan bo‘lsa — yopamiz.
    nav.popUntil((route) {
      final name = route.settings.name;
      if (name == kAppUpdateDialogRouteName) return false;
      return true;
    });

    final inApp = AppUpdateInstaller.canInstallInApp(info);
    final result = await showDialog<bool>(
      context: ctx,
      useRootNavigator: true,
      barrierDismissible: !blocking,
      routeSettings: const RouteSettings(name: kAppUpdateDialogRouteName),
      builder: (dialogCtx) => _AppUpdateDialog(
        info: info,
        blocking: blocking,
        inApp: inApp,
        afterSync: afterSync,
      ),
    );
    final proceed = result ?? !blocking;
    if (!gate.isCompleted) gate.complete(proceed);
    return proceed;
  } catch (e) {
    if (!gate.isCompleted) gate.complete(!blocking);
    rethrow;
  } finally {
    if (_inFlightUpdateDialog == gate) {
      _inFlightUpdateDialog = null;
    }
  }
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
  bool _signatureRecovery = false;
  double _progress = 0;
  String? _status;
  String? _recoveryMessage;
  String? _exportedUri;
  String? _exportedPath;
  String? _exportedDisplayName;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Faqat majburiy yangilashda avtomatik yuklash.
    // Ixtiyoriyda foydalanuvchi «Обновить» / «Позже» tanlaydi.
    if (widget.inApp && widget.blocking) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_busy && !_waitingInstall && !_signatureRecovery) {
          unawaited(_startUpdate());
        }
      });
    }
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
    if (!mounted) return;

    if (_signatureRecovery) {
      AppBuildInfo.clearCache();
      MobileDeviceInfo.clearApkCache();
      final current = await MobileDeviceInfo.apkVersion;
      final latest = widget.info.latestVersion?.trim();
      if (latest != null &&
          latest.isNotEmpty &&
          _compareSemver(current, latest) >= 0) {
        if (!mounted) return;
        Navigator.pop(context, true);
        return;
      }
      if (!mounted) return;
      setState(() {
        _busy = false;
        _waitingInstall = false;
        _status = _recoveryMessage;
      });
      return;
    }

    if (!_waitingInstall) return;
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
    if (e is AppUpdateSignatureException) {
      return e.message;
    }
    final raw = e.toString();
    final lower = raw.toLowerCase();
    if (lower.contains('signature_mismatch') || lower.contains('boshqa kalit')) {
      return raw.replaceFirst(RegExp(r'^Exception:\s*'), '');
    }
    if (lower.contains('404') || lower.contains('apknotfound')) {
      return 'APK serverda topilmadi (404). Administrator «Mobil ilova» bo‘limida '
          'APK ni qayta yuklashi kerak.';
    }
    if (lower.contains('tenantnotfound')) {
      return 'Kompaniya kodi topilmadi. Qayta kiring yoki administrator bilan bog‘laning.';
    }
    if (lower.contains('connection') || lower.contains('socket') || lower.contains('timeout')) {
      return 'Tarmoq xatosi. Internetni tekshiring va qayta urinib ko‘ring.';
    }
    if (raw.length > 180) {
      return 'Yuklab bo‘lmadi. Qayta urinib ko‘ring yoki administratorga murojaat qiling.';
    }
    return 'Xato: $raw';
  }

  Future<void> _enterSignatureRecovery(AppUpdateSignatureException e) async {
    final apkPath = e.apkPath;
    if (apkPath == null || apkPath.isEmpty) {
      setState(() {
        _busy = false;
        _status = e.message;
      });
      return;
    }

    setState(() {
      _busy = true;
      _waitingInstall = false;
      _status = 'APK Downloads papkasiga saqlanmoqda…';
    });

    try {
      final exported = await AppUpdateInstaller.exportApkToDownloads(apkPath);
      if (!mounted) return;
      final name = exported['displayName'] ?? 'SalesArena-update.apk';
      final msg =
          'Kalit mos emas — oddiy yangilash ishlamaydi.\n'
          'APK saqlandi: Downloads/$name\n\n'
          '1) «Ilovani o‘chirish» — tasdiqlang\n'
          '2) Downloads dagi $name ni ochib o‘rnating\n\n'
          'Muhim: avval o‘chiring, keyin APK ni oching.\n'
          'Ma’lumotlar serverda — login va PIN qayta sozlanadi.';
      setState(() {
        _busy = false;
        _signatureRecovery = true;
        _waitingInstall = false;
        _exportedUri = exported['uri'];
        _exportedPath = exported['path'];
        _exportedDisplayName = name;
        _recoveryMessage = msg;
        _status = msg;
      });
      // Darhol o‘chirish oynasi
      await AppUpdateInstaller.requestUninstall();
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _status =
            '${e.message}\n\nAPK ni Downloads ga saqlab bo‘lmadi: $err. '
            'Fayl menejeridan qo‘lda o‘rnating.';
      });
    }
  }

  Future<void> _openDownloadsFolder() async {
    await AppUpdateInstaller.openDownloads();
  }

  Future<void> _requestUninstall() async {
    await AppUpdateInstaller.requestUninstall();
  }

  Future<void> _installExported() async {
    setState(() {
      _busy = true;
      _status =
          'Agar ilova hali o‘rnatilgan bo‘lsa — avval o‘chiring.\n'
          'O‘chirilgan bo‘lsa Downloads/'
          '${_exportedDisplayName ?? 'SalesArena-update.apk'} o‘rnatiladi…';
    });
    final ok = await AppUpdateInstaller.installExportedApk(
      uri: _exportedUri,
      path: _exportedPath,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _waitingInstall = false;
      _status = ok
          ? (_recoveryMessage ?? 'O‘rnatish oynasi ochildi.')
          : 'O‘rnatish ochilmadi. Downloads papkasidan '
              '${_exportedDisplayName ?? 'SalesArena-update.apk'} ni oching.';
    });
  }

  Future<void> _startUpdate() async {
    if (_busy || _signatureRecovery) return;
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
      } on AppUpdateSignatureException catch (e) {
        if (!mounted) return;
        ErrorReporter.instance?.reportCaught(
          e,
          module: ErrorModules.update,
          code: 'AppUpdateSignatureMismatch',
          message: 'Обновление: несовпадение подписи APK',
          path: '/mobile/app-update',
          payload: {
            'latest_version': widget.info.latestVersion,
            'current_version': widget.info.currentVersion,
            'apk_path': e.apkPath,
          },
        );
        await _enterSignatureRecovery(e);
      } catch (e, st) {
        if (!mounted) return;
        ErrorReporter.instance?.reportCaught(
          e,
          stack: st,
          module: ErrorModules.update,
          code: 'AppUpdateInstallFailed',
          message: 'Обновление: загрузка/установка не удалась',
          path: '/mobile/app-update',
          payload: {
            'latest_version': widget.info.latestVersion,
            'current_version': widget.info.currentVersion,
          },
        );
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
        title: Text(
          _signatureRecovery
              ? 'Qayta o‘rnatish kerak'
              : (widget.blocking ? S.appUpdateTitleRequired : S.appUpdateTitle),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!_signatureRecovery) ...[
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
              ],
              if (_busy && widget.inApp && !_signatureRecovery) ...[
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
                    color: _signatureRecovery
                        ? AppColors.primary
                        : (_waitingInstall ? AppColors.primary : AppColors.error),
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          if (_signatureRecovery) ...[
            TextButton(
              onPressed: _busy ? null : _openDownloadsFolder,
              child: const Text('Downloads ochish'),
            ),
            TextButton(
              onPressed: _busy ? null : _installExported,
              child: const Text('APK o‘rnatish'),
            ),
            ElevatedButton(
              onPressed: _busy ? null : _requestUninstall,
              child: const Text('Ilovani o‘chirish'),
            ),
          ] else ...[
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
        ],
      ),
    );
  }
}
