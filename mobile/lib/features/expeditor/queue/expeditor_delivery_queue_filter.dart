/// Yetkazish navbati tab filter (TezYuk).
List<Map<String, dynamic>> filterQueueRows(
  List<Map<String, dynamic>> rows,
  String tab,
) {
  final t = tab.trim().toLowerCase();
  if (t.isEmpty || t == 'all' || t == 'hammasi') return List.of(rows);

  bool pending(String s) =>
      s == 'picking' ||
      s == 'confirmed' ||
      s == 'delivering' ||
      s == 'shipping' ||
      s == 'packed' ||
      s == 'assigned' ||
      s == 'new' ||
      s == 'accepted';

  bool delivered(String s) => s == 'delivered' || s == 'completed';

  bool ret(String s) =>
      s == 'returned' || s == 'return' || s == 'partial_return';

  return rows.where((r) {
    final s = (r['status'] ?? '').toString().toLowerCase();
    switch (t) {
      case 'pending':
      case 'kutilmoqda':
        return pending(s);
      case 'delivered':
      case 'yetkazildi':
        return delivered(s);
      case 'return':
      case 'qaytarish':
        return ret(s);
      default:
        return true;
    }
  }).toList();
}
