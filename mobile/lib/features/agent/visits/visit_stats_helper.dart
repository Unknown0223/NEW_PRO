import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/error_reporter.dart';
import '../home/agent_dashboard_provider.dart';
import '../home/home_visit_metrics_provider.dart';
import '../kpi/kpi_provider.dart';
import 'agent_visits_page.dart';

typedef VisitStatsInvalidator = void Function(ProviderOrFamily provider);

/// Buyurtma yoki vizit tugagach bosh sahifa KPI provayderlarini yangilash.
void refreshVisitStatsProviders(VisitStatsInvalidator invalidate) {
  invalidate(visitsTodayProvider);
  invalidate(visitedTodayClientIdsProvider);
  invalidate(homeVisitMetricsProvider);
  invalidate(agentDashboardProvider);
  invalidate(agentKpiProvider);
}

/// Bugungi mijoz tashrifi — buyurtma / sinxron foto / «Начать визит»siz ham.
///
/// Lokal `agent_visits` yozadi; online bo‘lsa serverga ham check-in yuboradi.
Future<void> ensureVisitCompletedForClientToday(
  int clientId, {
  String? clientName,
  FieldApi? fieldApi,
  String? tenantSlug,
}) async {
  final db = AppDatabase();
  final visits = await db.getVisitsForDay();
  VisitRecord? match;
  for (final row in visits) {
    final v = visitFromRow(row);
    if (v.clientId != clientId) continue;
    // Faol vizit — agent o‘zi yakunlaydi; serverda allaqachon yozilgan.
    if (v.status == 'in_progress') return;
    match ??= v;
  }

  double? lat;
  double? lng;

  if (match != null) {
    lat = match.latitude;
    lng = match.longitude;
  } else {
    final client = await db.getClientById(clientId);
    final name = clientName?.trim().isNotEmpty == true
        ? clientName!.trim()
        : (client?['name']?.toString() ?? 'Клиент');
    lat = (client?['latitude'] as num?)?.toDouble();
    lng = (client?['longitude'] as num?)?.toDouble();
    final now = DateTime.now().toIso8601String();
    await db.insertVisit(
      visitToRow(
        VisitRecord(
          clientId: clientId,
          clientName: name,
          startTime: now,
          endTime: now,
          status: 'completed',
          latitude: lat,
          longitude: lng,
        ),
      ),
    );
  }

  final slug = tenantSlug?.trim() ?? '';
  if (fieldApi != null && slug.isNotEmpty) {
    try {
      await fieldApi.createVisit(
        slug,
        clientId: clientId,
        latitude: lat,
        longitude: lng,
        notes: 'activity',
      );
    } on ApiException catch (e) {
      ErrorReporter.instance?.reportCaught(
        e,
        module: ErrorModules.visits,
        code: 'VisitEnsureServerFailed',
        message: 'Визит: активность на сервере не записана',
        path: '/mobile/field/visits',
        payload: {'client_id': clientId},
      );
    } catch (e, st) {
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.visits,
        code: 'VisitEnsureServerFailed',
        message: 'Визит: активность на сервере не записана',
        path: '/mobile/field/visits',
        payload: {'client_id': clientId},
      );
    }
  }
}

/// WidgetRef dan FieldApi/slug bilan qulay chaqirish.
Future<void> ensureVisitCompletedForClientTodayWithRef(
  WidgetRef ref,
  int clientId, {
  String? clientName,
}) {
  final slug = ref.read(sessionProvider).tenantSlug ?? '';
  return ensureVisitCompletedForClientToday(
    clientId,
    clientName: clientName,
    fieldApi: ref.read(fieldApiProvider),
    tenantSlug: slug,
  );
}
