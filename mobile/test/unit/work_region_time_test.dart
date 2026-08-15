import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/sync_window_countdown.dart';
import 'package:salesdoc_mobile/core/time/work_region_time.dart';

void main() {
  test('toWorkRegionFromIso — UTC+5 wall-clock (not isUtc)', () {
    final wr = toWorkRegionFromIso('2026-06-14T02:58:00.000Z');
    expect(wr?.year, 2026);
    expect(wr?.month, 6);
    expect(wr?.day, 14);
    expect(wr?.hour, 7);
    expect(wr?.minute, 58);
    expect(wr?.isUtc, isFalse);
  });

  test('formatWorkRegionDateTime', () {
    expect(
      formatWorkRegionDateTime('2026-06-14T02:58:00.000Z'),
      '14.06.2026 07:58',
    );
  });

  test('countdown to 22:00 uses wall-clock — not UTC/local mix', () {
    // 06:13 UTC = 11:13 Tashkent; until 22:00 = 10h47m
    final nowWr = workRegionWallClockFromUtc(DateTime.utc(2026, 8, 8, 6, 13));
    expect(nowWr.hour, 11);
    expect(nowWr.minute, 13);
    expect(nowWr.isUtc, isFalse);

    const sync = SyncConfig(allowedWindowFrom: '06:00', allowedWindowTo: '22:00');
    final left = timeUntilSyncWindowEnd(sync, nowWr);
    expect(left, isNotNull);
    expect(left!.inHours, 10);
    expect(left.inMinutes % 60, 47);
  });
}
