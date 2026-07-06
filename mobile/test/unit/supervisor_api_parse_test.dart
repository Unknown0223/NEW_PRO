import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/supervisor/shared/supervisor_api_parse.dart';

void main() {
  test('SupervisorVisitsPayload parses visit_report.rows and totals', () {
    final payload = SupervisorVisitsPayload.fromApi({
      'visit_report': {
        'rows': [
          {
            'agent_id': 5,
            'agent_name': 'Ali',
            'agent_code': 'A01',
            'planned_visits': 10,
            'visited_total': 7,
            'not_visited': 3,
            'visits_with_orders': 4,
            'gps_visits': 6,
            'photo_reports': 2,
            'sales_sum': '1500000',
          },
        ],
        'totals': {
          'planned_visits': 10,
          'visited_total': 7,
          'not_visited': 3,
          'visits_with_orders': 4,
        },
      },
      'total': 1,
      'page': 1,
      'limit': 50,
    });

    expect(payload.rows.length, 1);
    expect(payload.rows.first.agentName, 'Ali');
    expect(payload.totalPlanned(), 10);
    expect(payload.totalVisited(), 7);
    expect(payload.totalNotVisited(), 3);
    expect(payload.totalWithOrders(), 4);
  });

  test('parseSupervisorKpi unwraps nested kpi object', () {
    final kpi = parseSupervisorKpi({
      'kpi': {'visit_pct': 85, 'planned_visits': 12},
    });
    expect(kpi['visit_pct'], 85);
    expect(kpi['planned_visits'], 12);
  });
}
