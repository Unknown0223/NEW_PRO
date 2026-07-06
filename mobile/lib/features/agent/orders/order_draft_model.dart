import 'dart:convert';

import 'order_create_models.dart';

/// Buyurtma chernovigi — 1 soat saqlanadi, keyin avtomatik o'chiriladi.
class OrderDraft {
  static const ttl = Duration(hours: 1);

  final int clientId;
  final int warehouseId;
  final String warehouseName;
  final String priceType;
  final String comment;
  final bool isConsignment;
  final String consignmentDueDate;
  final Map<int, double> quantities;
  final double totalQty;
  final double totalSum;
  final double totalVolume;
  final DateTime savedAt;
  final DateTime expiresAt;

  const OrderDraft({
    required this.clientId,
    required this.warehouseId,
    this.warehouseName = '',
    required this.priceType,
    this.comment = '',
    this.isConsignment = false,
    this.consignmentDueDate = '',
    required this.quantities,
    required this.totalQty,
    required this.totalSum,
    this.totalVolume = 0,
    required this.savedAt,
    required this.expiresAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  Duration get remaining => expiresAt.difference(DateTime.now());

  bool get hasItems => quantities.values.any((q) => q > 0);

  Map<String, dynamic> toDbRow() {
    final qtyJson = <String, dynamic>{};
    for (final e in quantities.entries) {
      if (e.value > 0) qtyJson['${e.key}'] = e.value;
    }
    return {
      'client_id': clientId,
      'warehouse_id': warehouseId,
      'warehouse_name': warehouseName,
      'price_type': priceType,
      'comment': comment,
      'is_consignment': isConsignment ? 1 : 0,
      'consignment_due_date': consignmentDueDate,
      'quantities': jsonEncode(qtyJson),
      'total_qty': totalQty,
      'total_sum': totalSum,
      'total_volume': totalVolume,
      'saved_at': savedAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
    };
  }

  static OrderDraft? fromDbRow(Map<String, dynamic> row) {
    final clientId = (row['client_id'] as num?)?.toInt();
    final warehouseId = (row['warehouse_id'] as num?)?.toInt();
    if (clientId == null || warehouseId == null) return null;

    final quantities = <int, double>{};
    final raw = row['quantities']?.toString() ?? '{}';
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        for (final e in decoded.entries) {
          final id = int.tryParse(e.key.toString());
          final q = parseOrderNum(e.value);
          if (id != null && q > 0) quantities[id] = q;
        }
      }
    } catch (_) {}

    final savedAt = DateTime.tryParse(row['saved_at']?.toString() ?? '') ?? DateTime.now();
    final expiresAt = DateTime.tryParse(row['expires_at']?.toString() ?? '') ??
        savedAt.add(ttl);

    return OrderDraft(
      clientId: clientId,
      warehouseId: warehouseId,
      warehouseName: row['warehouse_name']?.toString() ?? '',
      priceType: row['price_type']?.toString() ?? '',
      comment: row['comment']?.toString() ?? '',
      isConsignment: (row['is_consignment'] as int? ?? 0) == 1,
      consignmentDueDate: row['consignment_due_date']?.toString() ?? '',
      quantities: quantities,
      totalQty: parseOrderNum(row['total_qty']),
      totalSum: parseOrderNum(row['total_sum']),
      totalVolume: parseOrderNum(row['total_volume']),
      savedAt: savedAt,
      expiresAt: expiresAt,
    );
  }
}

String formatDraftSavedAt(DateTime dt) {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  final local = dt.toLocal();
  final m = months[local.month - 1];
  final h = local.hour.toString().padLeft(2, '0');
  final min = local.minute.toString().padLeft(2, '0');
  return '${local.day} $m. $h:$min';
}

String formatDraftCountdown(Duration remaining) {
  if (remaining.isNegative) return '00:00';
  final totalSec = remaining.inSeconds;
  final h = totalSec ~/ 3600;
  final m = (totalSec % 3600) ~/ 60;
  final s = totalSec % 60;
  if (h > 0) {
    return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }
  return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
}
