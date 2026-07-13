import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../clients/agent_outlet_filters_provider.dart';
import '../../features/agent/clients/agent_clients_page.dart';
import '../../features/agent/home/agent_dashboard_provider.dart';
import '../../features/agent/home/agent_home_page.dart';
import '../../features/agent/home/home_visit_metrics_provider.dart';
import '../../features/agent/home/sync_count_provider.dart';
import '../../features/agent/orders/orders_providers.dart';
import '../../features/agent/route/agent_route_provider.dart';

typedef ProviderInvalidator = void Function(ProviderOrFamily provider);

void _invalidateAll(ProviderInvalidator invalidate) {
  invalidate(homeStatsProvider);
  invalidate(syncCountTodayProvider);
  invalidate(agentDashboardProvider);
  invalidate(homeVisitMetricsProvider);
  invalidate(realTodayRouteProvider);
  invalidate(clientsListProvider);
  invalidate(filteredClientsProvider);
  invalidate(agentStaleClientCatalogProvider);
  invalidate(ordersListProvider);
}

/// Sinxron tugagach barcha bog‘liq ekranlarni yangilash (`Ref` yoki `WidgetRef`).
void invalidateSyncedData(ProviderInvalidator invalidate) => _invalidateAll(invalidate);

/// Chiqish / sessiya tugagach kesh providerlarini tozalash.
void invalidateAuthScopedData(ProviderInvalidator invalidate) => _invalidateAll(invalidate);
