import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/face/face_gate_redirect.dart';

void main() {
  group('faceGateReadyRedirect', () {
    test('never redirects away from attendance (loop fix)', () {
      expect(
        faceGateReadyRedirect(
          matchedLocation: '/attendance',
          gateRequired: true,
        ),
        isNull,
      );
      expect(
        faceGateReadyRedirect(
          matchedLocation: '/attendance',
          gateRequired: false,
        ),
        isNull,
      );
    });

    test('sends home to attendance when gate on', () {
      expect(
        faceGateReadyRedirect(
          matchedLocation: '/home',
          gateRequired: true,
        ),
        '/attendance?gate=1',
      );
    });

    test('no jump when gate off and not on attendance', () {
      expect(
        faceGateReadyRedirect(
          matchedLocation: '/home',
          gateRequired: false,
        ),
        isNull,
      );
    });

    test('simulated former loop chain stays stable', () {
      // Old: attendance → home → attendance. New: attendance → null.
      var loc = '/attendance';
      final a = faceGateReadyRedirect(matchedLocation: loc, gateRequired: true);
      expect(a, isNull);

      loc = '/home';
      final b = faceGateReadyRedirect(matchedLocation: loc, gateRequired: true);
      expect(b, '/attendance?gate=1');

      loc = '/attendance';
      final c = faceGateReadyRedirect(matchedLocation: loc, gateRequired: true);
      expect(c, isNull);
    });
  });
}
