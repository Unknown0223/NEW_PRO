import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/sync/sync_payload_parser.dart';

void main() {
  test('parseSyncPayload maps rows for sqlite', () {
    const raw = '''
{
  "sync_at": "2026-06-07T12:00:00.000Z",
  "clients_replace_all": true,
  "clients": [{"id": 1, "name": "A", "visit_weekdays": [1, 2]}],
  "products": [{"id": 10, "name": "P"}],
  "prices": [{"product_id": 10, "price_type": "default", "price": 1000}],
  "orders": [{"id": 5, "client_id": 1, "status": "new", "total_sum": 500}]
}
''';
    final p = parseSyncPayload(raw);
    expect(p.syncAt, '2026-06-07T12:00:00.000Z');
    expect(p.clientsReplaceAll, isTrue);
    expect(p.clients.single['name'], 'A');
    expect(p.products.single['id'], 10);
    expect(p.prices.single['price'], 1000.0);
    expect(p.orders.single['total'], 500.0);
  });
}
