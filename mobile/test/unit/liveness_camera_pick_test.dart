import 'package:camera/camera.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/attendance/liveness_camera_pick.dart';
import 'package:salesdoc_mobile/features/attendance/liveness_challenge.dart';

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

  test('front preview oynali: ekran-chap burish = LEFT (raw yaw manfiy)', () {
    // Oynali previewda foydalanuvchi strelka chapga → anatomik o‘ng → ML Kit yaw < 0.
    // Mirror bo‘lmasa matches(right) bo‘ladi — teskari yo‘nalish «o‘tadi».
    final pose = livenessPoseFromMlKit(
      yaw: -30,
      pitch: 0,
      frontCamera: true,
    );
    expect(pose.yaw, 30);
    expect(pose.matches(HeadDirection.left), isTrue);
    expect(pose.matches(HeadDirection.right), isFalse);
  });

  test('front: anatomik chap (raw +yaw) LEFT emas — teskari rad', () {
    final pose = livenessPoseFromMlKit(
      yaw: 30,
      pitch: 0,
      frontCamera: true,
    );
    expect(pose.matches(HeadDirection.left), isFalse);
    expect(pose.matches(HeadDirection.right), isTrue);
  });

  test('back kamera — raw yaw o‘zgarmaydi', () {
    final pose = livenessPoseFromMlKit(
      yaw: 30,
      pitch: 0,
      frontCamera: false,
    );
    expect(pose.yaw, 30);
    expect(pose.matches(HeadDirection.left), isTrue);
  });

  test('shouldMirrorFrontYaw — front doim true', () async {
    expect(
      await shouldMirrorFrontYaw(_cam(CameraLensDirection.front)),
      isTrue,
    );
    expect(
      await shouldMirrorFrontYaw(_cam(CameraLensDirection.back)),
      isFalse,
    );
  });
}
