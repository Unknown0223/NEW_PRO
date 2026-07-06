import 'dart:convert';

/// SQLite uchun tayyor sinxron payload (isolate ichida parse).
class ParsedSyncPayload {
  final String syncAt;
  final bool clientsReplaceAll;
  final List<Map<String, dynamic>> clients;
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> prices;
  final List<Map<String, dynamic>> orders;

  const ParsedSyncPayload({
    required this.syncAt,
    required this.clientsReplaceAll,
    this.clients = const [],
    this.products = const [],
    this.prices = const [],
    this.orders = const [],
  });
}

ParsedSyncPayload parseSyncPayload(String raw) {
  final j = jsonDecode(raw) as Map<String, dynamic>;
  return ParsedSyncPayload(
    syncAt: j['sync_at']?.toString() ?? '',
    clientsReplaceAll: j['clients_replace_all'] == true,
    clients: _parseClients(j['clients']),
    products: _parseProducts(j['products']),
    prices: _parsePrices(j['prices']),
    orders: _parseOrders(j['orders']),
  );
}

List<Map<String, dynamic>> _parseClients(dynamic raw) {
  if (raw is! List) return const [];
  final out = <Map<String, dynamic>>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final j = Map<String, dynamic>.from(item);
    final id = _asInt(j['id']);
    if (id == null) continue;
    final weekdays = _parseWeekdays(j['visit_weekdays']);
    final row = <String, dynamic>{
      'id': id,
      'name': j['name']?.toString() ?? '',
      'address': j['address'],
      'phone': j['phone'],
      'client_code': j['client_code'],
      'category': j['category'],
      'is_active': j['is_active'] == false ? 0 : 1,
      'latitude': _asDouble(j['latitude']),
      'longitude': _asDouble(j['longitude']),
      if (weekdays != null) 'visit_weekdays': jsonEncode(weekdays),
      'balance': _asDouble(j['balance']),
      if (j['credit_limit'] != null) 'credit_limit': _asDouble(j['credit_limit']),
      if (_nonEmpty(j['inn'])) 'inn': j['inn'],
      if (_nonEmpty(j['legal_name'])) 'legal_name': j['legal_name'],
      if (_nonEmpty(j['sales_channel'])) 'sales_channel': j['sales_channel'],
      if (_nonEmpty(j['client_type_code'])) 'client_type_code': j['client_type_code'],
      if (_nonEmpty(j['region'])) 'region': j['region'],
      if (_nonEmpty(j['zone'])) 'zone': j['zone'],
      if (_nonEmpty(j['city'])) 'city': j['city'],
      if (_nonEmpty(j['bank_name'])) 'bank_name': j['bank_name'],
      if (_nonEmpty(j['bank_mfo'])) 'bank_mfo': j['bank_mfo'],
      if (_nonEmpty(j['oked'])) 'oked': j['oked'],
      if (_nonEmpty(j['client_pinfl'])) 'client_pinfl': j['client_pinfl'],
      if (_nonEmpty(j['contract_number'])) 'contract_number': j['contract_number'],
      if (_nonEmpty(j['notes'])) 'notes': j['notes'],
      if (_nonEmpty(j['visit_date'])) 'visit_date': j['visit_date'],
    };
    out.add(row);
  }
  return out;
}

List<Map<String, dynamic>> _parseProducts(dynamic raw) {
  if (raw is! List) return const [];
  final out = <Map<String, dynamic>>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final j = Map<String, dynamic>.from(item);
    final id = _asInt(j['id']);
    if (id == null) continue;
    out.add({
      'id': id,
      'sku': j['sku'],
      'name': j['name']?.toString() ?? '',
      'unit': j['unit'],
      'barcode': j['barcode'],
    });
  }
  return out;
}

List<Map<String, dynamic>> _parsePrices(dynamic raw) {
  if (raw is! List) return const [];
  final out = <Map<String, dynamic>>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final j = Map<String, dynamic>.from(item);
    final productId = _asInt(j['product_id']);
    final price = _asDouble(j['price']);
    if (productId == null || price == null) continue;
    out.add({
      'product_id': productId,
      'price_type': j['price_type']?.toString() ?? 'default',
      'price': price,
    });
  }
  return out;
}

List<Map<String, dynamic>> _parseOrders(dynamic raw) {
  if (raw is! List) return const [];
  final out = <Map<String, dynamic>>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final j = Map<String, dynamic>.from(item);
    final id = _asInt(j['id']);
    final clientId = _asInt(j['client_id']);
    if (id == null || clientId == null) continue;
    final createdAt = j['created_at']?.toString();
    out.add({
      'id': id,
      'number': j['number'],
      'client_id': clientId,
      'status': j['status']?.toString() ?? 'new',
      'total': _asDouble(j['total_sum']) ?? _asDouble(j['total']) ?? 0,
      if (createdAt != null && createdAt.isNotEmpty) 'created_at': createdAt,
    });
  }
  return out;
}

List<int>? _parseWeekdays(dynamic raw) {
  if (raw is! List || raw.isEmpty) return null;
  final out = <int>[];
  for (final x in raw) {
    final n = x is num ? x.toInt() : int.tryParse(x.toString());
    if (n != null && n >= 1 && n <= 7 && !out.contains(n)) out.add(n);
  }
  if (out.isEmpty) return null;
  out.sort();
  return out;
}

int? _asInt(dynamic v) {
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '');
}

double? _asDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString().replaceAll(',', '.'));
}

bool _nonEmpty(dynamic v) => v != null && v.toString().trim().isNotEmpty;
