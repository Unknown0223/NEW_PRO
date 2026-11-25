import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/visits/expeditor_visits_tezyuk_filter.dart';

void main() {
  test('filterTezyukVisitRows debt and return', () {
    final rows = [
      {'order_id': 1, 'status': 'delivering', 'balance': -100},
      {'order_id': 2, 'status': 'delivered', 'balance': 0},
      {'order_id': 3, 'status': 'returned', 'balance': 50},
    ];
    expect(filterTezyukVisitRows(rows, 'debt').length, 1);
    expect(filterTezyukVisitRows(rows, 'return').length, 1);
    expect(filterTezyukVisitRows(rows, 'pending').length, 1);
    expect(filterTezyukVisitRows(rows, 'completed').length, 1);
    expect(mergeTezyukVisitRows(rows, []).length, 3);
  });
}