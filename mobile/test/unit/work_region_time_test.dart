import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/time/work_region_time.dart';

void main() {
  test('toWorkRegionFromIso — UTC+5', () {
    final wr = toWorkRegionFromIso('2026-06-14T02:58:00.000Z');
    expect(wr?.year, 2026);
    expect(wr?.month, 6);
    expect(wr?.day, 14);
    expect(wr?.hour, 7);
    expect(wr?.minute, 58);
  });

  test('formatWorkRegionDateTime', () {
    expect(
      formatWorkRegionDateTime('2026-06-14T02:58:00.000Z'),
      '14.06.2026 07:58',
    );
  });
}
