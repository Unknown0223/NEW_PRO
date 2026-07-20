import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/time/work_region_time.dart';

/// Tanlangan oy — `YYYY-MM`.
final kpiMonthProvider = StateProvider<String>((ref) {
  return serverTodayKey().substring(0, 7);
});

final agentKpiProvider = FutureProvider<AgentKpiResult>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  final month = ref.watch(kpiMonthProvider);
  if (slug.isEmpty) return AgentKpiResult.empty();
  return ref.read(mobileApiProvider).getAgentKpi(slug, month: month);
});
