import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_exceptions.dart';
import '../auth/session.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'face_verification_api.dart';

/// Yuz tasdiqlash oqimi: server policy → selfie → verify.
class FaceVerificationFlow {
  const FaceVerificationFlow._();

  static Future<bool> ensure(
    BuildContext context,
    WidgetRef ref, {
    required String verifyContext,
    int? orderId,
    int? clientId,
    String title = 'Подтвердите личность',
  }) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return true;

    final misc = ref.read(sessionProvider).mobileConfig?.misc;
    if (misc?.faceVerificationEnabled != true) return true;

    final api = ref.read(faceVerificationApiProvider);
    final required = await api.checkRequired(
      slug,
      context: verifyContext,
      orderId: orderId,
      clientId: clientId,
    );
    if (!required) return true;
    if (!context.mounted) return false;

    final status = await api.getStatus(slug);
    if (!status.hasReference) {
      final uploaded = await _captureReference(context, ref, slug, title);
      if (!uploaded) return false;
    }

    return _captureAndVerify(
      context,
      ref,
      slug: slug,
      verifyContext: verifyContext,
      orderId: orderId,
      clientId: clientId,
      title: title,
    );
  }

  static Future<bool> ensureDailyLogin(BuildContext context, WidgetRef ref) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return true;
    final misc = ref.read(sessionProvider).mobileConfig?.misc;
    if (misc?.faceVerificationEnabled != true) return true;

    final api = ref.read(faceVerificationApiProvider);
    final status = await api.getStatus(slug);
    if (!status.needsDailyLogin) return true;
    if (!context.mounted) return false;

    if (!status.hasReference) {
      final ok = await _captureReference(
        context,
        ref,
        slug,
        'Загрузите эталонное фото лица',
      );
      if (!ok) return false;
    }

    return _captureAndVerify(
      context,
      ref,
      slug: slug,
      verifyContext: 'daily_login',
      title: 'Ежедневная проверка лица',
    );
  }

  /// Face yoqilgan va bugun hali tasdiqlanmagan — UI bloklash uchun.
  static Future<bool> isDailyLoginBlocking(WidgetRef ref) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return false;
    final misc = ref.read(sessionProvider).mobileConfig?.misc;
    if (misc?.faceVerificationEnabled != true) return false;
    if (misc?.faceVerificationDailyLogin == false) return false;
    final status = await ref.read(faceVerificationApiProvider).getStatus(slug);
    return status.needsDailyLogin;
  }

  static Future<bool> _captureReference(
    BuildContext context,
    WidgetRef ref,
    String slug,
    String title,
  ) async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxWidth: 720,
      imageQuality: 85,
    );
    if (picked == null) return false;
    final bytes = await picked.readAsBytes();
    await ref.read(faceVerificationApiProvider).uploadReference(
          slug,
          base64Encode(bytes),
        );
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Эталонное фото сохранено на сервере')),
      );
    }
    return true;
  }

  static Future<bool> _captureAndVerify(
    BuildContext context,
    WidgetRef ref, {
    required String slug,
    required String verifyContext,
    int? orderId,
    int? clientId,
    required String title,
  }) async {
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(
          'Сделайте селфи для подтверждения личности.\n'
          'Фото сохраняется на сервере и привязано к вашему аккаунту.',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Сделать фото'),
          ),
        ],
      ),
    );
    if (accepted != true) return false;

    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxWidth: 720,
      imageQuality: 85,
    );
    if (picked == null) return false;

    try {
      final bytes = await picked.readAsBytes();
      await ref.read(faceVerificationApiProvider).submitVerification(
            slug,
            context: verifyContext,
            imageBase64: base64Encode(bytes),
            orderId: orderId,
            clientId: clientId,
          );
      return true;
    } catch (e) {
      final msg = e is ApiException ? e.message : '$e';
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg.contains('FaceMismatch') || msg.toLowerCase().contains('mos')
                ? 'Лицо не совпало с эталоном на сервере'
                : 'Ошибка проверки: $msg'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return false;
    }
  }
}
