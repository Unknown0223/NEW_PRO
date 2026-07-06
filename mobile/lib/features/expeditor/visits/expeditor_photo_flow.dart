import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/app_lock.dart';
import '../../../core/auth/session.dart';
import '../../../core/camera/photo_service.dart'
    show encodeClientPhotoBase64, photoServiceProvider;
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';

/// Ekspeditor (dastavchik) uchun ALOHIDA foto kategoriyalari.
/// Agent spravochnigidan mustaqil — yetkazib berishga oid bo'limlar.
const expeditorPhotoCategories = <String>[
  'Фото доставленного товара',
  'Фото витрины / полки',
  'Накладная / документ',
  'Возврат товара',
  'Проблема при доставке',
  'Фасад / вход точки',
  'Другое',
];

/// Ekspeditor uchun kategoriya tanlash oynasi (dastavchik ranglarida).
Future<String?> pickExpeditorPhotoCategory(BuildContext context) async {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final maxH = MediaQuery.sizeOf(ctx).height * 0.75;
      final listH =
          (expeditorPhotoCategories.length * 56.0 + 8).clamp(120.0, maxH - 88);
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AgentSheetHandle(),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 12, 8),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Выберите категорию',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800,),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  height: listH,
                  child: ListView.builder(
                    itemCount: expeditorPhotoCategories.length,
                    itemBuilder: (_, i) {
                      final label = expeditorPhotoCategories[i];
                      return ListTile(
                        leading: const Icon(Icons.photo_camera_outlined,
                            color: AppColors.expeditorAccent,),
                        title: Text(label,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600),),
                        onTap: () => Navigator.pop(ctx, label),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

/// Ekspeditor — kamera bilan foto olish va yuklash (alohida oqim).
Future<ClientPhotoReport?> captureAndUploadExpeditorPhoto({
  required BuildContext context,
  required WidgetRef ref,
  required String slug,
  required int clientId,
  String? category,
}) async {
  final caption = category ?? await pickExpeditorPhotoCategory(context);
  if (caption == null || !context.mounted) return null;

  final cam = await Permission.camera.request();
  if (!cam.isGranted) {
    if (context.mounted) showAgentToast(context, 'Нужно разрешение на камеру');
    return null;
  }

  final photo = await withAppLockSuppressed(
    ref,
    () => ref.read(photoServiceProvider).takeClientPhoto(),
  );
  if (photo == null || !context.mounted) return null;

  final b64 = await encodeClientPhotoBase64(
    photo.filePath,
    config: ref.read(sessionProvider).mobileConfig?.photo,
  );
  if (b64 == null) {
    if (context.mounted) {
      showAgentToast(context, 'Не удалось сжать фото — сделайте снимок ещё раз');
    }
    return null;
  }

  try {
    return await ref.read(mobileApiProvider).postClientPhotoReport(
          slug,
          clientId,
          imageBase64: b64,
          caption: caption,
        );
  } catch (e) {
    if (context.mounted) showAgentToast(context, 'Фото не загружено: $e');
    return null;
  }
}

/// Ekspeditor — fotoni almashtirish (eski kategoriya saqlanadi).
Future<ClientPhotoReport?> replaceExpeditorPhoto({
  required BuildContext context,
  required WidgetRef ref,
  required String slug,
  required int clientId,
  required ClientPhotoReport existing,
}) async {
  final caption = (existing.caption ?? '').trim().isNotEmpty
      ? existing.caption!.trim()
      : (await pickExpeditorPhotoCategory(context));
  if (caption == null || !context.mounted) return null;

  final cam = await Permission.camera.request();
  if (!cam.isGranted) {
    if (context.mounted) showAgentToast(context, 'Нужно разрешение на камеру');
    return null;
  }

  final photo = await withAppLockSuppressed(
    ref,
    () => ref.read(photoServiceProvider).takeClientPhoto(),
  );
  if (photo == null || !context.mounted) return null;

  final b64 = await encodeClientPhotoBase64(
    photo.filePath,
    config: ref.read(sessionProvider).mobileConfig?.photo,
  );
  if (b64 == null) {
    if (context.mounted) {
      showAgentToast(context, 'Не удалось сжать фото — сделайте снимок ещё раз');
    }
    return null;
  }

  try {
    await ref
        .read(mobileApiProvider)
        .deleteClientPhotoReport(slug, clientId, existing.id);
    return await ref.read(mobileApiProvider).postClientPhotoReport(
          slug,
          clientId,
          imageBase64: b64,
          caption: caption,
        );
  } catch (e) {
    if (context.mounted) showAgentToast(context, 'Фото не обновлено: $e');
    return null;
  }
}
