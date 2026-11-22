import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/app_lock.dart';
import '../../../core/auth/session.dart';
import '../../../core/camera/photo_service.dart'
    show
        PhotoCaptureException,
        PhotoResult,
        encodeClientPhotoBase64,
        photoServiceProvider;
import '../../../core/config/tenant_refs_provider.dart';
import '../../../core/database/app_database.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/errors/error_reporter.dart';
import '../../../core/errors/user_facing_error.dart';
import '../../../core/sync/photo_report_queue.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';

/// Standart foto sabablari (veb spravochnik bo‘sh bo‘lsa).
/// Asosiy ro‘yxat: Sozlamalar → Причины и категории → Причины фотоотчёта.
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
  final wr = toWorkRegionFromIso(p.createdAt);
  if (wr == null) return false;
  final now = workRegionNow();
  return wr.year == now.year && wr.month == now.month && wr.day == now.day;
}

bool hasPhotoReportToday(List<ClientPhotoReport> photos) {
  return photos.any((p) => isPendingLocalPhotoReport(p.id) || _isPhotoToday(p));
}

List<ClientPhotoReport> photoReportsForToday(List<ClientPhotoReport> photos) {
  // Oflayn navbatdagi (manfiy id) fotolar bugungi filtrga tushmasa ham ko‘rinsin.
  return photos.where((p) => isPendingLocalPhotoReport(p.id) || _isPhotoToday(p)).toList();
}

/// Oflayn navbat qatori — UI da manfiy id bilan (server id bilan aralashmasin).
bool isPendingLocalPhotoReport(int id) => id < 0;

int pendingPhotoQueueId(int negativeId) => -negativeId;

ClientPhotoReport? clientPhotoReportFromPendingRow(Map<String, dynamic> row) {
  final id = (row['id'] as num?)?.toInt();
  final path = row['image_path']?.toString().trim() ?? '';
  if (id == null || id <= 0 || path.isEmpty) return null;
  final orderRaw = row['order_id'];
  final orderId = orderRaw is num ? orderRaw.toInt() : int.tryParse('$orderRaw');
  return ClientPhotoReport(
    id: -id,
    imageUrl: path,
    caption: row['caption']?.toString(),
    orderId: orderId != null && orderId > 0 ? orderId : null,
    createdAt: row['created_at']?.toString().trim().isNotEmpty == true
        ? row['created_at'].toString()
        : DateTime.now().toIso8601String(),
  );
}

List<ClientPhotoReport> pendingPhotoReportsForClient(
  List<Map<String, dynamic>> pendingRows, {
  required int clientId,
}) {
  final out = <ClientPhotoReport>[];
  for (final row in pendingRows) {
    final cid = (row['client_id'] as num?)?.toInt();
    if (cid != clientId) continue;
    final mapped = clientPhotoReportFromPendingRow(row);
    if (mapped != null) out.add(mapped);
  }
  return out;
}

List<ClientPhotoReport> mergeServerAndPendingPhotoReports({
  required List<ClientPhotoReport> server,
  required List<ClientPhotoReport> pending,
}) {
  final byId = <int, ClientPhotoReport>{};
  for (final p in server) {
    byId[p.id] = p;
  }
  for (final p in pending) {
    byId[p.id] = p;
  }
  final merged = byId.values.toList()
    ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return merged;
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
                          S.selectPhotoReason,
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
  if (await PhotoReportQueue.isCaptureBlockedForClient(
        clientId,
        sync: ref.read(sessionProvider).mobileConfig?.sync,
      )) {
    if (context.mounted) {
      showAgentToast(
        context,
        'Окно съёмки закрыто — новые фото нельзя. Уже снятые синхронизируйте отдельно в любое время.',
        accentColor: AppColors.warning,
      );
    }
    return null;
  }

  final caption = category ?? await pickPhotoReportCategory(context, ref);
  if (caption == null || !context.mounted) return null;

  final cam = await Permission.camera.request();
  if (!cam.isGranted) {
    if (context.mounted) {
      showAgentToast(context, 'Kamera ruxsati kerak');
    }
    return null;
  }

  PhotoResult? photo;
  try {
    photo = await withAppLockSuppressed(
      ref,
      () => ref.read(photoServiceProvider).takeClientPhoto(),
    );
  } on PhotoCaptureException catch (e) {
    if (context.mounted) {
      showAgentToast(context, e.message, accentColor: AppColors.error);
    }
    return null;
  }
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
      sync: ref.read(sessionProvider).mobileConfig?.sync,
    );
    final ok = queued != null;
    ErrorReporter.instance?.reportModuleIssue(
      module: ErrorModules.photos,
      code: ok ? 'PhotoQueuedOffline' : 'PhotoQueueFailed',
      message: ok
          ? 'Фотоотчёт: сеть недоступна — в офлайн очередь'
          : 'Фотоотчёт: не удалось сохранить в офлайн очередь',
      path: '/mobile/clients/photo-reports',
      payload: {'client_id': clientId, 'order_id': orderId, 'queued': ok},
    );
    if (context.mounted) {
      showAgentToast(
        context,
        ok
            ? 'Foto oflayn saqlandi — «Синхронизация фото» orqali istalgan vaqtda yuboriladi'
            : 'Окно съёмки закрыто или фото сақланмади',
        accentColor: ok ? AppColors.success : AppColors.error,
      );
    }
    return queued;
  } catch (e) {
    // Server xatosi — navbatga qo‘yib online da qayta urinish.
    final queued = await PhotoReportQueue.enqueue(
      clientId: clientId,
      imagePath: photo.filePath,
      caption: caption,
      orderId: orderId,
      sync: ref.read(sessionProvider).mobileConfig?.sync,
    );
    final ok = queued != null;
    ErrorReporter.instance?.reportCaught(
      e,
      module: ErrorModules.photos,
      code: ok ? 'PhotoUploadFailedQueued' : 'PhotoUploadFailed',
      message: ok
          ? 'Фотоотчёт: загрузка не удалась — в очередь'
          : 'Фотоотчёт: загрузка не удалась',
      path: '/mobile/clients/photo-reports',
      payload: {'client_id': clientId, 'order_id': orderId, 'queued': ok},
    );
    if (context.mounted) {
      showAgentToast(
        context,
        ok
            ? 'Foto saqlandi — «Синхронизация фото» orqali istalgan vaqtda yuboriladi'
            : UserFacingError.toast(e, action: 'Не удалось загрузить фото'),
        accentColor: ok ? AppColors.warning : AppColors.error,
      );
    }
    return queued;
  }
}

Future<ClientPhotoReport?> replacePhotoReport({
  required BuildContext context,
  required WidgetRef ref,
  required String slug,
  required int clientId,
  required ClientPhotoReport existing,
}) async {
  if (await PhotoReportQueue.isCaptureBlockedForClient(
        clientId,
        sync: ref.read(sessionProvider).mobileConfig?.sync,
      )) {
    if (context.mounted) {
      showAgentToast(
        context,
        'Окно съёмки закрыто — новые фото нельзя. Уже снятые синхронизируйте отдельно в любое время.',
        accentColor: AppColors.warning,
      );
    }
    return null;
  }

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

  PhotoResult? photo;
  try {
    photo = await withAppLockSuppressed(
      ref,
      () => ref.read(photoServiceProvider).takeClientPhoto(),
    );
  } on PhotoCaptureException catch (e) {
    if (context.mounted) {
      showAgentToast(context, e.message, accentColor: AppColors.error);
    }
    return null;
  }
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
    final posted = await ref.read(mobileApiProvider).postClientPhotoReport(
          slug,
          clientId,
          imageBase64: b64,
          caption: caption,
          orderId: existing.orderId,
        );
    // Yangi yozuv muvaffaqiyatli — eski server/pending ni o‘chiramiz.
    try {
      if (isPendingLocalPhotoReport(existing.id)) {
        await AppDatabase().deletePendingPhotoReport(pendingPhotoQueueId(existing.id));
      } else {
        await ref.read(mobileApiProvider).deleteClientPhotoReport(slug, clientId, existing.id);
      }
    } catch (_) {
      // Yangi foto allaqachon saqlangan; eski ni o‘chirish ixtiyoriy.
    }
    return posted;
  } catch (e) {
    // Server xatosi — yangi rasmni navbatga qo‘yamiz; eski pendingni faqat yangisi yozilgach o‘chiramiz.
    final queued = await PhotoReportQueue.enqueue(
      clientId: clientId,
      imagePath: photo.filePath,
      caption: caption,
      orderId: existing.orderId,
      sync: ref.read(sessionProvider).mobileConfig?.sync,
    );
    if (queued != null && isPendingLocalPhotoReport(existing.id)) {
      try {
        await AppDatabase().deletePendingPhotoReport(pendingPhotoQueueId(existing.id));
      } catch (_) {}
    }
    ErrorReporter.instance?.reportCaught(
      e,
      module: ErrorModules.photos,
      code: queued != null ? 'PhotoReplaceFailedQueued' : 'PhotoReplaceFailed',
      message: queued != null
          ? 'Фотоотчёт: обновление не удалось — в очередь'
          : 'Фотоотчёт: не удалось обновить фото',
      path: '/mobile/clients/photo-reports',
      payload: {'client_id': clientId, 'photo_id': existing.id, 'queued': queued != null},
    );
    if (context.mounted) {
      showAgentToast(
        context,
        queued != null
            ? 'Foto saqlandi — «Синхронизация фото» orqali istalgan vaqtda yuboriladi'
            : UserFacingError.toast(e, action: 'Не удалось обновить фото'),
        accentColor: queued != null ? AppColors.warning : AppColors.error,
      );
    }
    return queued;
  }
}
