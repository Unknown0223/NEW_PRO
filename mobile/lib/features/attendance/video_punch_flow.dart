import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'attendance_models.dart';

/// 3 xonali kod + old/orqa video (image_picker; simultaneous kamera keyingi APK).
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
    BuildContext context, {
    required MobileAttendanceState st,
  }) async {
    final code = st.dayCode;
    final maxSec = st.videoMaxSec.clamp(5, 10);
    final picker = ImagePicker();

    final start = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Видео-отметка'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Произнесите код на фронтальном видео:'),
            const SizedBox(height: 8),
            Text(
              '${code ?? "---"}',
              style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: 8),
            ),
            const SizedBox(height: 8),
            Text('Длительность ${st.videoMinSec}–$maxSec сек · Режим: ${st.captureMode}'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Фронт видео')),
        ],
      ),
    );
    if (start != true || !context.mounted) return null;

    final front = await picker.pickVideo(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxDuration: Duration(seconds: maxSec),
    );
    if (front == null || !context.mounted) return null;
    final frontB64 = base64Encode(await front.readAsBytes());

    String? backB64;
    final needBack = st.captureMode == 'sequential' || st.captureMode == 'simultaneous';
    if (needBack) {
      if (!context.mounted) return null;
      final backOk = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Задняя камера'),
          content: const Text('Сейчас запишите короткое видео рабочего места (задняя камера).'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Пропустить')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Записать')),
          ],
        ),
      );
      if (backOk == true && context.mounted) {
        final back = await picker.pickVideo(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.rear,
          maxDuration: Duration(seconds: maxSec),
        );
        if (back != null) {
          backB64 = base64Encode(await back.readAsBytes());
        }
      }
    }

    return VideoPunchCapture(
      frontBase64: frontB64,
      backBase64: backB64,
      durationSec: maxSec,
      captureMode: backB64 != null ? st.captureMode : 'front_only',
    );
  }
}
