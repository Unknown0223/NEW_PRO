import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/home/expeditor_home_model.dart';
import 'package:salesdoc_mobile/features/expeditor/home/tezyuk_shipment_report_filter.dart';

HomeShipmentLine _line({
  required String key,
  double sum = 0,
  num qty = 0,
}) {
  return HomeShipmentLine(key: key, label: key, sum: sum, qty: qty);
}

void main() {
  test('filterVisibleShipmentLines keeps non-zero sum or qty', () {
    final rows = [
      _line(key: 'shipped'),
      _line(key: 'delivered'),
      _line(key: 'return'),
      _line(key: 'shelf_return'),
      _line(key: 'exchange_ship'),
      _line(key: 'exchange_return'),
      _line(key: 'on_board', sum: 320400, qty: 24),
      _line(key: 'remaining', sum: 320400, qty: 24),
    ];

    final visible = filterVisibleShipmentLines(rows);

    expect(visible.map((e) => e.key).toList(), ['on_board', 'remaining']);
  });

  test('filterVisibleShipmentLines keeps sum-only or qty-only', () {
    final rows = [
      _line(key: 'a', sum: 100, qty: 0),
      _line(key: 'b', sum: 0, qty: 1),
      _line(key: 'c'),
    ];

    final visible = filterVisibleShipmentLines(rows);

    expect(visible.map((e) => e.key).toList(), ['a', 'b']);
  });

  test('filterVisibleShipmentLines all zeros yields empty', () {
    final rows = [
      _line(key: 'shipped'),
      _line(key: 'delivered'),
    ];

    expect(filterVisibleShipmentLines(rows), isEmpty);
  });
}
