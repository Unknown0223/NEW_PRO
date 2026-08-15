import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'agent_outlet_filters_provider.dart';

/// Joriy agent bo‘yicha mijoz balansi (veb kartochka «Общий» per agent).
/// API yuklanmaguncha `null` — sync dagi global balans ishlatilmaydi.
double? clientAgentLedgerBalance(Map<int, double>? balances, int? clientId) {
  if (clientId == null || balances == null) return null;
  return balances[clientId] ?? 0;
}

/// Agent ilovasida balanslar xaritasi — shell ochilganda yuklanadi.
void preloadClientAgentLedgerBalances(WidgetRef ref) {
  ref.watch(clientAgentLedgerBalancesProvider);
}
