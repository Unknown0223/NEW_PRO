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

List<AgentCityOption> parseAgentCities(dynamic raw) {
  if (raw is! List) return const [];
  final out = <AgentCityOption>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final o = AgentCityOption.fromJson(Map<String, dynamic>.from(item));
    if (o.value.isNotEmpty) out.add(o);
  }
  return out;
}
