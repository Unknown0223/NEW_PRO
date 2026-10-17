import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/gps/gps_tracker.dart';

void main() {
  test('GPS attach messages are specific (not a single permission line)', () {
    expect(
      GpsAttachOutcome.fail(GpsAttachIssue.serviceOff).message,
      contains('Геолокация выключена'),
    );
    expect(
      GpsAttachOutcome.fail(GpsAttachIssue.deniedForever).message,
      contains('настройках приложения'),
    );
    expect(
      GpsAttachOutcome.fail(GpsAttachIssue.noFix).message,
      contains('Сигнал GPS'),
    );
  });
}
