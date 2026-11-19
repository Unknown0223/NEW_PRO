import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/clients/client_local_uniques.dart';

void main() {
  final catalog = [
    {
      'id': 1,
      'name': 'Magazin One',
      'phone': '+998901112233',
      'inn': '123456789',
      'client_pinfl': '',
      'region': 'Toshkent',
      'zone': 'Z1',
      'city': 'Chilonzor',
    },
    {
      'id': 2,
      'name': 'Other',
      'phone': '+998909998877',
      'inn': '',
      'client_pinfl': '30101890123456',
      'region': 'Samarqand',
      'city': 'Markaz',
    },
  ];

  test('blocks same phone', () {
    expect(
      findLocalClientDuplicateMessage(
        catalog,
        name: 'New',
        phone: '901112233',
      ),
      contains('telefon'),
    );
  });

  test('blocks same INN', () {
    expect(
      findLocalClientDuplicateMessage(
        catalog,
        name: 'Other name',
        inn: '123456789',
      ),
      contains('INN'),
    );
  });

  test('blocks same territory+name+INN as DuplicateClient', () {
    expect(
      findLocalClientDuplicateMessage(
        catalog,
        name: 'Magazin One',
        inn: '123456789',
        region: 'Toshkent',
        zone: 'Z1',
        city: 'Chilonzor',
      ),
      contains('mavjud'),
    );
  });

  test('allows same name in different city', () {
    expect(
      findLocalClientDuplicateMessage(
        catalog,
        name: 'Magazin One',
        region: 'Toshkent',
        city: 'Yunusobod',
      ),
      isNull,
    );
  });

  test('excludeClientId skips self on edit', () {
    expect(
      findLocalClientDuplicateMessage(
        catalog,
        name: 'Magazin One',
        inn: '123456789',
        region: 'Toshkent',
        zone: 'Z1',
        city: 'Chilonzor',
        excludeClientId: 1,
      ),
      isNull,
    );
  });
}
