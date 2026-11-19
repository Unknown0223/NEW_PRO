import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/auth/entrance/template_auth_entrance.dart';

void main() {
  test('authEntranceWaveTop matches AuthScreen stage tops', () {
    expect(authEntranceWaveTop(AuthEntranceStage.launch), 1.0);
    expect(authEntranceWaveTop(AuthEntranceStage.form), 0.71);
    expect(authEntranceWaveTop(AuthEntranceStage.cover), 0.0);
  });

  test('authEntranceLaunchHold matches AuthScreen 1600ms', () {
    expect(authEntranceLaunchHold, const Duration(milliseconds: 1600));
  });

  test('authEntranceCoverHold matches AuthScreen 900ms', () {
    expect(authEntranceCoverHold, const Duration(milliseconds: 900));
  });
}
