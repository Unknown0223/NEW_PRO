import 'package:flutter/animation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/auth/entrance/template_auth_entrance.dart';

void main() {
  test('authEntranceWaveTop matches AuthScreen stage tops', () {
    expect(authEntranceWaveTop(AuthEntranceStage.launch), 1.0);
    expect(authEntranceWaveTop(AuthEntranceStage.form), 0.71);
    // Cover: CSS `-160px` ≈ −0.18 viewport overshoot.
    expect(authEntranceWaveTop(AuthEntranceStage.cover), -0.18);
  });

  test('authEntrance holds match AuthScreen timers', () {
    expect(authEntranceLaunchHold, const Duration(milliseconds: 1600));
    expect(authEntranceCoverHold, const Duration(milliseconds: 900));
  });

  test('authEntrance motion timings match AuthScreen CSS', () {
    expect(authEntranceAuIn, const Duration(milliseconds: 600));
    expect(authEntranceLaunchZoom, const Duration(milliseconds: 750));
    expect(authEntranceLogoMove, const Duration(milliseconds: 800));
    expect(authEntranceWaveMove, const Duration(milliseconds: 900));
    expect(authEntranceWordmarkDelay, const Duration(milliseconds: 650));
    expect(authEntranceTaglineDelay, const Duration(milliseconds: 900));
    expect(authEntranceCoverBrandDelay, const Duration(milliseconds: 380));
    expect(authEntranceCurve, const Cubic(0.16, 1.0, 0.3, 1.0));
    expect(authEntranceWaveCurve, const Cubic(0.7, 0.0, 0.2, 1.0));
  });

  test('authEntrance form stagger delays match AuthScreen au-in ladder', () {
    expect(authEntranceFormDelays, const [
      Duration(milliseconds: 80),
      Duration(milliseconds: 140),
      Duration(milliseconds: 200),
      Duration(milliseconds: 300),
      Duration(milliseconds: 350),
    ]);
  });
}
