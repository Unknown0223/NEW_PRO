import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/auth/app_lock.dart';
import 'attendance_models.dart';

/// Yo‘nalishlar bo‘yicha bosh burish + har qadamda selfie.
/// preferredCameraDevice yo‘q — emulyator/front kulrang previewdan qochamiz.
class LivenessCameraFlow {
  LivenessCameraFlow._();

  /// Qaytaradi: bajarilgan yo‘nalishlar + oxirgi selfie base64.
  static Future<({List<String> steps, String selfieBase64})?> run(
    BuildContext context,
    WidgetRef ref, {
    required int directions,
    List<String>? presetSequence,
    bool mandatory = false,
  }) async {
    return withAppLockSuppressed(ref, () async {
      final seq = presetSequence ?? LivenessHelper.buildSequence(directions);
      final completed = <String>[];
      final picker = ImagePicker();
      String? lastSelfie;

      for (final dir in seq) {
        if (!context.mounted) return null;
        final label = LivenessHelper.labelsRu[dir] ?? dir;

        if (!mandatory) {
          final go = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              title: Text('Живость ${completed.length + 1}/${seq.length}'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  const Text(
                    'Поверните голову, затем сделайте селфи. В кадре — только одно лицо.',
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Камера')),
              ],
            ),
          );
          if (go != true || !context.mounted) return null;
        } else {
          final go = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              title: Text('Приход · шаг ${completed.length + 1}/${seq.length}'),
              content: Text(
                '$label\n\nОткроется камера — сделайте селфи.',
                style: const TextStyle(fontSize: 16),
              ),
              actions: [
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Открыть камеру'),
                ),
              ],
            ),
          );
          if (go != true || !context.mounted) return null;
        }

        final shot = await picker.pickImage(
          source: ImageSource.camera,
          maxWidth: 720,
          imageQuality: 72,
        );
        if (shot == null) {
          if (mandatory) continue;
          return null;
        }
        lastSelfie = base64Encode(await shot.readAsBytes());
        completed.add(dir);
      }

      if (lastSelfie == null || completed.length < directions) return null;
      return (steps: completed, selfieBase64: lastSelfie);
    });
  }
}
