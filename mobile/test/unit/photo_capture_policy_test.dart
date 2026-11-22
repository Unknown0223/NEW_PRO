import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/camera/photo_capture_policy.dart';

void main() {
  group('photoCaptureUserMessage', () {
    test('maps known platform codes', () {
      expect(
        photoCaptureUserMessage('no_available_camera'),
        contains('Kamera topilmadi'),
      );
      expect(
        photoCaptureUserMessage('camera_access_denied'),
        contains('ruxsati'),
      );
      expect(
        photoCaptureUserMessage('camera_unavailable'),
        contains('band'),
      );
    });

    test('falls back for unknown code', () {
      expect(photoCaptureUserMessage('weird'), contains('Kamerani ochib'));
      expect(photoCaptureUserMessage(null, fallback: 'X'), 'X');
    });
  });
}
