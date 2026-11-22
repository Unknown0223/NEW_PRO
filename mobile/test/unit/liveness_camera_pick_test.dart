import 'package:camera/camera.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/liveness_camera_pick.dart';

CameraDescription _cam(CameraLensDirection lens, {String name = '0'}) {
  return CameraDescription(
    name: name,
    lensDirection: lens,
    sensorOrientation: 90,
  );
}

void main() {
  test('bo‘sh → null', () {
    expect(selectLivenessCamera(const []), isNull);
  });

  test('front afzal', () {
    final back = _cam(CameraLensDirection.back, name: '0');
    final front = _cam(CameraLensDirection.front, name: '1');
    expect(selectLivenessCamera([back, front]), same(front));
  });

  test('faqat back → back (emulyator)', () {
    final back = _cam(CameraLensDirection.back);
    expect(selectLivenessCamera([back]), same(back));
  });
}
