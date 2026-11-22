import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/app_lock.dart';
import 'attendance_models.dart';
import 'video_punch_screen.dart';

/// 3 xonali kod + old/orqa video (HR Hub uslubidagi in-app kamera).
class VideoPunchCapture {
  const VideoPunchCapture({
    required this.frontBase64,
    this.backBase64,
    required this.durationSec,
    required this.captureMode,
  });

  final String frontBase64;
  final String? backBase64;
  final int durationSec;
  final String captureMode;
}

class VideoPunchFlow {
  VideoPunchFlow._();

  static Future<VideoPunchCapture?> run(
    BuildContext context,
    WidgetRef ref, {
    required MobileAttendanceState st,
  }) {
    return withAppLockSuppressed(ref, () {
      return VideoPunchScreen.open(
        context,
        durationSec: st.videoMaxSec.clamp(5, 10),
        captureMode: st.captureMode,
        dayCode: st.dayCode,
        requireBack: st.captureMode == 'sequential' || st.captureMode == 'simultaneous',
        title: 'Видео-отметка',
      );
    });
  }

  /// Gate: oval kamera + kod + front/back yozish.
  static Future<VideoPunchCapture?> captureInline(
    BuildContext context,
    WidgetRef ref, {
    required int maxSec,
    required String captureMode,
    int? dayCode,
    bool requireBack = true,
  }) {
    return withAppLockSuppressed(ref, () {
      return VideoPunchScreen.open(
        context,
        durationSec: maxSec.clamp(5, 10),
        captureMode: captureMode,
        dayCode: dayCode,
        requireBack: requireBack,
        title: 'Видео + код',
      );
    });
  }
}
