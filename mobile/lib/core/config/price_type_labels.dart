/// «Тип цены» DB kaliti → ko‘rinadigan nom.
Map<String, String> priceTypeLabelsFromOptions(Iterable<dynamic>? opts) {
  final out = <String, String>{};
  if (opts == null) return out;
  for (final e in opts) {
    if (e is! Map) continue;
    final id = e['id']?.toString().trim() ?? '';
    if (id.isEmpty) continue;
    final label = (e['label'] ?? e['name'])?.toString().trim() ?? '';
    if (label.isEmpty) continue;
    out[id] = label;
    final code = e['code']?.toString().trim();
    if (code != null && code.isNotEmpty) out[code] = label;
  }
  return out;
}

String priceTypeDisplayLabel(String key, Map<String, String>? labels) {
  final k = key.trim();
  if (k.isEmpty) return '';
  if (labels == null || labels.isEmpty) return k;
  final fromMap = labels[k];
  if (fromMap != null && fromMap.trim().isNotEmpty) return fromMap.trim();
  final lower = k.toLowerCase();
  for (final e in labels.entries) {
    if (e.key.trim().toLowerCase() == lower && e.value.trim().isNotEmpty) {
      return e.value.trim();
    }
  }
  return k;
}
