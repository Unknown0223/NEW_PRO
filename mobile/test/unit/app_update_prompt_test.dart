import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/update/app_update_info.dart';
import 'package:salesdoc_mobile/core/update/app_update_prompt.dart';

void main() {
  const optional = AppUpdateInfo(
    required: false,
    optional: true,
    currentVersion: '3.1.24',
    latestVersion: '3.1.25',
  );

  const requiredUpdate = AppUpdateInfo(
    required: true,
    optional: false,
    currentVersion: '3.1.20',
    latestVersion: '3.1.25',
  );

  test('same-version optional is skipped after session prompt', () {
    expect(
      shouldSkipOptionalUpdate(
        info: optional,
        forcePrompt: false,
        sessionPromptedVersion: '3.1.25',
      ),
      isTrue,
    );
  });

  test('Позже snooze holds until expiry', () {
    final until = DateTime.utc(2026, 9, 4, 12);
    expect(
      shouldSkipOptionalUpdate(
        info: optional,
        forcePrompt: false,
        snoozedVersion: '3.1.25',
        snoozedUntil: until,
        now: DateTime.utc(2026, 9, 3, 16),
      ),
      isTrue,
    );
    expect(
      shouldSkipOptionalUpdate(
        info: optional,
        forcePrompt: false,
        snoozedVersion: '3.1.25',
        snoozedUntil: until,
        now: DateTime.utc(2026, 9, 5),
      ),
      isFalse,
    );
  });

  test('required and manual check are never snoozed', () {
    expect(
      shouldSkipOptionalUpdate(
        info: requiredUpdate,
        forcePrompt: false,
        sessionPromptedVersion: '3.1.25',
        snoozedVersion: '3.1.25',
        snoozedUntil: DateTime.utc(2026, 9, 10),
      ),
      isFalse,
    );
    expect(
      shouldSkipOptionalUpdate(
        info: optional,
        forcePrompt: true,
        sessionPromptedVersion: '3.1.25',
      ),
      isFalse,
    );
  });

  test('snooze encode/parse roundtrip', () {
    final until = DateTime.utc(2026, 9, 4, 10, 30);
    final raw = encodeAppUpdateSnooze('3.1.25', until);
    final parsed = parseAppUpdateSnooze(raw);
    expect(parsed?.version, '3.1.25');
    expect(parsed?.until.toUtc(), until);
  });

  test('AppUpdateInfo equality ignores notes-only differences for same version', () {
    const a = AppUpdateInfo(
      required: false,
      optional: true,
      currentVersion: '3.1.24',
      latestVersion: '3.1.25',
      apkUrl: 'https://x/apk',
    );
    const b = AppUpdateInfo(
      required: false,
      optional: true,
      currentVersion: '3.1.24',
      latestVersion: '3.1.25',
      apkUrl: 'https://x/apk',
      notes: 'other notes',
    );
    expect(a, equals(b));
  });
}
