import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:salesdoc_mobile/core/auth/biometric_preferences.dart';
import 'package:salesdoc_mobile/core/auth/biometric_service.dart';
import 'package:salesdoc_mobile/core/auth/secure_store.dart';

class _MemorySecureStore implements SecureStoreReaderWriter {
  final Map<String, String> _data = {};

  @override
  Future<void> delete(String key) async {
    _data.remove(key);
  }

  @override
  Future<String?> read(String key) async => _data[key];

  @override
  Future<void> write(String key, String value) async {
    _data[key] = value;
  }
}

void main() {
  group('BiometricPreferences', () {
    late _MemorySecureStore store;
    late BiometricPreferences prefs;

    setUp(() {
      store = _MemorySecureStore();
      prefs = BiometricPreferences(store);
    });

    test('isEnabled reads current and legacy keys', () async {
      expect(await prefs.isEnabled(), isFalse);

      await store.write('biometric_lock_enabled', '1');
      expect(await prefs.isEnabled(), isTrue);

      await prefs.setEnabled(true);
      expect(await store.read('biometric_lock_enabled'), isNull);
      expect(await prefs.isEnabled(), isTrue);
    });

    test('setEnabled clears declined flag when turning on', () async {
      await prefs.setOfferDeclined(true);
      await prefs.setEnabled(true);

      expect(await prefs.isEnabled(), isTrue);
      expect(await prefs.wasOfferDeclined(), isFalse);
    });

    test('pending offer lifecycle', () async {
      expect(await prefs.hasPendingOffer(), isFalse);

      await prefs.setPendingOffer(true);
      expect(await prefs.hasPendingOffer(), isTrue);

      await prefs.setOfferShown();
      expect(await prefs.hasPendingOffer(), isFalse);
      expect(await prefs.wasOfferShown(), isTrue);
    });

    test('decline clears pending offer', () async {
      await prefs.setPendingOffer(true);
      await prefs.setOfferDeclined(true);

      expect(await prefs.wasOfferDeclined(), isTrue);
      expect(await prefs.hasPendingOffer(), isFalse);
    });

    test('repairOfferState clears stale pending when enabled or declined', () async {
      await prefs.setPendingOffer(true);
      await prefs.setOfferDeclined(true);
      await prefs.repairOfferState();
      expect(await prefs.hasPendingOffer(), isFalse);

      await prefs.setOfferDeclined(false);
      await prefs.setEnabled(true);
      await prefs.setPendingOffer(true);
      await prefs.repairOfferState();
      expect(await prefs.hasPendingOffer(), isFalse);
    });

    test('repairOfferState resets offerShown when biometrics still off', () async {
      await prefs.setOfferShown();
      expect(await prefs.wasOfferShown(), isTrue);

      await prefs.repairOfferState();
      expect(await prefs.wasOfferShown(), isFalse);
    });

    test('clearAll removes every biometric preference key', () async {
      await prefs.setEnabled(true);
      await prefs.setOfferDeclined(true);
      await prefs.setPendingOffer(true);
      await prefs.setOfferShown();
      await store.write('biometric_login_enabled', '1');

      await prefs.clearAll();

      expect(await prefs.isEnabled(), isFalse);
      expect(await prefs.wasOfferDeclined(), isFalse);
      expect(await prefs.hasPendingOffer(), isFalse);
      expect(await prefs.wasOfferShown(), isFalse);
      expect(await store.read('biometric_login_enabled'), isNull);
    });
  });

  group('BiometricService.labelForTypes', () {
    test('face only', () {
      expect(
        BiometricService.labelForTypes([BiometricType.face]),
        'Face ID',
      );
    });

    test('fingerprint only', () {
      expect(
        BiometricService.labelForTypes([BiometricType.fingerprint]),
        'отпечаток пальца',
      );
    });

    test('face and fingerprint', () {
      expect(
        BiometricService.labelForTypes([
          BiometricType.face,
          BiometricType.fingerprint,
        ]),
        'отпечаток пальца или Face ID',
      );
    });

    test('android strong biometrics fallback label', () {
      expect(
        BiometricService.labelForTypes([BiometricType.strong]),
        'отпечаток пальца',
      );
    });

    test('generic fallback when no types', () {
      expect(
        BiometricService.labelForTypes(const []),
        'биометрию',
      );
    });
  });
}
