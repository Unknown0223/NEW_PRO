import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/price_type_labels.dart';
import 'api_exceptions.dart';
import 'dio_client.dart';

class OrdersApi {
  final Dio _dio;
  OrdersApi(this._dio);

  Future<OrderCreateContext> getCreateContext(
    String slug, {
    int? clientId,
    int? warehouseId,
  }) async {
    try {
      final q = <String, dynamic>{};
      if (clientId != null) q['selected_client_id'] = clientId;
      if (warehouseId != null) q['selected_warehouse_id'] = warehouseId;
      final r = await _dio.get(
        '/api/$slug/mobile/orders/create-context',
        queryParameters: q.isEmpty ? null : q,
      );
      return OrderCreateContext.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<StockRow>> getStock(
    String slug, {
    required int warehouseId,
    required List<int> productIds,
  }) async {
    if (productIds.isEmpty) return [];
    const chunkSize = 80;
    final chunks = <List<int>>[];
    for (var i = 0; i < productIds.length; i += chunkSize) {
      chunks.add(productIds.skip(i).take(chunkSize).toList());
    }
    try {
      final parts = await Future.wait(
        chunks.map((chunk) async {
          final r = await _dio.get(
            '/api/$slug/mobile/orders/stock',
            queryParameters: {
              'warehouse_id': warehouseId,
              'product_ids': chunk.join(','),
            },
          );
          final data = r.data['data'] as List? ?? [];
          return data
              .map((e) => StockRow.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList();
        }),
      );
      return parts.expand((rows) => rows).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  /// Ombor qoldig‘i — bitta API (agent scope + barcha qoldiqlar).
  Future<Map<String, dynamic>> getWarehouseStockView(
    String slug, {
    int? warehouseId,
  }) async {
    try {
      final q = <String, dynamic>{};
      if (warehouseId != null) q['warehouse_id'] = warehouseId;
      final r = await _dio.get(
        '/api/$slug/mobile/warehouse-stock',
        queryParameters: q.isEmpty ? null : q,
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> previewBonus(
    String slug, {
    required int clientId,
    required int warehouseId,
    required List<OrderLineInput> items,
    String? priceType,
    List<BonusGiftOverrideInput> giftOverrides = const [],
    List<BonusGiftLineInput> giftLines = const [],
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/orders/bonus-preview',
        data: {
          'client_id': clientId,
          'warehouse_id': warehouseId,
          if (priceType != null && priceType.trim().isNotEmpty) 'price_type': priceType.trim(),
          'items': items
              .map((i) => {
                    'product_id': i.productId,
                    'qty': i.qty == i.qty.roundToDouble() ? i.qty.round() : i.qty,
                  },)
              .toList(),
          if (giftOverrides.isNotEmpty)
            'bonus_gift_overrides': giftOverrides
                .map((g) => {
                      'bonus_rule_id': g.bonusRuleId,
                      'bonus_product_id': g.bonusProductId,
                    },)
                .toList(),
          if (giftLines.isNotEmpty)
            'bonus_gift_lines': giftLines
                .map((g) => {
                      'bonus_rule_id': g.bonusRuleId,
                      'product_id': g.productId,
                      'qty': g.qty,
                    },)
                .toList(),
        },
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> createOrder(
    String slug, {
    required int clientId,
    required int warehouseId,
    required List<OrderLineInput> items,
    String? priceType,
    bool applyBonus = true,
    bool applyDiscount = true,
    List<BonusGiftOverrideInput> giftOverrides = const [],
    List<BonusGiftLineInput> giftLines = const [],
    String? comment,
    bool isConsignment = false,
    String? consignmentDueDate,
    String? shipmentDate,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/orders/create',
        data: {
          'client_id': clientId,
          'warehouse_id': warehouseId,
          if (priceType != null && priceType.trim().isNotEmpty) 'price_type': priceType.trim(),
          'apply_bonus': applyBonus,
          'apply_discount': applyDiscount,
          if (giftOverrides.isNotEmpty)
            'bonus_gift_overrides': giftOverrides
                .map((g) => {
                      'bonus_rule_id': g.bonusRuleId,
                      'bonus_product_id': g.bonusProductId,
                    },)
                .toList(),
          if (giftLines.isNotEmpty)
            'bonus_gift_lines': giftLines
                .map((g) => {
                      'bonus_rule_id': g.bonusRuleId,
                      'product_id': g.productId,
                      'qty': g.qty,
                    },)
                .toList(),
          if (comment != null && comment.isNotEmpty) 'comment': comment,
          if (isConsignment) 'is_consignment': true,
          if (isConsignment && consignmentDueDate != null && consignmentDueDate.trim().isNotEmpty)
            'consignment_due_date': consignmentDueDate.trim(),
          if (shipmentDate != null && shipmentDate.trim().isNotEmpty) 'shipment_date': shipmentDate.trim(),
          'items': items
              .map((i) => {
                    'product_id': i.productId,
                    'qty': i.qty == i.qty.roundToDouble() ? i.qty.round() : i.qty,
                  },)
              .toList(),
        },
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

final ordersApiProvider = Provider<OrdersApi>((ref) => OrdersApi(ref.read(dioProvider)));

class OrderLineInput {
  final int productId;
  final double qty;
  const OrderLineInput({required this.productId, required this.qty});
}

class BonusGiftOverrideInput {
  final int bonusRuleId;
  final int bonusProductId;
  const BonusGiftOverrideInput({required this.bonusRuleId, required this.bonusProductId});
}

class BonusGiftLineInput {
  final int bonusRuleId;
  final int productId;
  final int qty;
  const BonusGiftLineInput({
    required this.bonusRuleId,
    required this.productId,
    required this.qty,
  });
}

class StockRow {
  final int productId;
  final double qty;
  final double reservedQty;
  StockRow({required this.productId, required this.qty, required this.reservedQty});
  factory StockRow.fromJson(Map<String, dynamic> j) {
    final productId = (j['product_id'] as num?)?.toInt() ?? 0;
    // Mobile `/orders/stock` returns precomputed `available`, not raw qty fields.
    if (j.containsKey('available')) {
      final avail = _parseNum(j['available']);
      return StockRow(productId: productId, qty: avail, reservedQty: 0);
    }
    return StockRow(
      productId: productId,
      qty: _parseNum(j['qty']),
      reservedQty: _parseNum(j['reserved_qty']),
    );
  }
  double get available => (qty - reservedQty).clamp(0, double.infinity);
}

/// Mijoz moliyasi — `create-context` (`client_finance`).
class OrderClientFinance {
  final double creditLimit;
  final double accountBalance;
  final double openOrdersTotal;
  final double creditHeadroom;
  final bool agentConsignmentEnabled;
  final double? consignmentLimitAmount;
  final double? consignmentOutstanding;
  final bool allowOrderWithDebt;
  final bool allowConsignment;
  final bool allowConsignmentWithDebt;
  final bool hasAccountDebt;
  final bool hasConsignmentDebt;

  const OrderClientFinance({
    this.creditLimit = 0,
    this.accountBalance = 0,
    this.openOrdersTotal = 0,
    this.creditHeadroom = 0,
    this.agentConsignmentEnabled = false,
    this.consignmentLimitAmount,
    this.consignmentOutstanding,
    this.allowOrderWithDebt = true,
    this.allowConsignment = true,
    this.allowConsignmentWithDebt = true,
    this.hasAccountDebt = false,
    this.hasConsignmentDebt = false,
  });

  factory OrderClientFinance.fromJson(Map<String, dynamic>? j) {
    if (j == null) return const OrderClientFinance();
    return OrderClientFinance(
      creditLimit: _parseNum(j['credit_limit']),
      accountBalance: _parseNum(j['account_balance']),
      openOrdersTotal: _parseNum(j['open_orders_total']),
      creditHeadroom: _parseNum(j['credit_headroom']),
      agentConsignmentEnabled: j['agent_consignment_enabled'] == true,
      consignmentLimitAmount: j['consignment_limit_amount'] != null
          ? _parseNum(j['consignment_limit_amount'])
          : null,
      consignmentOutstanding: j['consignment_outstanding'] != null
          ? _parseNum(j['consignment_outstanding'])
          : null,
      allowOrderWithDebt: j['allow_order_with_debt'] != false,
      allowConsignment: j['allow_consignment'] != false,
      allowConsignmentWithDebt: j['allow_consignment_with_debt'] != false,
      hasAccountDebt: j['has_account_debt'] == true,
      hasConsignmentDebt: j['has_consignment_debt'] == true,
    );
  }

  double creditRemainingAfterOrder(double orderTotal) {
    return creditHeadroom - openOrdersTotal - orderTotal;
  }

  /// Joriy oyda konsignatsiyaga yana qancha summa (limit − ochiq qarz).
  double? get consignmentAvailable {
    final lim = consignmentLimitAmount;
    final out = consignmentOutstanding;
    if (lim == null || out == null) return null;
    return lim - out;
  }

  double? consignmentRemainingAfterOrder(double orderTotal) {
    final available = consignmentAvailable;
    if (available == null) return null;
    return available - orderTotal;
  }

  /// `true` — joriy savat summasi agent konsignatsiya limitidan oshib ketadi.
  bool consignmentLimitExceededBy(double orderTotal) {
    final rem = consignmentRemainingAfterOrder(orderTotal);
    return rem != null && rem < 0;
  }

  /// Limit oshganda ko‘rsatiladigan qisqa sabab (null — blok yo‘q).
  String? consignmentLimitBlockReason(double orderTotal) {
    if (!consignmentLimitExceededBy(orderTotal)) return null;
    final lim = consignmentLimitAmount;
    final out = consignmentOutstanding ?? 0;
    final avail = consignmentAvailable;
    final parts = <String>[];
    if (lim != null) parts.add('limit: ${_fmtLimitNum(lim)}');
    parts.add('qarz: ${_fmtLimitNum(out)}');
    if (avail != null) parts.add('mavjud: ${_fmtLimitNum(avail)}');
    parts.add('buyurtma: ${_fmtLimitNum(orderTotal)}');
    return 'Konsignatsiya limiti oshdi (${parts.join(', ')})';
  }

  static String _fmtLimitNum(double v) {
    final n = v.round();
    final s = n.abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return n < 0 ? '-$buf' : buf.toString();
  }

  /// Обычный (не консигнация) заказ — блокировка по долгу клиента.
  String? regularOrderBlockReason() {
    if (!allowOrderWithDebt && hasAccountDebt) {
      return 'Обычный заказ запрещён: у клиента есть долг. Снимите долг или обратитесь к администратору';
    }
    return null;
  }

  /// Консигнация — блокировка по настройкам клиента.
  String? consignmentBlockReason() {
    if (!allowConsignment) {
      return 'Консигнация для этого клиента запрещена администратором';
    }
    if (!allowConsignmentWithDebt && hasConsignmentDebt) {
      return 'Консигнация запрещена: у клиента есть долг по консигнации';
    }
    return null;
  }

  /// Можно ли включать переключатель «Консигнация».
  bool get consignmentToggleEnabled {
    if (!agentConsignmentEnabled) return false;
    return consignmentBlockReason() == null;
  }
}

class OrderCreateContext {
  final List<Map<String, dynamic>> clients;
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> warehouses;
  final List<String> priceTypes;
  /// DB kaliti → spravochnikdagi nom (dropdown label).
  final Map<String, String> priceTypeLabels;
  final OrderClientFinance? clientFinance;
  final int? defaultWarehouseId;

  OrderCreateContext({
    this.clients = const [],
    this.products = const [],
    this.warehouses = const [],
    this.priceTypes = const ['default'],
    this.priceTypeLabels = const {},
    this.clientFinance,
    this.defaultWarehouseId,
  });

  String priceTypeLabel(String key) => priceTypeLabels[key] ?? key;

  factory OrderCreateContext.fromJson(Map<String, dynamic> j) {
    List<Map<String, dynamic>> asMaps(dynamic v) {
      if (v is! List) return [];
      return v
          .map((e) => e is Map ? Map<String, dynamic>.from(e) : null)
          .whereType<Map<String, dynamic>>()
          .toList();
    }
    final pt = j['price_types'];
    final priceTypes = pt is List
        ? pt.map((e) => e.toString()).where((s) => s.isNotEmpty).toList()
        : <String>['retail'];
    final labels = priceTypeLabelsFromOptions(j['price_type_options'] as List?);
    final cf = j['client_finance'];
    return OrderCreateContext(
      clients: asMaps(j['clients']),
      products: asMaps(j['products']),
      warehouses: asMaps(j['warehouses']),
      priceTypes: priceTypes.isEmpty ? const ['retail'] : priceTypes,
      priceTypeLabels: labels,
      clientFinance: cf is Map
          ? OrderClientFinance.fromJson(Map<String, dynamic>.from(cf))
          : null,
      defaultWarehouseId: (j['default_warehouse_id'] as num?)?.toInt(),
    );
  }
}

double _parseNum(dynamic v) {
  if (v is num) return v.toDouble();
  final n = double.tryParse(v?.toString().replaceAll(',', '.') ?? '');
  return n ?? 0;
}

double unitPriceForProduct(Map<String, dynamic> product, String priceType) {
  final prices = product['prices'];
  if (prices is! List) return 0;
  final key = priceType.trim().toLowerCase();
  for (final p in prices) {
    if (p is! Map) continue;
    final pt = p['price_type']?.toString().trim().toLowerCase() ?? '';
    if (pt == key) return _parseNum(p['price']);
  }
  for (final p in prices) {
    if (p is Map && p['price'] != null) return _parseNum(p['price']);
  }
  return 0;
}
