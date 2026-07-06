/// Tenant hudud daraxti — zona → viloyat (oblast) → shahar (kaskad).
class TerritoryNode {
  final String name;
  final bool active;
  final List<TerritoryNode> children;

  const TerritoryNode({
    required this.name,
    this.active = true,
    this.children = const [],
  });

  factory TerritoryNode.fromJson(Map<String, dynamic> j) {
    final kids = (j['children'] as List?)
            ?.map((e) => TerritoryNode.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList() ??
        const <TerritoryNode>[];
    return TerritoryNode(
      name: (j['name'] ?? '').toString().trim(),
      active: j['active'] != false,
      children: kids,
    );
  }
}

List<TerritoryNode> parseTerritoryNodes(dynamic raw) {
  if (raw is! List) return const [];
  final out = <TerritoryNode>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final n = TerritoryNode.fromJson(Map<String, dynamic>.from(item));
    if (n.name.isNotEmpty) out.add(n);
  }
  return out;
}

class TerritoryCascadeIndex {
  final List<String> zones;
  final Map<String, List<String>> regionsByZone;
  /// Kalit: `zona|||viloyat`
  final Map<String, List<String>> citiesByZoneRegion;
  final Map<String, String> zoneByRegion;

  const TerritoryCascadeIndex({
    this.zones = const [],
    this.regionsByZone = const {},
    this.citiesByZoneRegion = const {},
    this.zoneByRegion = const {},
  });

  bool get hasCascade => zones.isNotEmpty && regionsByZone.isNotEmpty;
}

/// Lalaku standart zona → viloyat (backend `shared/territory-lalaku-seed.ts` bilan bir xil).
const _lalakuZones = ['FV', 'SOUTH-WEST', 'TASH OBL', 'TASHKENT'];

const _lalakuRegionZone = <String, String>{
  'XORAZM VILOYATI': 'SOUTH-WEST',
  'TOSHKENT VILOYATI': 'TASH OBL',
  'TOSHKENT SHAHAR': 'TASHKENT',
  'SURXANDARYO VILOYATI': 'SOUTH-WEST',
  'SIRDARYO VILOYATI': 'SOUTH-WEST',
  'SAMARQAND VILOYATI': 'SOUTH-WEST',
  'QORAQALPOQISTON': 'SOUTH-WEST',
  'QOQON': 'FV',
  'QASHQADARYO VILOYATI': 'SOUTH-WEST',
  'NAVOIY VILOYATI': 'SOUTH-WEST',
  'NAMANGAN VILOYATI': 'FV',
  'JIZZAX VILOYATI': 'SOUTH-WEST',
  'FARGONA VILOYATI': 'FV',
  'BUXORO VILOYATI': 'SOUTH-WEST',
  'ANDIJON VILOYATI': 'FV',
};

TerritoryCascadeIndex lalakuDefaultCascadeIndex() {
  final regionsByZone = <String, List<String>>{};
  final zoneByRegion = <String, String>{};
  for (final e in _lalakuRegionZone.entries) {
    regionsByZone.putIfAbsent(e.value, () => <String>[]).add(e.key);
    zoneByRegion[e.key] = e.value;
  }
  for (final list in regionsByZone.values) {
    list.sort();
  }
  return TerritoryCascadeIndex(
    zones: List<String>.from(_lalakuZones),
    regionsByZone: regionsByZone,
    zoneByRegion: zoneByRegion,
  );
}

TerritoryCascadeIndex buildTerritoryCascadeIndex(List<TerritoryNode> nodes) {
  final zones = <String>{};
  final regionsByZone = <String, Set<String>>{};
  final citiesByZoneRegion = <String, Set<String>>{};
  final zoneByRegion = <String, String>{};

  void walk(List<TerritoryNode> list, int depth, List<String> path) {
    for (final n in list) {
      if (!n.active || n.name.isEmpty) continue;
      final next = [...path, n.name];
      if (depth == 0) {
        zones.add(n.name);
        regionsByZone.putIfAbsent(n.name, () => <String>{});
      } else if (depth == 1) {
        final zone = next[0];
        regionsByZone.putIfAbsent(zone, () => <String>{}).add(n.name);
        zoneByRegion[n.name] = zone;
      } else if (depth == 2) {
        final zone = next[0];
        final region = next[1];
        final key = '$zone|||$region';
        citiesByZoneRegion.putIfAbsent(key, () => <String>{}).add(n.name);
      }
      if (n.children.isNotEmpty) walk(n.children, depth + 1, next);
    }
  }

  walk(nodes, 0, const []);
  return TerritoryCascadeIndex(
    zones: zones.toList()..sort(),
    regionsByZone: {
      for (final e in regionsByZone.entries)
        e.key: (e.value.toList()..sort()),
    },
    citiesByZoneRegion: {
      for (final e in citiesByZoneRegion.entries)
        e.key: (e.value.toList()..sort()),
    },
    zoneByRegion: zoneByRegion,
  );
}

TerritoryCascadeIndex parseTerritoryCascadeJson(Map<String, dynamic>? j) {
  if (j == null) return const TerritoryCascadeIndex();
  List<String> strList(dynamic raw) => (raw as List?)
          ?.map((e) => e.toString().trim())
          .where((s) => s.isNotEmpty)
          .toList() ??
      const [];

  final regionsByZone = <String, List<String>>{};
  final rawRbZ = j['regions_by_zone'];
  if (rawRbZ is Map) {
    for (final e in rawRbZ.entries) {
      final key = e.key.toString().trim();
      if (key.isEmpty) continue;
      regionsByZone[key] = strList(e.value);
    }
  }

  final citiesByZoneRegion = <String, List<String>>{};
  final rawCbZR = j['cities_by_zone_region'];
  if (rawCbZR is Map) {
    for (final e in rawCbZR.entries) {
      final key = e.key.toString().trim();
      if (key.isEmpty) continue;
      citiesByZoneRegion[key] = strList(e.value);
    }
  }

  final zoneByRegion = <String, String>{};
  final rawZbr = j['zone_by_region'];
  if (rawZbr is Map) {
    for (final e in rawZbr.entries) {
      final region = e.key.toString().trim();
      final zone = e.value?.toString().trim() ?? '';
      if (region.isNotEmpty && zone.isNotEmpty) zoneByRegion[region] = zone;
    }
  }

  return TerritoryCascadeIndex(
    zones: strList(j['zones']),
    regionsByZone: regionsByZone,
    citiesByZoneRegion: citiesByZoneRegion,
    zoneByRegion: zoneByRegion,
  );
}

TerritoryCascadeIndex resolveTerritoryCascade({
  Map<String, dynamic>? cascadeJson,
  List<TerritoryNode> nodes = const [],
}) {
  final fromJson = parseTerritoryCascadeJson(cascadeJson);
  if (fromJson.hasCascade) return fromJson;

  final fromNodes = buildTerritoryCascadeIndex(nodes);
  if (fromNodes.hasCascade) return fromNodes;

  return lalakuDefaultCascadeIndex();
}

List<String> mergeDistinct(List<String> base, List<String> extra) {
  final s = <String>{};
  for (final x in [...base, ...extra]) {
    final t = x.trim();
    if (t.isNotEmpty) s.add(t);
  }
  final out = s.toList()..sort();
  return out;
}

List<String> cascadeZones(TerritoryCascadeIndex idx) {
  if (idx.zones.isNotEmpty) return idx.zones;
  return List<String>.from(_lalakuZones);
}

List<String> cascadeRegions(TerritoryCascadeIndex idx, {required String? zone}) {
  final z = zone?.trim() ?? '';
  if (z.isEmpty) return const [];
  return List<String>.from(idx.regionsByZone[z] ?? const []);
}

const _cityPrefixTerritory = <String, (String, String)>{
  'TV_': ('TASH OBL', 'TOSHKENT VILOYATI'),
  'TSH_': ('TASHKENT', 'TOSHKENT SHAHAR'),
  'SR_': ('SOUTH-WEST', 'SAMARQAND VILOYATI'),
};

const _cityExactTerritory = <String, (String, String)>{
  'FARGONA_VIL': ('FV', 'FARGONA VILOYATI'),
};

(String, String)? inferCityTerritoryFromCode(String city) {
  final raw = city.trim();
  if (raw.isEmpty) return null;
  final exact = _cityExactTerritory[raw.toUpperCase()];
  if (exact != null) return exact;
  final upper = raw.toUpperCase();
  for (final e in _cityPrefixTerritory.entries) {
    if (upper.startsWith(e.key)) return e.value;
  }
  return null;
}

String cityStoredToDisplayLabel(String value, [String? apiLabel]) {
  final api = apiLabel?.trim() ?? '';
  final raw = value.trim();
  if (raw.isEmpty) return '';
  if (api.isNotEmpty && api != raw) return api;
  final parts = raw.split('_').where((p) => p.isNotEmpty).toList();
  if (parts.length >= 2 && RegExp(r'^[A-Za-z0-9]{2,}$').hasMatch(parts.first)) {
    final tail = parts.skip(1).join(' ');
    if (tail.isEmpty) return raw.replaceAll('_', ' ');
    return tail
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
  return raw.replaceAll('_', ' ');
}

List<String> cascadeCities(
  TerritoryCascadeIndex idx, {
  required String? zone,
  required String? region,
  List<String> cityFallback = const [],
}) {
  final z = zone?.trim() ?? '';
  final r = region?.trim() ?? '';
  if (r.isEmpty) return const [];

  if (z.isNotEmpty) {
    final key = '$z|||$r';
    final fromTree = idx.citiesByZoneRegion[key];
    if (fromTree != null && fromTree.isNotEmpty) return fromTree;
  }

  final matched = idx.citiesByZoneRegion.entries
      .where((e) => e.key.endsWith('|||$r') || e.key == '|||$r')
      .expand((e) => e.value)
      .toList();
  if (matched.isNotEmpty) return mergeDistinct(matched, const []);

  if (cityFallback.isNotEmpty && z.isNotEmpty && r.isNotEmpty) {
    final fromPrefix = cityFallback.where((c) {
      final inferred = inferCityTerritoryFromCode(c);
      if (inferred == null) return false;
      return inferred.$1 == z && inferred.$2 == r;
    }).toList();
    if (fromPrefix.isNotEmpty) return mergeDistinct(fromPrefix, const []);
  }

  if (cityFallback.isNotEmpty) return mergeDistinct(cityFallback, const []);
  return const [];
}

String? resolveZoneForRegion(TerritoryCascadeIndex idx, String? region) {
  final r = region?.trim() ?? '';
  if (r.isEmpty) return null;
  final direct = idx.zoneByRegion[r];
  if (direct != null && direct.isNotEmpty) return direct;
  for (final e in idx.regionsByZone.entries) {
    if (e.value.contains(r)) return e.key;
  }
  return _lalakuRegionZone[r];
}

bool isLikelyZoneName(String value, TerritoryCascadeIndex idx) {
  final v = value.trim();
  if (v.isEmpty) return false;
  return idx.zones.contains(v);
}
