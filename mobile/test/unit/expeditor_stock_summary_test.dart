import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/deliveries/expeditor_stock_summary.dart';

void main() {
  test('summarizeStock triad from rows', () {
    final s = summarizeStock([
      {'loaded_qty': 10, 'delivered_qty': 4},
      {'loaded_qty': 5, 'delivered_qty': 5},
    ]);
    expect(s.loaded, 15);
    expect(s.delivered, 9);
    expect(s.remaining, 6);
  });

  test('summarizeStock empty', () {
    final s = summarizeStock([]);
    expect(s.loaded, 0);
    expect(s.delivered, 0);
    expect(s.remaining, 0);
  });

  test('stockTriadFromTotals prefers API totals', () {
    final s = stockTriadFromTotals({
      'loaded_qty': 20,
      'delivered_qty': 8,
      'remaining_qty': 12,
    });
    expect(s, isNotNull);
    expect(s!.loaded, 20);
    expect(s.delivered, 8);
    expect(s.remaining, 12);
  });
}
