import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/auth/entrance/role_road_math.dart';
import 'package:salesdoc_mobile/features/auth/entrance/role_welcome_meta.dart';

void main() {
  test('roleRoad math matches SplashArt constants', () {
    expect(roleRoadPeriod, 160);
    expect(roleRoadAngleDeg, -32);
    expect(roleRoadPinY, -47);
    expect(roleRoadEaseOut(0), 0);
    expect(roleRoadEaseOut(1), 1);
    expect(roleRoadEaseIn(0), 0);
    expect(roleRoadEaseIn(1), 1);
  });

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

  test('BOOT_ITEMS are 6 per role with counts', () {
    for (final role in ['agent', 'expeditor', 'supervisor', 'cashier']) {
      final items = roleWelcomeBootItems(role);
      expect(items.length, 6, reason: role);
      expect(items.first.label.isNotEmpty, true);
      expect(items.first.count.isNotEmpty, true);
    }
    expect(roleWelcomeBootItems('agent').first.label, 'Savdo nuqtalari');
  });

  test('roleWelcomeAccent is role-specific', () {
    expect(
      roleWelcomeAccent('agent').toARGB32(),
      isNot(roleWelcomeAccent('expeditor').toARGB32()),
    );
    expect(
      roleWelcomeAccent('supervisor').toARGB32(),
      isNot(roleWelcomeAccent('cashier').toARGB32()),
    );
  });
}
