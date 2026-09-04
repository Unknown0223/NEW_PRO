import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/gps/gps_tracker.dart';

void main() {
  test('GPS attach messages are specific (not a single permission line)', () {
    expect(
      GpsAttachOutcome.fail(GpsAttachIssue.serviceOff).message,
      contains('Joylashuv o‘chirilgan'),
    );
    expect(
      GpsAttachOutcome.fail(GpsAttachIssue.deniedForever).message,
      contains('Ilova sozlamalaridan'),
    );
    expect(
      GpsAttachOutcome.fail(GpsAttachIssue.noFix).message,
      contains('signali'),
    );
  });
}
