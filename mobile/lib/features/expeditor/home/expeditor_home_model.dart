/// Pure helpers for TezYuk home mapping (null-safe).
class HomeOtmetkaChip {
  final String label;
  final String? subtitle;
  const HomeOtmetkaChip(this.label, {this.subtitle});
}

class HomeNextStop {
  final String clientName;
  final double? distanceKm;
  final int? seq;
  final double? orderSum;
  final int? itemCount;
  final String? phone;
  final String? mapsUrl;
  const HomeNextStop({
    required this.clientName,
    this.distanceKm,
    this.seq,
    this.orderSum,
    this.itemCount,
    this.phone,
    this.mapsUrl,
  });
}

class HomeDailyPlan {
  final double pct;
  final int visited;
  final int total;
  final int remaining;
  const HomeDailyPlan({
    required this.pct,
    required this.visited,
    required this.total,
    required this.remaining,
  });
}

class HomePaymentsPending {
  final int count;
  final double sum;
  const HomePaymentsPending({required this.count, required this.sum});
}

class HomeShipmentLine {
  final String key;
  final String label;
  final double sum;
  final num qty;
  const HomeShipmentLine({
    required this.key,
    required this.label,
    required this.sum,
    required this.qty,
  });
}

HomeOtmetkaChip? mapHomeOtmetkaChip(Map<String, dynamic>? raw) {
  if (raw == null || raw.isEmpty) return null;
  final status =
      (raw['status'] ?? raw['punch_type'] ?? '').toString().toLowerCase();
  final punched = raw['punched_at']?.toString() ?? raw['at']?.toString();
  String time = '';
  if (punched != null && punched.isNotEmpty) {
    final dt = DateTime.tryParse(punched)?.toLocal();
    if (dt != null) {
      time =
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
  }
  final isIn = status == 'in' || status == 'keldi' || status == 'arrival';
  final verb = isIn ? 'Keldi' : (status.isEmpty ? 'Otmetka' : status);
  final label = time.isEmpty ? 'Otmetka: $verb' : 'Otmetka: $verb ($time)';
  final faceOk = raw['face_ok'] == true ||
      raw['face_verified'] == true ||
      (raw['method']?.toString().toLowerCase().contains('face') ?? false);
  final subtitle = faceOk
      ? 'Face ID tasdiqlangan • Tabelni ochish'
      : 'Tabelni ochish';
  return HomeOtmetkaChip(label, subtitle: subtitle);
}

HomeNextStop? mapNextStop(Map<String, dynamic>? raw) {
  if (raw == null || raw.isEmpty) return null;
  final name = (raw['client_name'] ?? raw['name'] ?? '').toString().trim();
  if (name.isEmpty) return null;
  final dist = (raw['distance_km'] as num?)?.toDouble();
  final seq =
      (raw['seq'] as num?)?.toInt() ?? (raw['queue_no'] as num?)?.toInt();
  final orderSum = (raw['order_sum'] as num?)?.toDouble() ??
      (raw['sum'] as num?)?.toDouble();
  final itemCount = (raw['item_count'] as num?)?.toInt() ??
      (raw['products_count'] as num?)?.toInt() ??
      (raw['qty'] as num?)?.toInt();
  final phone = raw['phone']?.toString() ?? raw['client_phone']?.toString();
  final mapsUrl = raw['maps_url']?.toString() ?? raw['nav_url']?.toString();
  return HomeNextStop(
    clientName: name,
    distanceKm: dist,
    seq: seq,
    orderSum: orderSum,
    itemCount: itemCount,
    phone: phone,
    mapsUrl: mapsUrl,
  );
}

HomeDailyPlan mapDailyPlan(Map<String, dynamic> daily) {
  final perf = (daily['performance_pct'] as num?)?.toDouble() ?? 0;
  final visited = daily['visited'] as int? ?? 0;
  final total = daily['visit_total'] as int? ?? 0;
  final remaining = daily['remaining'] as int? ??
      ((total > visited) ? total - visited : 0);
  return HomeDailyPlan(
    pct: perf,
    visited: visited,
    total: total,
    remaining: remaining,
  );
}

HomePaymentsPending mapPaymentsPending(Map<String, dynamic> payments) {
  final count = payments['pending_count'] as int? ??
      payments['synced_count'] as int? ??
      0;
  final sum = (payments['pending_sum'] as num?)?.toDouble() ??
      (payments['synced_sum'] as num?)?.toDouble() ??
      0;
  return HomePaymentsPending(count: count, sum: sum);
}

double? mapCollectedMoney(Map<String, dynamic> dash) {
  final payments = dash['payments'];
  if (payments is Map) {
    final m = Map<String, dynamic>.from(payments);
    final v = m['collected_sum'] ?? m['cash_collected'] ?? m['total_sum'];
    if (v is num) return v.toDouble();
  }
  final daily = dash['daily_report'];
  if (daily is Map) {
    final m = Map<String, dynamic>.from(daily);
    final v = m['collected_sum'] ?? m['cash_sum'] ?? m['payments_sum'];
    if (v is num) return v.toDouble();
  }
  return null;
}

List<HomeShipmentLine> mapShipmentLines(List<Map> rows) {
  const labels = <String, String>{
    'delivered': 'Yetkazildi',
    'return': 'Qaytarish',
    'shelf_return': 'Polkadan qaytarish',
    'exchange_return': 'Polkadan qaytarish',
    'onboard': 'Bortda qoldi',
    'remaining': 'Bortda qoldi',
    'stock': 'Bortda qoldi',
  };
  return rows.map((r) {
    final m = Map<String, dynamic>.from(r);
    final key = (m['type'] ?? m['key'] ?? '').toString();
    final label = (m['label']?.toString().trim().isNotEmpty == true)
        ? m['label'].toString()
        : (labels[key] ?? key);
    return HomeShipmentLine(
      key: key,
      label: label,
      sum: ((m['sum'] as num?) ?? 0).toDouble(),
      qty: m['qty'] as num? ?? 0,
    );
  }).toList();
}
