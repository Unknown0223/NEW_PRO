import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Orqa → old kamera ketma-ket surat (HR Hub DualCapture oqimi, image_picker bilan).
class DualCaptureResult {
  const DualCaptureResult({required this.backBase64, required this.frontBase64});
  final String backBase64;
  final String frontBase64;
}

class DualCapture {
  DualCapture._();

  static Future<DualCaptureResult?> run(
    BuildContext context, {
    String? livenessSelfieBase64,
  }) async {
    final picker = ImagePicker();

    final okBack = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('1/2 · Задняя камера'),
        content: const Text(
          'Сфотографируйте рабочее место / объект (задняя камера).',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Снять')),
        ],
      ),
    );
    if (okBack != true || !context.mounted) return null;

    final back = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      maxWidth: 1280,
      imageQuality: 78,
    );
    if (back == null || !context.mounted) return null;
    final backB64 = base64Encode(await back.readAsBytes());

    String frontB64;
    if (livenessSelfieBase64 != null && livenessSelfieBase64.isNotEmpty) {
      frontB64 = livenessSelfieBase64;
    } else {
      if (!context.mounted) return null;
      final okFront = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('2/2 · Фронтальная камера'),
          content: const Text('Сделайте селфи (в кадре должно быть одно лицо).'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Снять')),
          ],
        ),
      );
      if (okFront != true || !context.mounted) return null;
      final front = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 960,
        imageQuality: 78,
      );
      if (front == null) return null;
      frontB64 = base64Encode(await front.readAsBytes());
    }

    return DualCaptureResult(backBase64: backB64, frontBase64: frontB64);
  }
}
