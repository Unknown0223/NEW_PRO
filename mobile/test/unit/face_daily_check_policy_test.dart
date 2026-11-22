import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/face/face_daily_check_policy.dart';

void main() {
  group('shouldAutoPromptDailyFace', () {
    test('auto once then wait for force', () {
      expect(
        shouldAutoPromptDailyFace(
          force: false,
          doneThisSession: false,
          alreadyPrompted: false,
        ),
        isTrue,
      );
      expect(
        shouldAutoPromptDailyFace(
          force: false,
          doneThisSession: false,
          alreadyPrompted: true,
        ),
        isFalse,
      );
      expect(
        shouldAutoPromptDailyFace(
          force: true,
          doneThisSession: false,
          alreadyPrompted: true,
        ),
        isTrue,
      );
    });

    test('skips when session done', () {
      expect(
        shouldAutoPromptDailyFace(
          force: false,
          doneThisSession: true,
          alreadyPrompted: false,
        ),
        isFalse,
      );
    });
  });

  group('allowSoftSkipDailyFace', () {
    test('hard block never soft-skips', () {
      expect(
        allowSoftSkipDailyFace(hardBlockRequired: true, userChoseLater: true),
        isFalse,
      );
      expect(
        allowSoftSkipDailyFace(hardBlockRequired: true, userChoseLater: false),
        isFalse,
      );
    });

    test('soft mode allows later', () {
      expect(
        allowSoftSkipDailyFace(hardBlockRequired: false, userChoseLater: true),
        isTrue,
      );
    });
  });
}
