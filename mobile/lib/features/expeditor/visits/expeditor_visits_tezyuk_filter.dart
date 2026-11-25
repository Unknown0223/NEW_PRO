/// Tashriflar ro'yxati — TezYuk chip filtrlari (mavjud API maydonlari bo'yicha).
const tezyukVisitChipKeys = [
  'all',
  'pending',
  'completed',
  'debt',
  'return',
];

const tezyukVisitChipLabels = [
  'Hammasi',
  'Kutilmoqda',
  'Bajarildi',
  'Qarzli',
  'Qaytarish',
];

List<Map<String, dynamic>> mergeTezyukVisitRows(
  List<Map<String, dynamic>> active,
  List<Map<String, dynamic>> completed,
) {
  final byOrder = <int, Map<String, dynamic>>{};
  void put(Map<String, dynamic> r) {
    final id = r['order_id'] as int? ?? r['client_id'] as int? ?? 0;
    if (id == 0) return;
    byOrder[id] = r;
  }

  for (final r in active) {
    put(r);
  }
  for (final r in completed) {
    put(r);
  }
  return byOrder.values.toList();
}

bool _visitPending(String status) {
  final s = status.trim().toLowerCase();
  return s == 'picking' || s == 'delivering';
}

List<Map<String, dynamic>> filterTezyukVisitRows(
  List<Map<String, dynamic>> rows,
  String filterKey,
) {
  final key = filterKey.trim().toLowerCase();
  if (key.isEmpty || key == 'all') return List.of(rows);

  return rows.where((r) {
    final status = (r['status'] ?? '').toString();
    final balance = (r['balance'] as num?)?.toDouble() ?? 0;
    switch (key) {
      case 'pending':
        return _visitPending(status);
      case 'completed':
        return status.toLowerCase() == 'delivered';
      case 'debt':
        return balance < 0;
      case 'return':
        return status.toLowerCase() == 'returned';
      default:
        return true;
    }
  }).toList();
}