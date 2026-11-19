import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/design_system/design_system.dart';

/// Seam: AuthScreen `waveTop` / logo settle — katalog bilan mos.
void main() {
  test('saAuthEntranceWaveTop matches AuthScreen stage tops', () {
    expect(saAuthEntranceWaveTop(SaAuthEntranceStage.launch), 1.0);
    expect(saAuthEntranceWaveTop(SaAuthEntranceStage.form), 0.71);
    expect(saAuthEntranceWaveTop(SaAuthEntranceStage.cover), 0.0);
  });

  test('saAuthEntranceLaunchHold matches AuthScreen 1600ms', () {
    expect(saAuthEntranceLaunchHold, const Duration(milliseconds: 1600));
  });

  test('saAuthEntranceCoverHold matches AuthScreen 900ms', () {
    expect(saAuthEntranceCoverHold, const Duration(milliseconds: 900));
  });
}
