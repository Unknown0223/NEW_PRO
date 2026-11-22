import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/auth/app_lock.dart';

void main() {
  test('pausedAt null → PIN yo‘q', () {
    expect(
      shouldLockAfterBackgroundIdle(pausedAt: null, now: DateTime.utc(2026, 1, 1, 12)),
      isFalse,
    );
  });

  test('4 daqiqa fon → PIN yo‘q', () {
    final paused = DateTime.utc(2026, 1, 1, 12, 0);
    final now = paused.add(const Duration(minutes: 4, seconds: 59));
    expect(shouldLockAfterBackgroundIdle(pausedAt: paused, now: now), isFalse);
  });

  test('5 daqiqa fon → PIN kerak', () {
    final paused = DateTime.utc(2026, 1, 1, 12, 0);
    final now = paused.add(const Duration(minutes: 5));
    expect(shouldLockAfterBackgroundIdle(pausedAt: paused, now: now), isTrue);
  });
}
