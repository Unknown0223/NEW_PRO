import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/app_lock.dart';
import '../../../core/auth/session.dart';
import '../../../core/camera/photo_service.dart' show encodeClientPhotoBase64, photoServiceProvider;
import '../../../core/config/tenant_refs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/sync/photo_report_queue.dart';
import '../../../core/ui/agent_ui.dart';

/// Standart foto kategoriyalari (spravochnik bo‘sh bo‘lsa).
const defaultPhotoReportCategories = [
  'Ёпик докон расми',
  'Буш полка',
  'Лалаку полка (Факат лалаку полкаси расми)',
  'Локасия нотогри',
  'Накладной расми',
  'Ракобатчиларни полкаси',
  'Сотилаётган товарлар расми (Лалаку)',
  'Товар етарлик даражада бор',
];

/// Majburiy foto ogohlantirishi — kontent ichida (Фото отчёт bo‘limi).
class MandatoryPhotoInlinePrompt extends StatelessWidget {
  final VoidCallback onAdd;
  const MandatoryPhotoInlinePrompt({super.key, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 4,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFF97316),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Необходимо добавить фотоотчет',
                  style: TextStyle(
                    color: Color(0xFF9A3412),
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.photo_camera_outlined, size: 18),
                  label: const Text('Добавить фотоотчет'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF9A3412),
                    side: const BorderSide(color: Color(0xFFF97316)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Eski sticky banner — faqat buyurtma setup varag‘i ichida qoldiriladi.
class MandatoryPhotoBanner extends StatelessWidget {
  final VoidCallback onAdd;
  const MandatoryPhotoBanner({super.key, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0F172A),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
          child: Row(
            children: [
              Container(width: 4, height: 36, color: const Color(0xFFF97316)),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Необходимо добавить фотоотчет',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
              TextButton(
                onPressed: onAdd,
                child: const Text('Добавить', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _isPhotoToday(ClientPhotoReport p) {
  final dt = DateTime.tryParse(p.createdAt);
  if (dt == null) return false;
  final local = dt.toLocal();
  final now = DateTime.now();
  return local.year == now.year && local.month == now.month && local.day == now.day;
}

bool hasPhotoReportToday(List<ClientPhotoReport> photos) {
  return photos.any(_isPhotoToday);
}

List<ClientPhotoReport> photoReportsForToday(List<ClientPhotoReport> photos) {
  return photos.where(_isPhotoToday).toList();
}

/// Buyurtma uchun — bugun olingan va hali boshqa zakazga bog‘lanmagan foto.
bool hasUnlinkedPhotoReportToday(List<ClientPhotoReport> photos) {
  return photos.any((p) => p.orderId == null && _isPhotoToday(p));
}

ClientPhotoReport? latestPhotoReportToday(List<ClientPhotoReport> photos) {
  ClientPhotoReport? best;
  DateTime? bestDt;
  for (final p in photos) {
    if (!_isPhotoToday(p)) continue;
    final dt = DateTime.tryParse(p.createdAt);
    if (dt == null) continue;
    final local = dt.toLocal();
    if (bestDt == null || local.isAfter(bestDt)) {
      best = p;
      bestDt = local;
    }
  }
  return best;
}

ClientPhotoReport? latestUnlinkedPhotoReportToday(List<ClientPhotoReport> photos) {
  ClientPhotoReport? best;
  DateTime? bestDt;
  for (final p in photos) {
    if (p.orderId != null || !_isPhotoToday(p)) continue;
    final dt = DateTime.tryParse(p.createdAt);
    if (dt == null) continue;
    final local = dt.toLocal();
    if (bestDt == null || local.isAfter(bestDt)) {
      best = p;
      bestDt = local;
    }
  }
  return best;
}

Future<String?> pickPhotoReportCategory(BuildContext context, WidgetRef ref) async {
  final fromRefs = ref.read(photoCategoryEntriesProvider).map((e) => e.name).where((s) => s.isNotEmpty).toList();
  final options = fromRefs.isNotEmpty ? fromRefs : defaultPhotoReportCategories;
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final maxH = MediaQuery.sizeOf(ctx).height * 0.75;
      final listH = (options.length * 56.0 + 8).clamp(120.0, maxH - 88);
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
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                    ],
                  ),
                ),
                SizedBox(
                  height: listH,
                  child: ListView.builder(
                    itemCount: options.length,
                    itemBuilder: (_, i) {
                      final label = options[i];
                      return ListTile(
                        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
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

Future<ClientPhotoReport?> captureAndUploadPhotoReport({
  required BuildContext context,
  required WidgetRef ref,
  required String slug,
  required int clientId,
  int? orderId,
  String? category,
}) async {
  final caption = category ?? await pickPhotoReportCategory(context, ref);
  if (caption == null || !context.mounted) return null;

  final cam = await Permission.camera.request();
  if (!cam.isGranted) {
    if (context.mounted) {
      showAgentToast(context, 'Kamera ruxsati kerak');
    }
    return null;
  }

  final photo = await withAppLockSuppressed(
    ref,
    () => ref.read(photoServiceProvider).takeClientPhoto(),
  );
  if (photo == null || !context.mounted) return null;

  var loadingShown = false;
  void hideLoading() {
    if (!loadingShown || !context.mounted) return;
    loadingShown = false;
    Navigator.of(context, rootNavigator: true).pop();
  }

  if (context.mounted) {
    loadingShown = true;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
  }

  String? b64;
  try {
    b64 = await encodeClientPhotoBase64(
      photo.filePath,
      config: ref.read(sessionProvider).mobileConfig?.photo,
    );
  } finally {
    hideLoading();
  }

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
          orderId: orderId,
        );
  } on NetworkException {
    final queued = await PhotoReportQueue.enqueue(
      clientId: clientId,
      imagePath: photo.filePath,
      caption: caption,
      orderId: orderId,
    );
    if (context.mounted) {
      showAgentToast(
        context,
        queued
            ? 'Foto oflayn saqlandi — internet paydo bo‘lganda yuboriladi'
            : 'Internet yo‘q — fotoni saqlab bo‘lmadi',
        accentColor: queued ? AppColors.success : AppColors.error,
      );
    }
    return null;
  } catch (e) {
    if (context.mounted) {
      showAgentToast(context, 'Foto yuklanmadi: $e');
    }
    return null;
  }
}

Future<ClientPhotoReport?> replacePhotoReport({
  required BuildContext context,
  required WidgetRef ref,
  required String slug,
  required int clientId,
  required ClientPhotoReport existing,
}) async {
  final caption = (existing.caption ?? '').trim();
  if (caption.isEmpty) {
    if (context.mounted) {
      showAgentToast(context, 'Kategoriya topilmadi');
    }
    return null;
  }

  final cam = await Permission.camera.request();
  if (!cam.isGranted) {
    if (context.mounted) {
      showAgentToast(context, 'Kamera ruxsati kerak');
    }
    return null;
  }

  final photo = await withAppLockSuppressed(
    ref,
    () => ref.read(photoServiceProvider).takeClientPhoto(),
  );
  if (photo == null || !context.mounted) return null;

  var loadingShown = false;
  void hideLoading() {
    if (!loadingShown || !context.mounted) return;
    loadingShown = false;
    Navigator.of(context, rootNavigator: true).pop();
  }

  if (context.mounted) {
    loadingShown = true;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
  }

  String? b64;
  try {
    b64 = await encodeClientPhotoBase64(
      photo.filePath,
      config: ref.read(sessionProvider).mobileConfig?.photo,
    );
  } finally {
    hideLoading();
  }

  if (b64 == null) {
    if (context.mounted) {
      showAgentToast(context, 'Не удалось сжать фото — сделайте снимок ещё раз');
    }
    return null;
  }

  try {
    await ref.read(mobileApiProvider).deleteClientPhotoReport(slug, clientId, existing.id);
    return await ref.read(mobileApiProvider).postClientPhotoReport(
          slug,
          clientId,
          imageBase64: b64,
          caption: caption,
          orderId: existing.orderId,
        );
  } catch (e) {
    if (context.mounted) {
      showAgentToast(context, 'Foto yangilanmadi: $e');
    }
    return null;
  }
}
