import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import 'agent_report_mock_data.dart';

/// Joriy oy savdosi (fact) — API dan kategoriya / mahsulot jadvali.
final agentReportDataProvider = FutureProvider<AgentDailySalesReport>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return AgentDailySalesReport.empty();
  return ref.read(mobileApiProvider).getAgentDailySales(slug);
});

final agentReportRowsProvider = FutureProvider<List<AgentReportRow>>((ref) async {
  final data = await ref.watch(agentReportDataProvider.future);
  return data.rows
      .map(
        (r) => AgentReportRow(
          name: r.name,
          count: _fmtQty(r.qty),
          volume: _fmtVolume(r.volumeM3),
          sum: _fmtSum(r.sum),
          depth: r.depth,
        ),
      )
      .toList();
});

final agentReportSalesTotalsProvider = FutureProvider<AgentDailySalesTotals>((ref) async {
  final data = await ref.watch(agentReportDataProvider.future);
  return data.totals;
});

String _fmtQty(double v) {
  if (v == v.truncateToDouble()) return v.truncate().toString();
  return v.toStringAsFixed(1);
}

String _fmtVolume(double v) {
  if (v == 0) return '0.0';
  if (v.abs() < 0.01) return v.toStringAsFixed(3);
  return v.toStringAsFixed(1);
}

String _fmtSum(double v) {
  final n = v.round();
  final s = n.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return buf.toString();
}
