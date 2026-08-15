import 'dart:convert';

import '../../../core/api/orders_api.dart';

/// Zakaz yakunlangan, lekin serverga yuborilish vaqti kutilmoqda.
class HeldOrder {
  final int id;
  final int clientId;
  final String clientName;
  final int warehouseId;
  final String priceType;
  final String comment;
  final List<OrderLineInput> items;
  final bool applyBonus;
  final bool applyDiscount;
  final List<BonusGiftOverrideInput> giftOverrides;
  final List<BonusGiftLineInput> giftLines;
  final bool isConsignment;
  final String? consignmentDueDate;
  final String? shipmentDate;
  final double estimatedTotal;
  final int itemCount;
  final DateTime createdAt;
  final DateTime submitAt;
  final String status; // pending | cancelled | submitted

  const HeldOrder({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.warehouseId,
    required this.priceType,
    required this.comment,
    required this.items,
    required this.applyBonus,
    required this.applyDiscount,
    this.giftOverrides = const [],
    this.giftLines = const [],
    this.isConsignment = false,
    this.consignmentDueDate,
    this.shipmentDate,
    this.estimatedTotal = 0,
    this.itemCount = 0,
    required this.createdAt,
    required this.submitAt,
    this.status = 'pending',
  });

  bool get isPending => status == 'pending';

  Duration remaining([DateTime? now]) {
    final n = now ?? DateTime.now();
    final diff = submitAt.difference(n);
    return diff.isNegative ? Duration.zero : diff;
  }

  factory HeldOrder.fromMap(Map<String, dynamic> m) {
    final itemsRaw = jsonDecode(m['items_json'] as String? ?? '[]') as List;
    final items = itemsRaw
        .whereType<Map>()
        .map((e) => OrderLineInput(
              productId: (e['product_id'] as num).toInt(),
              qty: (e['qty'] as num).toDouble(),
            ))
        .toList();

    List<BonusGiftOverrideInput> overrides = const [];
    final ovRaw = m['gift_overrides_json'] as String?;
    if (ovRaw != null && ovRaw.isNotEmpty) {
      final list = jsonDecode(ovRaw) as List;
      overrides = list
          .whereType<Map>()
          .map((e) => BonusGiftOverrideInput(
                bonusRuleId: (e['bonus_rule_id'] as num).toInt(),
                bonusProductId: (e['bonus_product_id'] as num).toInt(),
              ))
          .toList();
    }

    List<BonusGiftLineInput> giftLines = const [];
    final glRaw = m['gift_lines_json'] as String?;
    if (glRaw != null && glRaw.isNotEmpty) {
      final list = jsonDecode(glRaw) as List;
      giftLines = list
          .whereType<Map>()
          .map((e) => BonusGiftLineInput(
                bonusRuleId: (e['bonus_rule_id'] as num).toInt(),
                productId: (e['product_id'] as num).toInt(),
                qty: (e['qty'] as num).toInt(),
              ))
          .toList();
    }

    return HeldOrder(
      id: (m['id'] as num).toInt(),
      clientId: (m['client_id'] as num).toInt(),
      clientName: m['client_name']?.toString() ?? '',
      warehouseId: (m['warehouse_id'] as num).toInt(),
      priceType: m['price_type']?.toString() ?? 'default',
      comment: m['comment']?.toString() ?? '',
      items: items,
      applyBonus: (m['apply_bonus'] as int? ?? 1) == 1,
      applyDiscount: (m['apply_discount'] as int? ?? 1) == 1,
      giftOverrides: overrides,
      giftLines: giftLines,
      isConsignment: (m['is_consignment'] as int? ?? 0) == 1,
      consignmentDueDate: m['consignment_due_date']?.toString(),
      shipmentDate: m['shipment_date']?.toString(),
      estimatedTotal: (m['estimated_total'] as num?)?.toDouble() ?? 0,
      itemCount: (m['item_count'] as num?)?.toInt() ?? items.fold<int>(0, (s, i) => s + i.qty.round()),
      createdAt: DateTime.tryParse(m['created_at']?.toString() ?? '') ?? DateTime.now(),
      submitAt: DateTime.tryParse(m['submit_at']?.toString() ?? '') ?? DateTime.now(),
      status: m['status']?.toString() ?? 'pending',
    );
  }

  Map<String, dynamic> toInsertMap() {
    return {
      'client_id': clientId,
      'client_name': clientName,
      'warehouse_id': warehouseId,
      'price_type': priceType,
      'comment': comment,
      'items_json': jsonEncode(items.map((i) => {'product_id': i.productId, 'qty': i.qty}).toList()),
      'apply_bonus': applyBonus ? 1 : 0,
      'apply_discount': applyDiscount ? 1 : 0,
      'gift_overrides_json': giftOverrides.isEmpty
          ? null
          : jsonEncode(giftOverrides
              .map((g) => {'bonus_rule_id': g.bonusRuleId, 'bonus_product_id': g.bonusProductId})
              .toList()),
      'gift_lines_json': giftLines.isEmpty
          ? null
          : jsonEncode(giftLines
              .map((g) => {'bonus_rule_id': g.bonusRuleId, 'product_id': g.productId, 'qty': g.qty})
              .toList()),
      'is_consignment': isConsignment ? 1 : 0,
      'consignment_due_date': consignmentDueDate,
      'shipment_date': shipmentDate,
      'estimated_total': estimatedTotal,
      'item_count': itemCount,
      'created_at': createdAt.toIso8601String(),
      'submit_at': submitAt.toIso8601String(),
      'status': status,
    };
  }
}

String formatHeldCountdown(Duration d) {
  final total = d.inSeconds;
  final m = total ~/ 60;
  final s = total % 60;
  return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
}
