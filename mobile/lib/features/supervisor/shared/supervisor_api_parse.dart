/// Supervisor mobil API javoblarini normalizatsiya qilish.
library;

class SupervisorVisitAgentRow {
  final int agentId;
  final String agentName;
  final String? agentCode;
  final int plannedVisits;
  final int visitedTotal;
  final int notVisited;
  final int visitsWithOrders;
  final int gpsVisits;
  final int photoReports;
  final String salesSum;

  const SupervisorVisitAgentRow({
    required this.agentId,
    required this.agentName,
    this.agentCode,
    required this.plannedVisits,
    required this.visitedTotal,
    required this.notVisited,
    required this.visitsWithOrders,
    required this.gpsVisits,
    required this.photoReports,
    required this.salesSum,
  });

  factory SupervisorVisitAgentRow.fromJson(Map<String, dynamic> j) => SupervisorVisitAgentRow(
        agentId: j['agent_id'] as int? ?? 0,
        agentName: j['agent_name']?.toString() ?? 'Agent',
        agentCode: j['agent_code']?.toString(),
        plannedVisits: j['planned_visits'] as int? ?? 0,
        visitedTotal: j['visited_total'] as int? ?? 0,
        notVisited: j['not_visited'] as int? ?? 0,
        visitsWithOrders: j['visits_with_orders'] as int? ?? 0,
        gpsVisits: j['gps_visits'] as int? ?? 0,
        photoReports: j['photo_reports'] as int? ?? 0,
        salesSum: j['sales_sum']?.toString() ?? '0',
      );
}

class SupervisorVisitsPayload {
  final List<SupervisorVisitAgentRow> rows;
  final Map<String, dynamic> totals;

  const SupervisorVisitsPayload({required this.rows, required this.totals});

  factory SupervisorVisitsPayload.fromApi(Map<String, dynamic> raw) {
    final report = raw['visit_report'] as Map?;
    final list = (report?['rows'] as List?) ?? raw['data'] as List? ?? raw['rows'] as List? ?? [];
    final totals = Map<String, dynamic>.from(report?['totals'] as Map? ?? {});
    return SupervisorVisitsPayload(
      rows: list
          .map((e) => SupervisorVisitAgentRow.fromJson(Map<String, dynamic>.from(e as Map)))
          .where((r) => r.agentId > 0)
          .toList(),
      totals: totals,
    );
  }

  int totalPlanned() => totals['planned_visits'] as int? ?? rows.fold(0, (s, r) => s + r.plannedVisits);
  int totalVisited() => totals['visited_total'] as int? ?? rows.fold(0, (s, r) => s + r.visitedTotal);
  int totalNotVisited() => totals['not_visited'] as int? ?? rows.fold(0, (s, r) => s + r.notVisited);
  int totalWithOrders() => totals['visits_with_orders'] as int? ?? rows.fold(0, (s, r) => s + r.visitsWithOrders);
}

Map<String, dynamic> parseSupervisorKpi(Map<String, dynamic> raw) {
  return Map<String, dynamic>.from(raw['kpi'] as Map? ?? raw);
}
