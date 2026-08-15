import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import 'app_update_info.dart';

/// Android: serverdan APK yuklab o‘rnatish.
/// Kalit mos → ustiga yangilash (kesh/PIN saqlanadi).
/// Kalit mos emas → Downloads + o‘chirish + qayta o‘rnatish.
class AppUpdateInstaller {
  AppUpdateInstaller._();

  static const _channel = MethodChannel('uz.salesdoc/app_update');
  static final Dio _downloadDio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(minutes: 10),
    followRedirects: true,
    validateStatus: (s) => s != null && s >= 200 && s < 400,
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

    final resp = await _downloadDio.download(
      url,
      file.path,
      onReceiveProgress: (received, total) {
        if (total <= 0) return;
        onProgress?.call(received / total);
      },
    );

    final code = resp.statusCode ?? 0;
    if (code < 200 || code >= 400) return null;
    if (!await file.exists() || await file.length() < 1024 * 100) return null;

    final raf = await file.open();
    try {
      final magic = await raf.read(4);
      if (magic.length < 4 ||
          magic[0] != 0x50 ||
          magic[1] != 0x4B ||
          magic[2] != 0x03 ||
          magic[3] != 0x04) {
        try {
          await file.delete();
        } catch (_) {}
        return null;
      }
    } finally {
      await raf.close();
    }

    return file.path;
  }

  static Future<bool> installApk(String filePath) async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('installApk', {'path': filePath});
      return ok == true;
    } on PlatformException catch (e) {
      if (e.code == 'SIGNATURE_MISMATCH') {
        final details = e.details;
        String? apkPath = filePath;
        if (details is Map) {
          final p = details['apkPath'];
          if (p is String && p.isNotEmpty) apkPath = p;
        }
        throw AppUpdateSignatureException(
          e.message ??
              'Yangilash imkonsiz: telefoningizdagi ilova boshqa kalit bilan o‘rnatilgan.',
          apkPath: apkPath,
        );
      }
      rethrow;
    } catch (e) {
      if (e is AppUpdateSignatureException) rethrow;
      return false;
    }
  }

  /// Faqat kalit mos kelmasa — APK public Downloads da qoladi.
  static Future<Map<String, String?>> exportApkToDownloads(String filePath) async {
    if (!Platform.isAndroid) {
      throw StateError('Android only');
    }
    final raw = await _channel.invokeMethod<dynamic>(
      'exportApkToDownloads',
      {'path': filePath},
    );
    if (raw is! Map) {
      throw StateError('exportApkToDownloads failed');
    }
    return {
      'uri': raw['uri']?.toString(),
      'displayName': raw['displayName']?.toString(),
      'path': raw['path']?.toString(),
    };
  }

  static Future<bool> requestUninstall() async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('requestUninstall');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> openDownloads() async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('openDownloads');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> installExportedApk({String? uri, String? path}) async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('installExportedApk', {
        if (uri != null) 'uri': uri,
        if (path != null) 'path': path,
      });
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  /// Kalit mos → ustiga o‘rnatish. Mos emas → [AppUpdateSignatureException].
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

/// O‘rnatilgan APK va server APK imzolari mos kelmasa.
class AppUpdateSignatureException implements Exception {
  final String message;
  final String? apkPath;

  AppUpdateSignatureException(this.message, {this.apkPath});

  @override
  String toString() => message;
}
