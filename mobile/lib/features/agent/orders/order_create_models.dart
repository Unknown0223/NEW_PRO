import '../../../core/format/money_display.dart';

export '../../../core/format/money_display.dart'
    show
        formatMoneySpaced,
        formatMoneyUz,
        formatDebtMoney,
        parseMoneyAmount,
        formatClientBalanceAmount,
        formatClientBalanceFromMap,
        colorForClientBalance,
        isClientDebtBalance,
        isClientCreditorBalance,
        ClientBalanceText;

class OrderCategoryGroup {
  final int? id;
  final String name;
  final List<Map<String, dynamic>> products;

  const OrderCategoryGroup({this.id, required this.name, required this.products});
}

List<OrderCategoryGroup> groupProductsByCategory(
  List<Map<String, dynamic>> products, {
  bool sortProductsAlphabetically = true,
}) {
  final map = <String, OrderCategoryGroup>{};
  for (final p in products) {
    final cat = p['category'];
    int? catId;
    String catName = 'Boshqa';
    if (cat is Map) {
      catId = (cat['id'] as num?)?.toInt();
      final n = cat['name']?.toString().trim();
      if (n != null && n.isNotEmpty) catName = n;
    } else {
      catId = (p['category_id'] as num?)?.toInt();
    }
    final key = '${catId ?? 0}|$catName';
    final g = map.putIfAbsent(
      key,
      () => OrderCategoryGroup(id: catId, name: catName, products: <Map<String, dynamic>>[]),
    );
    g.products.add(p);
  }
  final list = map.values.toList();
  list.sort((a, b) => a.name.compareTo(b.name));
  for (final g in list) {
    sortProductList(g.products, alphabetical: sortProductsAlphabetically);
  }
  return list;
}

void sortProductList(List<Map<String, dynamic>> products, {required bool alphabetical}) {
  if (!alphabetical) return;
  products.sort((a, b) => (a['name']?.toString() ?? '').toLowerCase().compareTo((b['name']?.toString() ?? '').toLowerCase()));
}

String productQuantityLabel(Map<String, dynamic> product, double qty, {required bool showBoxes}) {
  final unit = product['unit']?.toString().trim() ?? 'dona';
  if (!showBoxes || qty <= 0) return unit;
  final perBox = (product['units_per_box'] as num?)?.toDouble() ??
      (product['pack_size'] as num?)?.toDouble() ??
      (product['items_per_box'] as num?)?.toDouble();
  if (perBox == null || perBox <= 0) return unit;
  final boxes = qty / perBox;
  final boxStr = boxes == boxes.roundToDouble() ? boxes.toInt().toString() : boxes.toStringAsFixed(1);
  return '$boxStr quti';
}

String formatOrderMoney(double v) => formatMoneySpaced(v);

double parseOrderNum(dynamic v) {
  if (v is num) return v.toDouble();
  return double.tryParse(v?.toString().replaceAll(',', '.') ?? '') ?? 0;
}

int? parseOrderInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '');
}

int qtyInCart(Map<int, double> quantities) {
  var n = 0.0;
  for (final q in quantities.values) {
    if (q > 0) n += q;
  }
  return n.round();
}
