import 'package:camera/camera.dart';

import 'liveness_challenge.dart';

/// Sof: old kamera afzal; yo‘q bo‘lsa birinchisi (emulyator orqa-only).
CameraDescription? selectLivenessCamera(List<CameraDescription> cams) {
  if (cams.isEmpty) return null;
  for (final c in cams) {
    if (c.lensDirection == CameraLensDirection.front) return c;
  }
  return cams.first;
}

/// ML Kit Euler → HeadPose.
///
/// Front CameraPreview odatda oynali: ekrandagi «chap» strelka = anatomik o‘ng =
/// raw `headEulerAngleY` manfiy. Shuning uchun front yaw ni aylantiramiz —
/// aks holda teskari burish `matches` ga tushadi.
HeadPose livenessPoseFromMlKit({
  required double yaw,
  required double pitch,
  required bool frontCamera,
  bool? mirrorFrontYaw,
}) {
  final mirror = mirrorFrontYaw ?? frontCamera;
  final y = frontCamera && mirror ? -yaw : yaw;
  return HeadPose(y, pitch);
}

/// Old kamera — preview oynasi bilan strelka mosligi uchun yaw mirror.
Future<bool> shouldMirrorFrontYaw(CameraDescription cam) async {
  return cam.lensDirection == CameraLensDirection.front;
}
