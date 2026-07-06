import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/supervisor_api.dart';
import '../../core/auth/session.dart';

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
