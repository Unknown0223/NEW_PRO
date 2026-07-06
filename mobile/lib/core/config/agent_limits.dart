/// Agent konsignatsiya va limit snapshot — `GET mobile/agent-config` dan.
class AgentLimits {
  final bool consignment;
  final String? consignmentLimitAmount;

  const AgentLimits({
    this.consignment = false,
    this.consignmentLimitAmount,
  });

  factory AgentLimits.fromJson(Map<String, dynamic>? j) {
    if (j == null) return const AgentLimits();
    return AgentLimits(
      consignment: j['consignment'] == true,
      consignmentLimitAmount: j['consignment_limit_amount']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'consignment': consignment,
        if (consignmentLimitAmount != null) 'consignment_limit_amount': consignmentLimitAmount,
      };
}
