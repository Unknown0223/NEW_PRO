import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/clients/okb_metrics.dart';

void main() {
  final clients = [
    {'id': 1, 'visit_weekdays': [5]},
    {'id': 2, 'visit_weekdays': [5]},
    {'id': 3, 'visit_weekdays': [5, 1]},
    {'id': 4, 'visit_weekdays': [1]},
    {'id': 5, 'visit_weekdays': [2]},
  ];

  test('countDormantOnTodayWeekday — juma, 30 kun ichida tashrifsiz', () {
    final n = countDormantOnTodayWeekday(
      clients: clients,
      weekday: 5,
      todayIso: '2026-06-12',
      routeClientIds: {1, 2, 3},
      visitedInLookback: {1, 3},
    );
    expect(n, 1); // faqat id=2
  });

  test('countDormantUniqueClients — noyob, takrorlanmaydi', () {
    final unique = countDormantUniqueClients(clients: clients, visitedInLookback: {1});
    expect(unique, 4);
  });

  test('sumDormantAllWeekdays — hafta kunlari yig‘indisi', () {
  final visited = {1};
    final sum = sumDormantAllWeekdays(clients: clients, visitedInLookback: visited);
    // id=2 (5), id=4 (1), id=5 (2) => 3; id=3 hisoblanadi 5 va 1 uchun => +2 = 5 jami
    expect(sum, 5);
  });

  test('resolveRouteClientIdsForDay — API bo‘sh bo‘lsa reja', () {
    expect(
      resolveRouteClientIdsForDay(route: {'stops': []}, plannedClientIds: {10, 11}),
      {10, 11},
    );
  });
}
