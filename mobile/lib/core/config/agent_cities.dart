import 'territory_cascade.dart';

/// Agentga biriktirilgan shaharlar — `GET mobile/agent-config` → `agent_cities`.
class AgentCityOption {
  final String value;
  final String label;
  final String? zone;
  final String? region;

  const AgentCityOption({
    required this.value,
    required this.label,
    this.zone,
    this.region,
  });

  factory AgentCityOption.fromJson(Map<String, dynamic> j) => AgentCityOption(
        value: j['value']?.toString().trim() ?? '',
        label: j['label']?.toString().trim() ?? '',
        zone: j['zone']?.toString().trim(),
        region: j['region']?.toString().trim(),
      );

  Map<String, dynamic> toJson() => {
        'value': value,
        'label': label,
        if (zone != null && zone!.isNotEmpty) 'zone': zone,
        if (region != null && region!.isNotEmpty) 'region': region,
      };
}

/// Viloyat / oblast nomlari — agent shahar tanloviga kirmaydi.
bool isLikelyRegionTerritoryName(String? raw) {
  final u = (raw ?? '').trim().toUpperCase();
  if (u.isEmpty) return true;
  if (u.contains('VILOYATI')) return true;
  if (u == 'QOQON' || u == 'QORAQALPOQISTON' || u == 'TOSHKENT SHAHAR') return true;
  if (u.endsWith('_VIL') || u.endsWith(' VIL')) return true;
  return false;
}

List<AgentCityOption> parseAgentCities(dynamic raw) {
  if (raw is! List) return const [];
  final out = <AgentCityOption>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final o = AgentCityOption.fromJson(Map<String, dynamic>.from(item));
    if (o.value.isEmpty) continue;
    if (isLikelyRegionTerritoryName(o.value) || isLikelyRegionTerritoryName(o.label)) {
      continue;
    }
    out.add(o);
  }
  return out;
}

/// `agent_cities` bo‘sh bo‘lsa — daraxt shaharlaridan (viloyat emas) tanlash.
List<AgentCityOption> agentCitiesFromCascade(TerritoryCascadeIndex index) {
  if (index.citiesByZoneRegion.isEmpty) return const [];
  final out = <AgentCityOption>[];
  final seen = <String>{};
  for (final e in index.citiesByZoneRegion.entries) {
    final parts = e.key.split('|||');
    final zone = parts.isNotEmpty && parts[0].trim().isNotEmpty ? parts[0].trim() : null;
    final region = parts.length > 1 && parts[1].trim().isNotEmpty ? parts[1].trim() : null;
    for (final city in e.value) {
      final value = city.trim();
      if (value.isEmpty || isLikelyRegionTerritoryName(value) || !seen.add(value)) continue;
      out.add(
        AgentCityOption(
          value: value,
          label: value.replaceAll('_', ' '),
          zone: zone,
          region: region,
        ),
      );
    }
  }
  out.sort((a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()));
  return out;
}
