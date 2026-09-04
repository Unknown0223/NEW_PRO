import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/mobile_config_policy.dart';
import 'package:salesdoc_mobile/core/config/sync_window_countdown.dart';

void main() {
  group('timeUntilSyncWindowEnd', () {
    test('no window configured — default 06:00–22:00, at 12:24 until 22:00', () {
      const sync = SyncConfig();
      final now = DateTime(2026, 6, 14, 12, 24);
      final left = timeUntilSyncWindowEnd(sync, now);
      expect(left, isNotNull);
      expect(left!.inHours, 9);
      expect(left.inMinutes % 60, 36);
    });

    test('window 08:00–17:30 at 12:40 — allowed with ~4h50m until end', () {
      const sync = SyncConfig(allowedWindowFrom: '08:00', allowedWindowTo: '17:30');
      final now = DateTime(2026, 6, 14, 12, 40);
      expect(isSyncAllowedNow(sync, now), isTrue);
      final left = timeUntilSyncWindowEnd(sync, now);
      expect(left, isNotNull);
      expect(left!.inHours, 4);
      expect(left.inMinutes % 60, 50);
    });

    test('only to 16:00 at 11:34 — about 4.5 hours left', () {
      const sync = SyncConfig(allowedWindowTo: '16:00');
      final now = DateTime(2026, 6, 14, 11, 34);
      final left = timeUntilSyncWindowEnd(sync, now);
      expect(left, isNotNull);
      expect(left!.inHours, 4);
      expect(left.inMinutes % 60, 26);
    });

    test('overnight 22:00–06:00 at 23:00 — ends tomorrow 06:00', () {
      const sync = SyncConfig(allowedWindowFrom: '22:00', allowedWindowTo: '06:00');
      final now = DateTime(2026, 6, 14, 23, 0);
      final left = timeUntilSyncWindowEnd(sync, now);
      expect(left, isNotNull);
      expect(left!.inHours, 7);
    });

    test('outside custom window does not fall back to default end countdown', () {
      const sync = SyncConfig(allowedWindowFrom: '01:00', allowedWindowTo: '17:30');
      final now = DateTime(2026, 6, 14, 20, 33);
      expect(isSyncAllowedNow(sync, now), isFalse);
      expect(timeUntilSyncWindowEnd(sync, now), isNull);
      final untilStart = timeUntilSyncWindowStart(sync, now);
      expect(untilStart, isNotNull);
      expect(untilStart!.inHours, greaterThanOrEqualTo(4));
    });

    test('at 17:30:30 still allowed and end countdown within same minute', () {
      const sync = SyncConfig(allowedWindowFrom: '01:00', allowedWindowTo: '17:30');
      final now = DateTime(2026, 6, 14, 17, 30, 30);
      expect(isSyncAllowedNow(sync, now), isTrue);
      final left = timeUntilSyncWindowEnd(sync, now);
      expect(left, isNotNull);
      expect(left!.inSeconds, lessThan(60));
    });
  });
}
