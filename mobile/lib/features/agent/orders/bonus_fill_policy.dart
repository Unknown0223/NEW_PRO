/// Pure helpers for bonus fill completeness / remaining fill (unit-testable).

/// One earned bonus rule with selected gift qty.
class BonusRuleFillState {
  final int ruleId;
  final int earnedQty;
  final int selectedQty;
  final bool agentMustFill;

  const BonusRuleFillState({
    required this.ruleId,
    required this.earnedQty,
    required this.selectedQty,
    this.agentMustFill = true,
  });
}

/// Strategy pick state for completeness checks.
class BonusStrategyFillState {
  final int strategyId;
  final bool requiresChoice;
  final int maxSelect;
  final int pickedCount;

  const BonusStrategyFillState({
    required this.strategyId,
    required this.requiresChoice,
    required this.maxSelect,
    required this.pickedCount,
  });
}

/// Returns an error message when required fill is incomplete; otherwise null.
String? bonusFillCompletenessError({
  required List<BonusRuleFillState> rules,
  required List<BonusStrategyFillState> strategies,
  required String incompleteBonusMessage,
  required String strategyChoiceMessage,
}) {
  for (final s in strategies) {
    if (!s.requiresChoice) continue;
    if (s.pickedCount <= 0) return strategyChoiceMessage;
    if (s.maxSelect > 0 && s.pickedCount > s.maxSelect) {
      return strategyChoiceMessage;
    }
  }
  for (final r in rules) {
    if (!r.agentMustFill) continue;
    if (r.earnedQty <= 0) continue;
    if (r.selectedQty < r.earnedQty) return incompleteBonusMessage;
  }
  return null;
}

/// Tops up [currentQtyByProduct] toward [earnedQty] without reducing existing picks.
/// Returns a new map; does not mutate [currentQtyByProduct].
///
/// [giftProducts] should be ordered preferred-first (e.g. by stock desc).
/// [stockCapFor] returns max total qty allowed for a product (incl. existing).
Map<int, int> fillRemainingGiftQtyMap({
  required int earnedQty,
  required Map<int, int> currentQtyByProduct,
  required List<int> giftProductIds,
  int Function(int productId, int currentQty)? stockCapFor,
}) {
  final out = Map<int, int>.from(currentQtyByProduct);
  if (earnedQty <= 0 || giftProductIds.isEmpty) return out;

  var selected = giftProductIds.fold<int>(0, (s, id) => s + (out[id] ?? 0));
  var need = earnedQty - selected;
  if (need <= 0) return out;

  for (final pid in giftProductIds) {
    if (need <= 0) break;
    final cur = out[pid] ?? 0;
    final maxTotal = stockCapFor != null ? stockCapFor(pid, cur) : cur + need;
    final room = maxTotal - cur;
    if (room <= 0) continue;
    final take = room < need ? room : need;
    out[pid] = cur + take;
    need -= take;
  }
  return out;
}

bool anyGiftQtySelected(Map<int, Map<int, int>> giftQtyByRule) {
  for (final m in giftQtyByRule.values) {
    for (final q in m.values) {
      if (q > 0) return true;
    }
  }
  return false;
}
