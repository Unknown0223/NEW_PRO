import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/api/orders_api.dart';

void main() {
  test('StockRow.fromJson reads mobile orders/stock `available` field', () {
    final row = StockRow.fromJson({'product_id': 3, 'available': 222});
    expect(row.productId, 3);
    expect(row.available, 222);
  });

  test('StockRow.fromJson still supports raw qty and reserved_qty', () {
    final row = StockRow.fromJson({'product_id': 5, 'qty': 100, 'reserved_qty': 30});
    expect(row.available, 70);
  });
}
