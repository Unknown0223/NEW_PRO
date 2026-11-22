import 'dart:io';

import 'package:camera/camera.dart';
import 'package:device_info_plus/device_info_plus.dart';

import 'liveness_challenge.dart';

/// Sof: old kamera afzal; yo‘q bo‘lsa birinchisi (emulyator orqa-only).
CameraDescription? selectLivenessCamera(List<CameraDescription> cams) {
  if (cams.isEmpty) return null;
  for (final c in cams) {
    if (c.lensDirection == CameraLensDirection.front) return c;
  }
  return cams.first;
}

/// ML Kit Euler → HeadPose. Old kamera + emulyator ko‘pincha yaw ni oynalaydi;
/// strelka (ekran chap = chap) bilan moslash uchun belgini aylantiramiz.
HeadPose livenessPoseFromMlKit({
  required double yaw,
  required double pitch,
  required bool frontCamera,
  bool mirrorFrontYaw = false,
}) {
  final y = frontCamera && mirrorFrontYaw ? -yaw : yaw;
  return HeadPose(y, pitch);
}

/// Emulyatorda front yaw teskari; jismoniy telefonda yo‘q.
Future<bool> shouldMirrorFrontYaw(CameraDescription cam) async {
  if (cam.lensDirection != CameraLensDirection.front) return false;
  try {
    if (Platform.isAndroid) {
      return !(await DeviceInfoPlugin().androidInfo).isPhysicalDevice;
    }
    if (Platform.isIOS) {
      return !(await DeviceInfoPlugin().iosInfo).isPhysicalDevice;
    }
  } catch (_) {}
  return false;
}
