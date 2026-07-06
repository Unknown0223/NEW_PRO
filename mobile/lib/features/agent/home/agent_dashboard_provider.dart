import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';

final agentDashboardProvider = FutureProvider<AgentDashboardResult>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) {
    return AgentDashboardResult(
      clientsCount: 0,
      visitsToday: 0,
      ordersToday: 0,
      ordersSumToday: 0,
      planSum: 0,
      performancePct: 0,
      pendingOffline: 0,
    );
  }
  return ref.read(mobileApiProvider).getAgentDashboard(slug);
});
