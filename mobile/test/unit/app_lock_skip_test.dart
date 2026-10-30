import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/auth/app_lock.dart';

void main() {
  test('isExternalCaptureSkipLockValid: bo‘sh → false', () {
    expect(isExternalCaptureSkipLockValid(null), isFalse);
    expect(isExternalCaptureSkipLockValid(''), isFalse);
    expect(isExternalCaptureSkipLockValid('not-a-date'), isFalse);
  });

  test('isExternalCaptureSkipLockValid: kelajak TTL → true', () {
    final until = DateTime.now().toUtc().add(const Duration(minutes: 2)).toIso8601String();
    expect(isExternalCaptureSkipLockValid(until), isTrue);
  });

  test('isExternalCaptureSkipLockValid: o‘tgan TTL → false', () {
    final past = DateTime.now().toUtc().subtract(const Duration(minutes: 1)).toIso8601String();
    expect(isExternalCaptureSkipLockValid(past), isFalse);
  });
}
