import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import 'app_update_info.dart';

/// Android: serverdan APK yuklab, ilova ichida o‘rnatish (ma’lumotlar saqlanadi).
class AppUpdateInstaller {
  AppUpdateInstaller._();

  static const _channel = MethodChannel('uz.salesdoc/app_update');
  static final Dio _downloadDio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(minutes: 10),
    followRedirects: true,
    validateStatus: (s) => s != null && s < 500,
  ),);

  static bool canInstallInApp(AppUpdateInfo info) {
    if (!Platform.isAndroid) return false;
    final url = info.effectiveApkUrl;
    return url != null && url.isNotEmpty;
  }

  static Future<bool> canInstallPackages() async {
    if (!Platform.isAndroid) return false;
    try {
      final v = await _channel.invokeMethod<bool>('canInstallPackages');
      return v == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> openInstallPermissionSettings() async {
    if (!Platform.isAndroid) return false;
    try {
      await _channel.invokeMethod<void>('openInstallPermissionSettings');
      return true;
    } catch (_) {
      return openAppSettings();
    }
  }

  static Future<String?> downloadApk(
    String url, {
    void Function(double progress)? onProgress,
  }) async {
    if (!Platform.isAndroid) return null;
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/salesdoc-update.apk');
    if (await file.exists()) {
      try {
        await file.delete();
      } catch (_) {}
    }

    await _downloadDio.download(
      url,
      file.path,
      onReceiveProgress: (received, total) {
        if (total <= 0) return;
        onProgress?.call(received / total);
      },
    );

    if (!await file.exists() || await file.length() < 1024) return null;
    return file.path;
  }

  static Future<bool> installApk(String filePath) async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('installApk', {'path': filePath});
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> downloadAndInstall(
    AppUpdateInfo info, {
    void Function(double progress)? onProgress,
  }) async {
    final url = info.effectiveApkUrl;
    if (url == null || url.isEmpty) return false;

    if (!await canInstallPackages()) {
      await openInstallPermissionSettings();
      return false;
    }

    final path = await downloadApk(url, onProgress: onProgress);
    if (path == null) return false;
    return installApk(path);
  }
}
