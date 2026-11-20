import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/auth/entrance/role_welcome_meta.dart';

void main() {
  test('roleWelcome timings match RoleWelcome.tsx', () {
    expect(roleWelcomeRevealHold, const Duration(milliseconds: 1150));
    expect(roleWelcomeFirstStepHold, const Duration(milliseconds: 1300));
    expect(roleWelcomeStepHold, const Duration(milliseconds: 430));
    expect(roleWelcomeDoneHold, const Duration(milliseconds: 800));
    expect(roleWelcomeLeaveHold, const Duration(milliseconds: 900));
    expect(roleWelcomeHelloDelay, const Duration(milliseconds: 1250));
    expect(roleWelcomeNameBaseDelay, const Duration(milliseconds: 1320));
    expect(roleWelcomeNameLetterStep, const Duration(milliseconds: 45));
    expect(roleWelcomeWordmarkDelay, const Duration(milliseconds: 1650));
    expect(roleWelcomeTaglineDelay, const Duration(milliseconds: 1780));
  });

  test('SPLASH_META covers mobile roles', () {
    for (final role in ['agent', 'expeditor', 'supervisor', 'cashier']) {
      final meta = roleWelcomeMeta(role);
      expect(meta.word.isNotEmpty, true, reason: role);
      expect(meta.tagline.isNotEmpty, true, reason: role);
    }
  });

  test('roleWelcomeAccent is role-specific', () {
    expect(roleWelcomeAccent('agent').toARGB32(), isNot(roleWelcomeAccent('expeditor').toARGB32()));
    expect(roleWelcomeAccent('supervisor').toARGB32(), isNot(roleWelcomeAccent('cashier').toARGB32()));
  });
}
