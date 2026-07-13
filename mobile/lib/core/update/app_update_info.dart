import 'dart:io' show Platform;

import 'package:url_launcher/url_launcher.dart';

class AppUpdateInfo {
  final bool required;
  final bool optional;
  final String currentVersion;
  final String? minVersion;
  final String? latestVersion;
  final String? url;
  /// Serverdagi APK — ilova ichida yuklab o‘rnatish (SQLite/kesh saqlanadi).
  final String? apkUrl;
  final String? storeUrlAndroid;
  final String? storeUrlIos;
  final String? notes;

  const AppUpdateInfo({
    required this.required,
    required this.optional,
    required this.currentVersion,
    this.minVersion,
    this.latestVersion,
    this.url,
    this.apkUrl,
    this.storeUrlAndroid,
    this.storeUrlIos,
    this.notes,
  });

  factory AppUpdateInfo.fromJson(Map<String, dynamic> j) => AppUpdateInfo(
        required: j['required'] == true,
        optional: j['optional'] == true,
        currentVersion: j['current_version']?.toString() ?? '0.0.0',
        minVersion: j['min_version']?.toString(),
        latestVersion: j['latest_version']?.toString(),
        url: j['url']?.toString(),
        apkUrl: j['apk_url']?.toString(),
        storeUrlAndroid: j['store_url_android']?.toString(),
        storeUrlIos: j['store_url_ios']?.toString(),
        notes: j['notes']?.toString(),
      );

  bool get hasAction => required || optional;

  /// In-app o‘rnatish uchun APK manzili (do‘kondan mustaqil).
  String? get effectiveApkUrl {
    final apk = apkUrl?.trim();
    if (apk != null && apk.isNotEmpty) return apk;
    final u = url?.trim();
    if (u == null || u.isEmpty) return null;
    final lower = u.toLowerCase();
    if (lower.contains('.apk') ||
        lower.contains('apk-download') ||
        lower.contains('/mobile/apk')) {
      return u;
    }
    return null;
  }

  String? get launchUrl {
    if (Platform.isIOS && storeUrlIos != null && storeUrlIos!.isNotEmpty) {
      return storeUrlIos;
    }
    if (Platform.isAndroid && storeUrlAndroid != null && storeUrlAndroid!.isNotEmpty) {
      return storeUrlAndroid;
    }
    return url;
  }
}

Future<bool> launchAppUpdateUrl(AppUpdateInfo info) async {
  final target = info.launchUrl;
  if (target == null || target.isEmpty) return false;
  final uri = Uri.tryParse(target);
  if (uri == null) return false;
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Play Market / App Store havolasi mavjudligi (FAZA 9.8 kelajak).
bool get preferStoreUpdate {
  if (Platform.isIOS) return true;
  return Platform.isAndroid;
}

String storeUpdateHint(AppUpdateInfo info) {
  if (info.storeUrlAndroid != null || info.storeUrlIos != null) {
    return Platform.isIOS ? 'App Store orqali yangilang' : 'Google Play orqali yangilang';
  }
  return 'Yangi APK yuklab oling va o\'rnating';
}

/// Qo‘lda «Проверить обновление» natijasi.
sealed class AppUpdateManualCheckResult {
  const AppUpdateManualCheckResult();
}

class AppUpdateUpToDate extends AppUpdateManualCheckResult {
  final String currentVersion;
  const AppUpdateUpToDate(this.currentVersion);
}

class AppUpdateOffered extends AppUpdateManualCheckResult {
  const AppUpdateOffered();
}

class AppUpdateCheckFailed extends AppUpdateManualCheckResult {
  final String message;
  const AppUpdateCheckFailed(this.message);
}
