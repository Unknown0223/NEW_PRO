import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_exceptions.dart';
import '../auth/app_lock.dart';
import '../auth/session.dart';
import '../camera/photo_capture_policy.dart';
import '../navigation/root_navigator_context.dart';
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
    final role = (ref.read(sessionProvider).user?.role ?? '').toLowerCase();
    if (role == 'admin') return true;

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
    final role = (ref.read(sessionProvider).user?.role ?? '').toLowerCase();
    if (role == 'admin') return true;

    final api = ref.read(faceVerificationApiProvider);
    final status = await api.getStatus(slug);
    // Server: misc YOKI tenant requireFaceLogin (admin allaqachon o‘chirilgan).
    if (!status.enabled) return true;
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

  /// Server status: tenant Face ID yoki agent misc — admin emas.
  static Future<bool> isDailyLoginBlocking(WidgetRef ref) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return false;
    final role = (ref.read(sessionProvider).user?.role ?? '').toLowerCase();
    if (role == 'admin') return false;
    final status = await ref.read(faceVerificationApiProvider).getStatus(slug);
    return status.needsDailyLogin;
  }

  static Future<bool> _captureReference(
    BuildContext context,
    WidgetRef ref,
    String slug,
    String title,
  ) async {
    final dialogCtx = resolveRootNavigatorContext(context);
    if (dialogCtx == null) return false;

    final accepted = await showDialog<bool>(
      context: dialogCtx,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(
          'Сделайте селфи — эталон сохранится на сервере.',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Открыть камеру'),
          ),
        ],
      ),
    );
    if (accepted != true) return false;

    final path = await _pickFaceImage(ref);
    if (path == null) return false;
    final bytes = await File(path).readAsBytes();
    await ref.read(faceVerificationApiProvider).uploadReference(
          slug,
          base64Encode(bytes),
        );
    final snackCtx = resolveRootNavigatorContext(context);
    if (snackCtx != null && snackCtx.mounted) {
      ScaffoldMessenger.of(snackCtx).showSnackBar(
        const SnackBar(content: Text('Эталонное фото сохранено на сервере')),
      );
    }
    return true;
  }

  /// Tabel / enrollment — etalon selfie.
  static Future<bool> ensureReference(
    BuildContext context,
    WidgetRef ref, {
    String title = 'Загрузите эталонное фото лица',
  }) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return false;
    if (!context.mounted) return false;
    return _captureReference(context, ref, slug, title);
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
    final dialogCtx = resolveRootNavigatorContext(context);
    if (dialogCtx == null) return false;

    final accepted = await showDialog<bool>(
      context: dialogCtx,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(
          'Сделайте селфи для подтверждения личности.\n'
          'Фото сохраняется на сервере и привязано к вашему аккаунту.',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Открыть камеру'),
          ),
        ],
      ),
    );
    if (accepted != true) return false;

    try {
      final path = await _pickFaceImage(ref);
      if (path == null) return false;
      final bytes = await File(path).readAsBytes();
      await ref.read(faceVerificationApiProvider).submitVerification(
            slug,
            context: verifyContext,
            imageBase64: base64Encode(bytes),
            orderId: orderId,
            clientId: clientId,
          );
      return true;
    } on PhotoCaptureException catch (e) {
      final snackCtx = resolveRootNavigatorContext(context);
      if (snackCtx != null && snackCtx.mounted) {
        ScaffoldMessenger.of(snackCtx).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
      return false;
    } catch (e) {
      final msg = e is ApiException ? e.message : '$e';
      final snackCtx = resolveRootNavigatorContext(context);
      if (snackCtx != null && snackCtx.mounted) {
        ScaffoldMessenger.of(snackCtx).showSnackBar(
          SnackBar(
            content: Text(
              msg.contains('FaceMismatch') || msg.toLowerCase().contains('mos')
                  ? 'Лицо не совпало с эталоном на сервере'
                  : 'Ошибка проверки: $msg',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return false;
    }
  }

  /// preferredCameraDevice yo‘q — emulyator/front yo‘qligida kulrang previewdan qochamiz.
  static Future<String?> _pickFaceImage(WidgetRef ref) async {
    try {
      final picked = await withAppLockSuppressed(
        ref,
        () => ImagePicker().pickImage(
          source: ImageSource.camera,
          maxWidth: 720,
          imageQuality: 85,
        ),
      );
      return picked?.path;
    } on PlatformException catch (e) {
      throw PhotoCaptureException(
        code: e.code,
        message: photoCaptureUserMessage(e.code, fallback: e.message),
      );
    }
  }
}
