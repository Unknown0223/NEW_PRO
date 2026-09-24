import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../clients/agent_outlet_filters_provider.dart';
import '../../features/agent/visits/agent_visits_page.dart';
import '../../features/agent/clients/agent_clients_page.dart';
import '../../features/agent/home/agent_dashboard_provider.dart';
import '../../features/agent/home/agent_home_page.dart';
import '../../features/agent/home/home_visit_metrics_provider.dart';
import '../../features/agent/home/sync_count_provider.dart';
import '../../features/agent/orders/orders_providers.dart';
import '../../features/agent/route/agent_route_provider.dart';
import '../../features/agent/kpi/kpi_provider.dart';

typedef ProviderInvalidator = void Function(ProviderOrFamily provider);

void _invalidateAll(ProviderInvalidator invalidate) {
  invalidate(homeStatsProvider);
  invalidate(syncCountTodayProvider);
  invalidate(pendingPhotoCountProvider);
  invalidate(syncedPhotoCountTodayProvider);
  invalidate(failedPhotoCountProvider);
  invalidate(agentDashboardProvider);
  invalidate(homeVisitMetricsProvider);
  invalidate(visitedTodayClientIdsProvider);
  invalidate(visitsTodayProvider);
  invalidate(realTodayRouteProvider);
  invalidate(clientsListProvider);
  // filteredClientsProvider clientsListProvider.future ni watch qiladi —
  // alohida invalidate shart emas (cascade flickering oldini olish).
  invalidate(agentStaleClientCatalogProvider);
  invalidate(ordersListProvider);
  invalidate(agentKpiProvider);
}

/// Sinxron tugagach barcha bog‘liq ekranlarni yangilash (`Ref` yoki `WidgetRef`).
void invalidateSyncedData(ProviderInvalidator invalidate) => _invalidateAll(invalidate);

/// Bitta zakaz yuborilgach — katalog/full-sync emas, faqat zakaz va vizit ko‘rsatkichlari.
void invalidateAfterOrderSubmit(ProviderInvalidator invalidate) {
  invalidate(homeStatsProvider);
  invalidate(pendingPhotoCountProvider);
  invalidate(syncedPhotoCountTodayProvider);
  invalidate(failedPhotoCountProvider);
  invalidate(agentDashboardProvider);
  invalidate(homeVisitMetricsProvider);
  invalidate(visitedTodayClientIdsProvider);
  invalidate(visitsTodayProvider);
  invalidate(ordersListProvider);
}

/// Chiqish / sessiya tugagach kesh providerlarini tozalash.
void invalidateAuthScopedData(ProviderInvalidator invalidate) => _invalidateAll(invalidate);
