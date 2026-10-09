import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/agent/orders/bonus_stock_utils.dart';

void main() {
  test('bonusStockShortage when gift exceeds available stock', () {
    expect(
      bonusStockShortage(stockAvailable: 13, giftQty: 15),
      2,
    );
  });

  test('bonusStockShortage is zero when enough stock', () {
    expect(
      bonusStockShortage(stockAvailable: 20, giftQty: 15),
      0,
    );
  });

  test('buildBonusShortageComment formats auto order comment', () {
    final comment = buildBonusShortageComment(lines: [
      (productName: 'Mahsulot 2', shortage: 7),
    ],);
    expect(comment, contains('Mahsulot 2'));
    expect(comment, contains('7'));
  });

  test('appendOrderComment merges without duplicate', () {
    expect(
      appendOrderComment('Eski', 'Yangi'),
      'Eski\nYangi',
    );
    expect(
      appendOrderComment('Eski\nYangi', 'Yangi'),
      'Eski\nYangi',
    );
  });

  test('takeGiftQtyFromOthers — equal take from two auto products', () {
    final m = {1: 10, 2: 10, 3: 0};
    takeGiftQtyFromOthers(
      qtyByProduct: m,
      excludeProductId: 3,
      amount: 12,
      manualProductIds: {},
    );
    expect(m[1], 4);
    expect(m[2], 4);
    expect(m[3], 0);
  });

  test('takeGiftQtyFromOthers — single holder like screenshot', () {
    final m = {3: 37, 4: 0, 5: 0};
    takeGiftQtyFromOthers(
      qtyByProduct: m,
      excludeProductId: 4,
      amount: 1,
      manualProductIds: {},
    );
    expect(m[3], 36);
    expect(m[4], 0);
  });

  test('takeGiftQtyFromOthers — prefers non-manual before manual', () {
    final m = {1: 10, 2: 10, 3: 0};
    takeGiftQtyFromOthers(
      qtyByProduct: m,
      excludeProductId: 3,
      amount: 12,
      manualProductIds: {1},
    );
    expect(m[1], 8);
    expect(m[2], 0);
    expect(m[3], 0);
  });

  test('resolveGiftQtyWithRedistribution — adds to third product', () {
    final m = {1: 10, 2: 10, 3: 0};
    final manual = <int>{};
    final result = resolveGiftQtyWithRedistribution(
      qtyByProduct: m,
      productId: 3,
      requestedQty: 12,
      maxTotal: 20,
      manualProductIds: manual,
    );
    expect(result, 12);
    m[3] = result;
    expect(m[1], 4);
    expect(m[2], 4);
    expect(m[3], 12);
  });

  test('preserveTotal decrease moves freed qty to others', () {
    final m = {1: 2, 2: 1, 3: 0};
    final result = resolveGiftQtyWithRedistribution(
      qtyByProduct: m,
      productId: 1,
      requestedQty: 1,
      maxTotal: 3,
      manualProductIds: {},
      preserveTotal: true,
      allProductIds: const [1, 2, 3],
    );
    expect(result, 1);
    m[1] = result;
    expect(m[1]! + m[2]! + m[3]!, 3);
    expect(m[1], 1);
  });

  test('preserveTotal cannot drop below max when alone', () {
    final m = {1: 3};
    final result = resolveGiftQtyWithRedistribution(
      qtyByProduct: m,
      productId: 1,
      requestedQty: 1,
      maxTotal: 3,
      manualProductIds: {},
      preserveTotal: true,
      allProductIds: const [1],
    );
    expect(result, 3);
  });

  test('giveGiftQtyToOthers round-robins', () {
    final m = {1: 0, 2: 0, 3: 5};
    final given = giveGiftQtyToOthers(
      qtyByProduct: m,
      excludeProductId: 3,
      amount: 4,
      candidateProductIds: const [1, 2, 3],
    );
    expect(given, 4);
    expect(m[1]! + m[2]!, 4);
  });

  test('capGiftQtyByStock caps to available', () {
    expect(capGiftQtyByStock(stockAvailable: 5, requested: 12), 5);
    expect(capGiftQtyByStock(stockAvailable: 0, requested: 12), 0);
    expect(capGiftQtyByStock(stockAvailable: 20, requested: 12), 12);
  });
}
