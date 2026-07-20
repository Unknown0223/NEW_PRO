import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/time/work_region_time.dart';

/// Tanlangan oy — `YYYY-MM` (default: joriy ish-mintaqa oyi).
final tabelMonthProvider = StateProvider<String>((ref) {
  return serverTodayKey().substring(0, 7);
});

/// Agentning tanlangan oy uchun табель ma'lumoti (web timesheet bilan bitta manba).
final tabelDataProvider = FutureProvider<AgentTimesheetResult>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  final month = ref.watch(tabelMonthProvider);
  if (slug.isEmpty) {
    return AgentTimesheetResult(
      month: month,
      employee: const AgentTimesheetEmployee(
        id: 0,
        fio: '',
        role: 'agent',
        login: '',
      ),
      locked: false,
      days: const [],
      totals: AgentTimesheetTotals.empty(),
    );
  }
  return ref.read(mobileApiProvider).getAgentTimesheet(slug, month: month);
});
