import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/auth/biometric_login_attempt.dart';

void main() {
  test('notAvailable toast matni', () {
    expect(
      BiometricLoginAttempt.notAvailable.toastUz,
      'Face ID / biometriya telefonda yoqilmagan',
    );
  });

  test('failed toast bo‘sh emas', () {
    expect(BiometricLoginAttempt.failed.toastUz.isNotEmpty, isTrue);
  });
}
