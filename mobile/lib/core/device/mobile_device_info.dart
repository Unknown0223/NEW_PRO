import 'dart:io' show Platform;
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../app/app_build_info.dart';

/// Mobil qurilma va ilova haqida ma’lumot — web panel (sessiya, APK, qurilma nomi).
class MobileDeviceInfo {
  MobileDeviceInfo._();

  static String? _cachedName;
  static String? _cachedApk;
  static String? _cachedDeviceId;
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  static const String _deviceIdKey = 'device_id';

  /// Faqat versiya (`pubspec.yaml`) — build raqami web panelda ko‘rsatilmaydi.
  static Future<String> get apkVersion async {
    if (_cachedApk != null) return _cachedApk!;
    try {
      _cachedApk = await AppBuildInfo.versionOnly();
    } catch (_) {
      _cachedApk = '0.0.0';
    }
    return _cachedApk!;
  }

  static Future<String> get userAgent async {
    final v = await apkVersion;
    return 'SalecMobile/$v (${Platform.operatingSystem})';
  }

  /// Qurilma uchun barqaror identifikator (bir marta yaratiladi, secure storage'da saqlanadi).
  /// "Bitta qurilma — bitta sessiya": qayta kirilganda backend o'sha qurilma sessiyasini almashtiradi.
  static Future<String> deviceId() async {
    if (_cachedDeviceId != null) return _cachedDeviceId!;
    try {
      final existing = await _secureStorage.read(key: _deviceIdKey);
      if (existing != null && existing.trim().isNotEmpty) {
        _cachedDeviceId = existing.trim();
        return _cachedDeviceId!;
      }
    } catch (_) {
      /* ignore */
    }
    final fresh = _generateDeviceId();
    try {
      await _secureStorage.write(key: _deviceIdKey, value: fresh);
    } catch (_) {
      /* ignore */
    }
    _cachedDeviceId = fresh;
    return fresh;
  }

  static String _generateDeviceId() {
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return 'm-$hex';
  }

  /// Odatdagi telefon nomi (masalan «Samsung Galaxy A54» yoki «Android Emulator»).
  static Future<String> deviceName() async {
    if (_cachedName != null) return _cachedName!;
    try {
      final plugin = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        _cachedName = _androidDeviceLabel(await plugin.androidInfo);
      } else if (Platform.isIOS) {
        _cachedName = _iosDeviceLabel(await plugin.iosInfo);
      } else {
        _cachedName = Platform.operatingSystem;
      }
    } catch (_) {
      _cachedName = Platform.isAndroid ? 'Android' : (Platform.isIOS ? 'iOS' : 'Mobile');
    }
    return _cachedName!;
  }

  static String _androidDeviceLabel(AndroidDeviceInfo a) {
    if (!a.isPhysicalDevice || _looksLikeEmulator(a)) {
      return 'Android Emulator';
    }

    final manufacturer = _capitalizeWords(a.manufacturer.trim());
    final brand = _capitalizeWords(a.brand.trim());
    final model = a.model.trim();

    if (model.isEmpty) {
      return manufacturer.isNotEmpty ? manufacturer : 'Android';
    }

    final modelLower = model.toLowerCase();
    if (manufacturer.isNotEmpty && modelLower.startsWith(manufacturer.toLowerCase())) {
      return _capitalizeWords(model);
    }
    if (brand.isNotEmpty &&
        brand.toLowerCase() != manufacturer.toLowerCase() &&
        !modelLower.startsWith(brand.toLowerCase())) {
      return '$brand $model';
    }
    if (manufacturer.isNotEmpty) {
      return '$manufacturer $model';
    }
    return model;
  }

  static bool _looksLikeEmulator(AndroidDeviceInfo a) {
    final haystack = '${a.brand} ${a.model} ${a.device} ${a.product} ${a.hardware}'.toLowerCase();
    return haystack.contains('sdk') ||
        haystack.contains('emulator') ||
        haystack.contains('gphone') ||
        haystack.contains('generic') ||
        haystack.contains('vbox') ||
        haystack.contains('goldfish');
  }

  static String _iosDeviceLabel(IosDeviceInfo i) {
    if (!i.isPhysicalDevice) {
      return 'iOS Simulator';
    }
    final name = i.name.trim();
    if (name.isNotEmpty) return name;
    return _iosModelLabel(i.utsname.machine.trim()) ?? 'iPhone';
  }

  static String? _iosModelLabel(String machine) {
    const map = {
      'iPhone14,2': 'iPhone 13 Pro',
      'iPhone14,3': 'iPhone 13 Pro Max',
      'iPhone14,4': 'iPhone 13 mini',
      'iPhone14,5': 'iPhone 13',
      'iPhone14,7': 'iPhone 14',
      'iPhone14,8': 'iPhone 14 Plus',
      'iPhone15,2': 'iPhone 14 Pro',
      'iPhone15,3': 'iPhone 14 Pro Max',
      'iPhone15,4': 'iPhone 15',
      'iPhone15,5': 'iPhone 15 Plus',
      'iPhone16,1': 'iPhone 15 Pro',
      'iPhone16,2': 'iPhone 15 Pro Max',
    };
    return map[machine];
  }

  static String _capitalizeWords(String s) {
    if (s.isEmpty) return s;
    return s.split(RegExp(r'\s+')).map((w) {
      if (w.isEmpty) return w;
      if (w.length == 1) return w.toUpperCase();
      return '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}';
    }).join(' ');
  }

  static Future<Map<String, String>> authPayload() async {
    final name = await deviceName();
    final v = await apkVersion;
    return {
      'device_name': name,
      'device_id': await deviceId(),
      'user_agent': await userAgent,
      'apk_version': v,
    };
  }

  static Future<Map<String, String>> syncPayload() async => authPayload();
}
