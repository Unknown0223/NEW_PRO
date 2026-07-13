import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  factory StockRow.fromJson(Map<String, dynamic> j) => StockRow(
        productId: (j['product_id'] as num?)?.toInt() ?? 0,
        qty: _parseNum(j['qty']),
        reservedQty: _parseNum(j['reserved_qty']),
      );
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

  const OrderClientFinance({
    this.creditLimit = 0,
    this.accountBalance = 0,
    this.openOrdersTotal = 0,
    this.creditHeadroom = 0,
    this.agentConsignmentEnabled = false,
    this.consignmentLimitAmount,
    this.consignmentOutstanding,
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
    );
  }

  double creditRemainingAfterOrder(double orderTotal) {
    return creditHeadroom - openOrdersTotal - orderTotal;
  }

  double? consignmentRemainingAfterOrder(double orderTotal) {
    final lim = consignmentLimitAmount;
    final out = consignmentOutstanding;
    if (lim == null || out == null) return null;
    return lim - out - orderTotal;
  }
}

class OrderCreateContext {
  final List<Map<String, dynamic>> clients;
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> warehouses;
  final List<String> priceTypes;
  final OrderClientFinance? clientFinance;

  OrderCreateContext({
    this.clients = const [],
    this.products = const [],
    this.warehouses = const [],
    this.priceTypes = const ['default'],
    this.clientFinance,
  });

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
    final cf = j['client_finance'];
    return OrderCreateContext(
      clients: asMaps(j['clients']),
      products: asMaps(j['products']),
      warehouses: asMaps(j['warehouses']),
      priceTypes: priceTypes.isEmpty ? const ['retail'] : priceTypes,
      clientFinance: cf is Map
          ? OrderClientFinance.fromJson(Map<String, dynamic>.from(cf))
          : null,
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
