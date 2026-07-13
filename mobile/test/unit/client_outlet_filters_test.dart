import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/clients/client_outlet_filters.dart';
import 'package:salesdoc_mobile/core/l10n/app_strings_ru.dart';

void main() {
  test('parseVisitWeekdaysFromRuSelection', () {
    expect(parseVisitWeekdaysFromRuSelection('ПН, СР, ПТ'), [1, 3, 5]);
    expect(parseVisitWeekdaysFromRuSelection('ВС'), [7]);
    expect(parseVisitWeekdaysFromRuSelection(''), isEmpty);
  });

  test('clientMatchesWeekdayTab — Все', () {
    expect(clientMatchesWeekdayTab({'visit_weekdays': '[1,3]'}, 0), isTrue);
  });

  test('clientMatchesWeekdayTab — kun bo‘yicha', () {
    final c = {'visit_weekdays': [1, 3, 5]};
    expect(clientMatchesWeekdayTab(c, 1), isTrue);
    expect(clientMatchesWeekdayTab(c, 2), isFalse);
    expect(clientMatchesWeekdayTab({'visit_weekdays': []}, 2), isFalse);
  });

  test('clientMatchesWeekdayTab — marshrut fallback', () {
    expect(
      clientMatchesWeekdayTab({'id': 5, 'visit_weekdays': []}, 2, routeClientIds: {5}),
      isTrue,
    );
    expect(
      clientMatchesWeekdayTab({'id': 5, 'visit_weekdays': []}, 2, routeClientIds: {9}),
      isFalse,
    );
  });

  test('formatVisitWeekdaysRu — comma separated labels', () {
    expect(formatVisitWeekdaysRu([2]), 'ВТ');
    expect(formatVisitWeekdaysRu([1, 3, 5]), 'ПН, СР, ПТ');
    expect(formatVisitWeekdaysRu([5, 1]), 'ПН, ПТ');
  });

  test('formatClientVisitDaysDisplay from visit_weekdays JSON', () {
    expect(
      formatClientVisitDaysDisplay({'visit_weekdays': '[2,5]'}),
      'ВТ, ПТ',
    );
    expect(
      formatClientVisitDaysDisplay({'visit_weekdays': [1, 7]}),
      'ПН, ВС',
    );
    expect(
      formatClientVisitDaysDisplay({'visit_day': 'ПН, СР'}),
      'ПН, СР',
    );
  });

  test('resolveClientVisitWeekdays — visit_day fallback', () {
    expect(resolveClientVisitWeekdays({'visit_day': 'ВТ, ПТ'}), [2, 5]);
  });

  test('clientPlannedForVisitDay — aniq sana yoki hafta kuni', () {
    expect(clientPlannedForVisitDay({'visit_weekdays': [5]}, 5, '2026-06-12'), isTrue);
    expect(clientPlannedForVisitDay({'visit_date': '2026-06-12'}, 1, '2026-06-12'), isTrue);
    expect(clientPlannedForVisitDay({'visit_weekdays': [1]}, 5, '2026-06-12'), isFalse);
  });

  test('clientPlannedForWeekday — takrorlanuvchi reja', () {
    expect(clientPlannedForWeekday({'visit_weekdays': [1, 5]}, 5), isTrue);
    expect(clientPlannedForWeekday({'visit_day': 'ПН'}, 1), isTrue);
    expect(clientPlannedForWeekday({'visit_weekdays': [1]}, 5), isFalse);
  });

  test('applyOutletFilters — kategoriya va poseshchenie', () {
    final clients = [
      {'id': 1, 'category': 'A', 'visit_weekdays': [1]},
      {'id': 2, 'category': 'B', 'visit_weekdays': [1]},
      {'id': 3, 'category': 'A', 'visit_weekdays': [2]},
    ];
    final byCat = applyOutletFilters(clients, weekdayTab: 1, category: 'A');
    expect(byCat.map((c) => c['id']).toList(), [1]);

    final visited = applyOutletFilters(
      clients,
      weekdayTab: 0,
      visitStatus: S.visitStatusVisited,
      visitedTodayIds: {1, 3},
    );
    expect(visited.map((c) => c['id']).toList(), [1, 3]);
  });
}
