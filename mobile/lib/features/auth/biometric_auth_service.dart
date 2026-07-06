import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Biometrik (Face ID / Touch ID / fingerprint) bilan tez kirish — ixtiyoriy.
class BiometricAuthService {
  BiometricAuthService({
    LocalAuthentication? localAuth,
    FlutterSecureStorage? secureStorage,
  })  : _localAuth = localAuth ?? LocalAuthentication(),
        _storage = secureStorage ?? const FlutterSecureStorage();

  final LocalAuthentication _localAuth;
  final FlutterSecureStorage _storage;

  static const _enabledKey = 'biometric_login_enabled';

  Future<bool> isDeviceSupported() async {
    try {
      return await _localAuth.isDeviceSupported() && await _localAuth.canCheckBiometrics;
    } on PlatformException {
      return false;
    }
  }

  Future<bool> isEnabled() async {
    final v = await _storage.read(key: _enabledKey);
    return v == '1';
  }

  Future<void> setEnabled(bool enabled) async {
    if (enabled) {
      await _storage.write(key: _enabledKey, value: '1');
    } else {
      await _storage.delete(key: _enabledKey);
    }
  }

  /// Biometrik tasdiqlash — muvaffaqiyatli bo‘lsa `true`.
  Future<bool> authenticate({String reason = 'Kirish uchun biometrikani tasdiqlang'}) async {
    if (!await isDeviceSupported()) return false;
    if (!await isEnabled()) return false;
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }
}
