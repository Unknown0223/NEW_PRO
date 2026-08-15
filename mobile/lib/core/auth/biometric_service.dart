import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';

/// Biometric service — telefon qulfida ishlatiladigan barmoq izi / Face ID.
class BiometricService {
  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> isAvailable() async {
    try {
      if (!await _localAuth.isDeviceSupported()) {
        _log('isDeviceSupported=false');
        return false;
      }
      final canCheck = await _localAuth.canCheckBiometrics;
      final enrolled = await _localAuth.getAvailableBiometrics();
      if (enrolled.isNotEmpty) return true;
      if (canCheck) return true;
      _log('no enrolled biometrics: $enrolled, canCheck=$canCheck');
      return false;
    } on PlatformException catch (e) {
      _log('isAvailable PlatformException: ${e.code} ${e.message}');
      return false;
    } catch (e) {
      _log('isAvailable error: $e');
      return false;
    }
  }

  Future<bool> authenticate({
    String reason = 'Tizimga kirishni tasdiqlang',
    bool biometricOnly = false,
  }) async {
    try {
      final ok = await _localAuth.authenticate(
        localizedReason: reason,
        authMessages: const [
          AndroidAuthMessages(
            signInTitle: 'Sales Arena',
            biometricHint: 'Barmoq izini skanerlang',
            cancelButton: 'Bekor qilish',
          ),
        ],
        options: AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: biometricOnly,
          useErrorDialogs: true,
          sensitiveTransaction: false,
        ),
      );
      _log('authenticate result=$ok');
      return ok;
    } on PlatformException catch (e) {
      _log('authenticate PlatformException: ${e.code} ${e.message}');
      return false;
    } catch (e) {
      _log('authenticate error: $e');
      return false;
    }
  }

  Future<List<BiometricType>> getBiometricTypes() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } on PlatformException {
      return const [];
    }
  }

  /// UI matni: «отпечаток пальца», «Face ID» yoki ikkalasi.
  Future<String> getBiometricLabel({String locale = 'ru'}) async {
    final types = await getBiometricTypes();
    final hasFace = types.contains(BiometricType.face) || types.contains(BiometricType.iris);
    final hasFinger = types.contains(BiometricType.fingerprint);
    final hasStrong = types.contains(BiometricType.strong) || types.contains(BiometricType.weak);

    if (hasFace && hasFinger) {
      return locale == 'uz' ? 'barmoq izi yoki Face ID' : 'отпечаток пальца или Face ID';
    }
    if (hasFace) return 'Face ID';
    if (hasFinger || hasStrong) {
      return locale == 'uz' ? 'barmoq izi' : 'отпечаток пальца';
    }
    return locale == 'uz' ? 'biometrika' : 'биометрию';
  }

  void _log(String message) {
    if (kDebugMode) {
      debugPrint('[BiometricService] $message');
    }
  }
}

final biometricServiceProvider = Provider<BiometricService>((ref) {
  return BiometricService();
});
