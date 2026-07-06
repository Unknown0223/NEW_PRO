/// Bonus sovg‘a uchun ombor qoldig‘i (API: savatdan keyin qolgan).
library;
import '../../../core/l10n/app_strings_ru.dart';
import 'order_create_models.dart';

double bonusStockAvailable(double stockAvailable) =>
    stockAvailable.clamp(0, double.infinity);

/// Tanlangan bonus miqdori ombordan oshsa — yetishmayotgan dona.
int bonusStockShortage({
  required double stockAvailable,
  required int giftQty,
}) {
  if (giftQty <= 0) return 0;
  final avail = bonusStockAvailable(stockAvailable);
  final short = giftQty - avail;
  return short.ceil().clamp(0, giftQty);
}

int capGiftQtyByStock({
  required double stockAvailable,
  required int requested,
}) {
  if (requested <= 0) return 0;
  final avail = bonusStockAvailable(stockAvailable).floor();
  return requested.clamp(0, avail);
}

/// Boshqa mahsulotlardan bonus olib tashlash (teng navbatda).
/// Qaytadi: haqiqatan olingan dona soni.
int takeGiftQtyRoundRobin({
  required Map<int, int> qtyByProduct,
  required List<int> productIds,
  required int amount,
}) {
  if (amount <= 0 || productIds.isEmpty) return 0;
  var left = amount;
  var taken = 0;
  var idx = 0;
  final active = productIds.where((id) => (qtyByProduct[id] ?? 0) > 0).toList();
  while (left > 0 && active.isNotEmpty) {
    active.removeWhere((id) => (qtyByProduct[id] ?? 0) <= 0);
    if (active.isEmpty) break;
    final pid = active[idx % active.length];
    qtyByProduct[pid] = (qtyByProduct[pid] ?? 0) - 1;
    left--;
    taken++;
    idx++;
  }
  return taken;
}

/// [excludeProductId] dan tashqari mahsulotlardan [amount] dona olib tashlaydi.
/// Avval qo‘lda o‘zgartirilmaganlar, keyin qo‘lda o‘zgartirilganlar (teng taqsimlash).
int takeGiftQtyFromOthers({
  required Map<int, int> qtyByProduct,
  required int excludeProductId,
  required int amount,
  required Set<int> manualProductIds,
}) {
  if (amount <= 0) return 0;
  var taken = 0;
  final pool1 = qtyByProduct.keys
      .where(
        (id) =>
            id != excludeProductId &&
            !manualProductIds.contains(id) &&
            (qtyByProduct[id] ?? 0) > 0,
      )
      .toList();
  taken += takeGiftQtyRoundRobin(qtyByProduct: qtyByProduct, productIds: pool1, amount: amount - taken);
  if (taken >= amount) return taken;

  final pool2 = qtyByProduct.keys
      .where(
        (id) =>
            id != excludeProductId &&
            manualProductIds.contains(id) &&
            (qtyByProduct[id] ?? 0) > 0,
      )
      .toList();
  taken += takeGiftQtyRoundRobin(qtyByProduct: qtyByProduct, productIds: pool2, amount: amount - taken);
  return taken;
}

/// Yangi miqdor kiritilganda limitdan oshsa boshqalardan avtomatik ayirish.
int resolveGiftQtyWithRedistribution({
  required Map<int, int> qtyByProduct,
  required int productId,
  required int requestedQty,
  required int maxTotal,
  required Set<int> manualProductIds,
}) {
  final oldQty = qtyByProduct[productId] ?? 0;
  var target = requestedQty.clamp(0, maxTotal);
  if (target <= oldQty) return target;

  final otherTotal = qtyByProduct.entries
      .where((e) => e.key != productId)
      .fold<int>(0, (s, e) => s + e.value);
  final overflow = otherTotal + target - maxTotal;
  if (overflow > 0) {
    takeGiftQtyFromOthers(
      qtyByProduct: qtyByProduct,
      excludeProductId: productId,
      amount: overflow,
      manualProductIds: manualProductIds,
    );
    final newOtherTotal = qtyByProduct.entries
        .where((e) => e.key != productId)
        .fold<int>(0, (s, e) => s + e.value);
    target = (maxTotal - newOtherTotal).clamp(0, maxTotal);
    if (target > requestedQty) target = requestedQty;
  }
  return target;
}

bool hasAnyBonusStockShortage({
  required Iterable<({double stockAvailable, int giftQty})> lines,
}) {
  for (final line in lines) {
    if (bonusStockShortage(
      stockAvailable: line.stockAvailable,
      giftQty: line.giftQty,
    ) > 0) {
      return true;
    }
  }
  return false;
}

/// Buyurtma kommentiga qo‘shiladigan avtomatik bonus yetishmovchilik matni.
String buildBonusShortageComment({
  required Iterable<({String productName, int shortage})> lines,
}) {
  final parts = <String>[];
  for (final line in lines) {
    if (line.shortage > 0) {
      parts.add('${line.productName}: ${S.bonusStockShortage} ${line.shortage} шт.');
    }
  }
  if (parts.isEmpty) return '';
  return '${S.bonusShortageCommentPrefix}: ${parts.join('; ')}';
}

/// Buyurtma kommentiga qo‘shiladigan avtomatik skidka muammosi matni.
String buildDiscountShortageComment({
  required String reasonKey,
  double? discountPct,
  required double expectedSum,
}) {
  final pctTxt = discountPct != null ? '${discountPct.toStringAsFixed(0)}%' : '—';
  final sumTxt = expectedSum > 0 ? formatOrderMoney(expectedSum) : '0';
  String reason;
  switch (reasonKey) {
    case 'cash_desk_missing':
      reason = 'касса не настроена';
      break;
    case 'bonus_required':
      reason = 'требуется связанный бонус';
      break;
    default:
      reason = 'не применена';
  }
  return '${S.discountShortageCommentPrefix} — $reason: $pctTxt, сумма $sumTxt';
}

String appendOrderComment(String base, String extra) {
  final b = base.trim();
  final e = extra.trim();
  if (e.isEmpty) return b;
  if (b.isEmpty) return e;
  if (b.contains(e)) return b;
  return '$b\n$e';
}
