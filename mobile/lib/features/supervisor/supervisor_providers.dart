import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/mobile_api.dart';
import '../../core/api/supervisor_api.dart';
import '../../core/auth/session.dart';
import '../../core/time/work_region_time.dart';

final supervisorSummaryProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {};
  return ref.read(supervisorApiProvider).getSummary(slug);
});

final supervisorVisitsProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, dateKey) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {'visit_report': {'rows': [], 'totals': {}}};
  final date = dateKey == 'today' ? null : dateKey;
  return ref.read(supervisorApiProvider).getVisits(slug, date: date);
});

final supervisorProductsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {};
  return ref.read(supervisorApiProvider).getProducts(slug);
});

final supervisorAgentLocationsProvider = FutureProvider<List<AgentLocationPin>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(supervisorApiProvider).getAgentLocations(slug);
});

final supervisorLinkedAgentsProvider = FutureProvider<List<SupervisorLinkedAgent>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(supervisorApiProvider).getLinkedAgents(slug);
});

final supervisorKpiMonthProvider = StateProvider<String>((ref) {
  return serverTodayKey().substring(0, 7);
});

final supervisorKpiAgentIdProvider = StateProvider<int?>((ref) => null);

final supervisorKpiByAgentModeProvider = StateProvider<bool>((ref) => false);

final supervisorTeamKpiProvider = FutureProvider<SupervisorTeamKpi>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  final month = ref.watch(supervisorKpiMonthProvider);
  if (slug.isEmpty) return SupervisorTeamKpi.empty();
  return ref.read(supervisorApiProvider).getTeamKpi(slug, month: month);
});

final supervisorAgentKpiProvider = FutureProvider.family<AgentKpiResult, int>((ref, agentId) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  final month = ref.watch(supervisorKpiMonthProvider);
  if (slug.isEmpty || agentId <= 0) return AgentKpiResult.empty();
  return ref.read(supervisorApiProvider).getAgentKpi(slug, agentId: agentId, month: month);
});
