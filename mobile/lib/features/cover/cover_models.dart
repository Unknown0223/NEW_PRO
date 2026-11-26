/// Pure helpers for cover list/banner (SalesDoc agent↔SVR).
String coverStatusLabel(String? status) {
  switch (status) {
    case 'kutilmoqda':
      return 'Kutilmoqda';
    case 'faol':
      return 'Faol';
    case 'tugallandi':
      return 'Tugallandi';
    case 'rad':
      return 'Rad etildi';
    case 'bekor':
      return 'Bekor';
    default:
      return status ?? '—';
  }
}

bool coverIsActive(Map<String, dynamic>? row) =>
    row != null && row['status']?.toString() == 'faol';

/// Picker-labels: faqat nom (id/kod yorliqqa qo‘shilmaydi).
String coverPersonLabel(Map<String, dynamic>? row, String nameKey) {
  final name = row?[nameKey]?.toString().trim() ?? '';
  return name.isEmpty ? '—' : name;
}

String coverPairSubtitle(Map<String, dynamic>? row) {
  if (row == null) return 'Agent ↔ SVR';
  final agent = coverPersonLabel(row, 'agent_name');
  final svr = coverPersonLabel(row, 'svr_name');
  if (agent == '—' && svr == '—') return 'Agent ↔ SVR';
  return '$agent ↔ $svr';
}
