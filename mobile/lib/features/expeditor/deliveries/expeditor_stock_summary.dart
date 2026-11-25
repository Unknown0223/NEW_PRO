class StockTriad {
  final num loaded;
  final num delivered;
  final num remaining;
  const StockTriad({
    required this.loaded,
    required this.delivered,
    required this.remaining,
  });
}

num _n(dynamic v) => (v as num?) ?? 0;

/// Prefer API field names from vehicle-stock (`loaded_qty` / `delivered_qty`),
/// then legacy aliases used in older payloads / unit fixtures.
StockTriad summarizeStock(Iterable<Map<String, dynamic>> rows) {
  num loaded = 0;
  num delivered = 0;
  for (final r in rows) {
    loaded += _n(r['loaded_qty'] ?? r['qty_loaded'] ?? r['loaded'] ?? r['qty']);
    delivered += _n(r['delivered_qty'] ?? r['qty_delivered'] ?? r['delivered']);
  }
  final remaining = loaded - delivered;
  return StockTriad(
    loaded: loaded,
    delivered: delivered,
    remaining: remaining < 0 ? 0 : remaining,
  );
}

/// Dashboard `totals` object from vehicle-stock API (authoritative).
StockTriad? stockTriadFromTotals(Map<String, dynamic>? totals) {
  if (totals == null || totals.isEmpty) return null;
  if (!totals.containsKey('loaded_qty') &&
      !totals.containsKey('delivered_qty') &&
      !totals.containsKey('remaining_qty')) {
    return null;
  }
  final loaded = _n(totals['loaded_qty']);
  final delivered = _n(totals['delivered_qty']);
  final remaining = totals.containsKey('remaining_qty')
      ? _n(totals['remaining_qty'])
      : (loaded - delivered < 0 ? 0 : loaded - delivered);
  return StockTriad(loaded: loaded, delivered: delivered, remaining: remaining);
}
