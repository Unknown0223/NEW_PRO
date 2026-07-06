import 'package:package_info_plus/package_info_plus.dart';

/// Ilova versiyasi — faqat `pubspec.yaml` (PackageInfo), shablon hardcode yo‘q.
class AppBuildInfo {
  AppBuildInfo._();

  static PackageInfo? _cached;

  static Future<PackageInfo> load() async {
    if (_cached != null) return _cached!;
    _cached = await PackageInfo.fromPlatform();
    return _cached!;
  }

  /// Web panel / login: `apk_version` (masalan «3.0.0»).
  static Future<String> versionOnly() async {
    final info = await load();
    final v = info.version.trim();
    return v.isNotEmpty ? v : '0.0.0';
  }

  /// Menyu: versiya + build (masalan «3.0.0+300»).
  static Future<String> versionWithBuild() async {
    final info = await load();
    final v = info.version.trim();
    final build = info.buildNumber.trim();
    if (v.isEmpty) return '0.0.0';
    if (build.isEmpty) return v;
    return '$v+$build';
  }
}
