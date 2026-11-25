import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/settings/expeditor_profile_shortcuts.dart';

void main() {
  test('ulashishShortcutWave1 enabled without Tez orada badge', () {
    final s = ulashishShortcutWave1();
    expect(s.enabled, isTrue);
    expect(s.badge, isNull);
  });
}
