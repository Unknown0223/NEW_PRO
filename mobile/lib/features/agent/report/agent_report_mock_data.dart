/// ReportsScreen kategoriya qatori.
class AgentReportRow {
  final String name;
  final String count;
  final String volume;
  final String sum;
  final int depth;
  final bool active;

  const AgentReportRow({
    required this.name,
    required this.count,
    required this.volume,
    required this.sum,
    this.depth = 0,
    this.active = false,
  });
}

