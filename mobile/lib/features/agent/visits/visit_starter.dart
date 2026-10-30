import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/error_reporter.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/visits/visit_geo_check.dart';
import '../config/agent_config_enforcement.dart';
import 'agent_visits_page.dart';
import 'visit_stats_helper.dart';

/// Bugungi faol (in_progress) vizit; [clientId] berilsa — faqat shu mijoz.
Future<VisitRecord?> findActiveVisit({int? clientId}) async {
  final rows = await AppDatabase().getVisitsForDay();
  for (final row in rows) {
    final v = visitFromRow(row);
    if (v.status != 'in_progress') continue;
    if (clientId == null || v.clientId == clientId) return v;
  }
  return null;
}

Future<void> _showError(BuildContext context, String title, String message) {
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Понятно'))],
    ),
  );
}

Future<T> _withProgress<T>(BuildContext context, String label, Future<T> Function() run) async {
  unawaited(
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PopScope(
        canPop: false,
        child: AlertDialog(
          content: Row(
            children: [
              const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)),
              const SizedBox(width: 16),
              Expanded(child: Text(label)),
            ],
          ),
        ),
      ),
    ),
  );
  try {
    return await run();
  } finally {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
  }
}

/// «Начать визит»: sozlama to‘siqlari, boshqa faol vizit, to‘liq GPS tekshiruvi
/// (yoqilgan, aniq, yangi fix, soxta GPS yo‘q, radius), trekni yoqish, lokal + server yozuvi.
Future<bool> startAgentVisit(BuildContext context, WidgetRef ref, Map<String, dynamic> client) async {
  final rawId = client['id'];
  if (rawId is! num) return false;
  final clientId = rawId.toInt();
  final name = client['name']?.toString() ?? 'Клиент';

  final block = await evaluateAgentOrderGuards(ref, clientId: clientId);
  if (block != null) {
    if (context.mounted) await _showError(context, 'Визит недоступен', block.message);
    return false;
  }

  final active = await findActiveVisit();
  if (active != null) {
    if (active.clientId == clientId) return true;
    if (!context.mounted) return false;
    final open = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Есть незавершённый визит'),
        content: Text('Сначала завершите визит у «${active.clientName}».'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Открыть визит')),
        ],
      ),
    );
    if (open == true && context.mounted && active.clientId != null) {
      unawaited(context.push('/visits/active/${active.clientId}'));
    }
    return false;
  }

  if (!context.mounted) return false;
  final cfg = ref.read(sessionProvider).mobileConfig;
  final clientLat = (client['latitude'] as num?)?.toDouble();
  final clientLng = (client['longitude'] as num?)?.toDouble();
  final geo = await _withProgress(
    context,
    'Проверяем геолокацию…',
    () => checkVisitGeo(config: cfg, clientLat: clientLat, clientLng: clientLng),
  );
  if (!geo.ok) {
    if (context.mounted) await _showError(context, 'Визит не начат', geo.error ?? 'Нет координат');
    return false;
  }
  final pos = geo.position!;

  final tracker = ref.read(gpsTrackerProvider.notifier);
  if (!tracker.isTracking) unawaited(tracker.startTracking());

  final startedAt = DateTime.now();
  final localId = await AppDatabase().insertVisit(
    visitToRow(
      VisitRecord(
        clientId: clientId,
        clientName: name,
        startTime: startedAt.toIso8601String(),
        status: 'in_progress',
        latitude: pos.latitude,
        longitude: pos.longitude,
      ),
    ),
  );

  int? serverVisitId;
  final slug = ref.read(sessionProvider).tenantSlug ?? '';
  if (slug.isNotEmpty) {
    try {
      final row = await ref.read(fieldApiProvider).createVisit(
            slug,
            clientId: clientId,
            latitude: pos.latitude,
            longitude: pos.longitude,
          );
      serverVisitId = (row['id'] as num?)?.toInt();
    } catch (e, st) {
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.visits,
        code: 'VisitCreateFailed',
        message: 'Визит: создание на сервере не удалось (сохранён локально)',
        path: '/mobile/field/visits',
        payload: {'client_id': clientId},
        severity: 'warning',
      );
    }
  }

  await AppDatabase().setVisitGeo(localId, {
    'client_id': clientId,
    'started_at': startedAt.toUtc().toIso8601String(),
    'latitude': pos.latitude,
    'longitude': pos.longitude,
    'accuracy_m': pos.accuracy,
    'is_mocked': pos.isMocked,
    if (geo.distanceM != null) 'distance_m': geo.distanceM!.roundToDouble(),
    'radius_m': geo.radiusM,
    if (serverVisitId != null) 'server_visit_id': serverVisitId,
    'tracking': ref.read(gpsTrackerProvider.notifier).isTracking,
    'offline': serverVisitId == null,
  });

  refreshVisitStatsProviders(ref.invalidate);
  return true;
}

/// Zakaz faqat faol vizit ichida: vizit bo‘lmasa — «Начать визит» taklifi va to‘liq tekshiruv.
Future<bool> ensureActiveVisitForOrder(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> client,
) async {
  final rawId = client['id'];
  if (rawId is! num) return false;
  if (await findActiveVisit(clientId: rawId.toInt()) != null) return true;
  if (!context.mounted) return false;
  final name = client['name']?.toString() ?? 'клиента';
  final start = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Нужен визит'),
      content: Text('Заказ оформляется только в рамках визита.\nНачать визит у «$name»?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Начать визит')),
      ],
    ),
  );
  if (start != true || !context.mounted) return false;
  return startAgentVisit(context, ref, client);
}

/// Zakaz tasdiqlanayotganda: GPS qayta tekshiriladi va koordinata vizit yozuviga qo‘shiladi.
Future<String?> recordOrderPositionForVisit(WidgetRef ref, Map<String, dynamic> client) async {
  final rawId = client['id'];
  if (rawId is! num) return 'Клиент не выбран';
  final clientId = rawId.toInt();
  final active = await findActiveVisit(clientId: clientId);
  if (active == null || active.id == null) return 'Заказ оформляется только в рамках визита';
  final geo = await checkVisitGeo(
    config: ref.read(sessionProvider).mobileConfig,
    clientLat: (client['latitude'] as num?)?.toDouble(),
    clientLng: (client['longitude'] as num?)?.toDouble(),
  );
  if (!geo.ok) return geo.error;
  final stored = await AppDatabase().findVisitGeoForClient(clientId) ?? <String, dynamic>{};
  final pos = geo.position!;
  final startedAt = DateTime.tryParse(active.startTime ?? '') ?? DateTime.now();
  await AppDatabase().setVisitGeo(active.id!, {
    'client_id': clientId,
    'started_at': startedAt.toUtc().toIso8601String(),
    'latitude': pos.latitude,
    'longitude': pos.longitude,
    'accuracy_m': pos.accuracy,
    'is_mocked': pos.isMocked,
    if (geo.distanceM != null) 'distance_m': geo.distanceM!.roundToDouble(),
    'radius_m': geo.radiusM,
    'tracking': ref.read(gpsTrackerProvider.notifier).isTracking,
    'offline': true,
    ...stored,
    'order_latitude': pos.latitude,
    'order_longitude': pos.longitude,
    'order_accuracy_m': pos.accuracy,
    'order_is_mocked': pos.isMocked,
  });
  return null;
}

/// Server payload `visit`: zakaz yaratilgan vaqtgacha boshlangan oxirgi vizit.
Future<Map<String, dynamic>?> orderVisitPayload(int clientId, {DateTime? at}) =>
    AppDatabase().findVisitGeoForClient(clientId, at: at);
