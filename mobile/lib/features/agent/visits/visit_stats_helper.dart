import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/database/app_database.dart';
import '../home/home_visit_metrics_provider.dart';
import 'agent_visits_page.dart';

typedef VisitStatsInvalidator = void Function(ProviderOrFamily provider);

/// Buyurtma yoki vizit tugagach bosh sahifa KPI provayderlarini yangilash.
void refreshVisitStatsProviders(VisitStatsInvalidator invalidate) {
  invalidate(visitsTodayProvider);
  invalidate(visitedTodayClientIdsProvider);
  invalidate(homeVisitMetricsProvider);
}

/// Bugungi mijoz tashrifi — buyurtma yuborilganda yakunlangan deb qayd etiladi.
Future<void> ensureVisitCompletedForClientToday(
  int clientId, {
  String? clientName,
}) async {
  final db = AppDatabase();
  final visits = await db.getVisitsForDay();
  VisitRecord? match;
  for (final row in visits) {
    final v = visitFromRow(row);
    if (v.clientId == clientId) {
      match = v;
      break;
    }
  }

  if (match != null) {
    if (match.status == 'in_progress') {
      await db.updateVisit(
        match.id!,
        visitToRow(
          match.copyWith(
            status: 'completed',
            endTime: DateTime.now().toIso8601String(),
          ),
        ),
      );
    }
    return;
  }

  final client = await db.getClientById(clientId);
  final name = clientName?.trim().isNotEmpty == true
      ? clientName!.trim()
      : (client?['name']?.toString() ?? 'Клиент');
  final now = DateTime.now().toIso8601String();
  await db.insertVisit(
    visitToRow(
      VisitRecord(
        clientId: clientId,
        clientName: name,
        startTime: now,
        endTime: now,
        status: 'completed',
        latitude: (client?['latitude'] as num?)?.toDouble(),
        longitude: (client?['longitude'] as num?)?.toDouble(),
      ),
    ),
  );
}
