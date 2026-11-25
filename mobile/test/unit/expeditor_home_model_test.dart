import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/home/expeditor_home_model.dart';

void main() {
  test('mapHomeOtmetkaChip null → null', () {
    expect(mapHomeOtmetkaChip(null), isNull);
  });

  test('mapHomeOtmetkaChip shows Keldi with HH:mm', () {
    final chip = mapHomeOtmetkaChip({
      'status': 'in',
      'punched_at': '2026-11-25T08:28:00.000Z',
    });
    expect(chip, isNotNull);
    expect(chip!.label.toLowerCase(), contains('keldi'));
    expect(chip.label, matches(RegExp(r'Otmetka: Keldi \(\d{2}:\d{2}\)')));
  });

  test('mapNextStop null-safe when missing', () {
    expect(mapNextStop(null), isNull);
    expect(mapNextStop({}), isNull);
  });

  test('mapNextStop reads name and distance_km', () {
    final stop = mapNextStop({
      'client_name': 'Baraka Market',
      'distance_km': 1.4,
      'seq': 15,
      'order_sum': 3240000,
      'item_count': 18,
    });
    expect(stop?.clientName, 'Baraka Market');
    expect(stop?.distanceKm, 1.4);
    expect(stop?.seq, 15);
    expect(stop?.orderSum, 3240000);
    expect(stop?.itemCount, 18);
  });

  test('mapDailyPlan and payments pending', () {
    final plan = mapDailyPlan({
      'performance_pct': 64,
      'visited': 14,
      'visit_total': 22,
      'remaining': 8,
    });
    expect(plan.pct, 64);
    expect(plan.visited, 14);
    expect(plan.remaining, 8);

    final p = mapPaymentsPending({'pending_count': 3, 'pending_sum': 4850000});
    expect(p.count, 3);
    expect(p.sum, 4850000);
  });

  test('mapShipmentLines maps labels', () {
    final lines = mapShipmentLines([
      {'type': 'delivered', 'sum': 100, 'qty': 2},
      {'type': 'return', 'sum': 10, 'qty': 1},
    ]);
    expect(lines.first.label, 'Yetkazildi');
    expect(lines.last.label, 'Qaytarish');
  });
}
