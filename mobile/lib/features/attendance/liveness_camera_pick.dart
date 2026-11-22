import 'package:camera/camera.dart';

/// Sof: old kamera afzal; yo‘q bo‘lsa birinchisi (emulyator orqa-only).
CameraDescription? selectLivenessCamera(List<CameraDescription> cams) {
  if (cams.isEmpty) return null;
  for (final c in cams) {
    if (c.lensDirection == CameraLensDirection.front) return c;
  }
  return cams.first;
}
