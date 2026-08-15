/**
 * Nomlangan bonus/skidka strategiyasi: tarkibdan maksimal N ta tanlash.
 *
 * Qoidalar:
 * - kamida 2 ta a'zo
 * - max_select >= 1 va max_select <= members.length - 1 (hammasini birga olish mumkin emas)
 * - zakazda: mos a'zolardan 1…min(max_select, eligible) tanlanadi
 */

export type BonusStrategyConstraint = {
  id: number;
  name: string;
  max_select: number;
  /** Tarkibdagi qoida ID lari (tartib saqlanadi). */
  rule_ids: number[];
};

export type BonusStrategySelectionInput = {
  strategy_id: number;
  rule_ids: number[];
};

export type StrategySlotRef = {
  ruleId: number;
  priority: number;
};

export type ApplyStrategiesResult<T extends StrategySlotRef> = {
  slots: T[];
  /** Har bir strategiya uchun tanlangan qoidalar (preview / UI). */
  applied_selections: BonusStrategySelectionInput[];
  error?: string;
};

/** Admin saqlash validatsiyasi. */
export function validateBonusStrategyMembers(
  memberCount: number,
  maxSelect: number
): string | null {
  if (memberCount < 2) return "STRATEGY_MIN_MEMBERS";
  if (!Number.isInteger(maxSelect) || maxSelect < 1) return "STRATEGY_MAX_SELECT_MIN";
  if (maxSelect > memberCount - 1) return "STRATEGY_MAX_SELECT_TOO_HIGH";
  return null;
}

export function normalizeMaxSelect(raw: number | null | undefined, memberCount: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 1;
  if (memberCount < 2) return Math.max(1, n);
  const capped = Math.min(Math.max(1, n), memberCount - 1);
  return capped;
}

/**
 * Slotlardan strategiya a'zolarini filtrlash.
 * Tanlov berilmasa — prioritet bo‘yicha avto `max_select` ta.
 */
export function applyBonusStrategyConstraints<T extends StrategySlotRef>(
  slots: T[],
  strategies: BonusStrategyConstraint[],
  selections: BonusStrategySelectionInput[] | undefined
): ApplyStrategiesResult<T> {
  if (strategies.length === 0 || slots.length === 0) {
    return { slots, applied_selections: [] };
  }

  const selectionByStrategy = new Map<number, number[]>();
  for (const s of selections ?? []) {
    if (!Number.isInteger(s.strategy_id) || s.strategy_id < 1) continue;
    const ids = [...new Set((s.rule_ids ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    selectionByStrategy.set(s.strategy_id, ids);
  }

  let working = [...slots];
  const applied: BonusStrategySelectionInput[] = [];

  for (const strategy of strategies) {
    const memberSet = new Set(strategy.rule_ids);
    if (memberSet.size === 0) continue;

    const eligible = working
      .filter((s) => memberSet.has(s.ruleId))
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.ruleId - b.ruleId;
      });
    if (eligible.length === 0) continue;

    const cap = Math.min(Math.max(1, strategy.max_select), eligible.length);
    const eligibleIds = new Set(eligible.map((e) => e.ruleId));

    let chosenIds: number[];
    const provided = selectionByStrategy.get(strategy.id);
    if (provided !== undefined) {
      chosenIds = [...new Set(provided.filter((id) => eligibleIds.has(id)))];
      if (chosenIds.length < 1) {
        return {
          slots: working,
          applied_selections: applied,
          error: "STRATEGY_SELECTION_REQUIRED"
        };
      }
      if (chosenIds.length > cap) {
        return {
          slots: working,
          applied_selections: applied,
          error: "STRATEGY_SELECTION_TOO_MANY"
        };
      }
    } else {
      chosenIds = eligible.slice(0, cap).map((e) => e.ruleId);
    }

    const chosenSet = new Set(chosenIds);
    working = working.filter((s) => !memberSet.has(s.ruleId) || chosenSet.has(s.ruleId));
    applied.push({ strategy_id: strategy.id, rule_ids: chosenIds });
  }

  return { slots: working, applied_selections: applied };
}

/** Strategiya agent/filial/yo‘nalish scope. */
export function strategyMatchesAgentScope(
  strategy: {
    scope_branch_codes: string[];
    scope_agent_user_ids: number[];
    scope_trade_direction_ids: number[];
  },
  agent: { userId: number; branch: string | null; trade_direction_id: number | null } | null
): boolean {
  const branches = strategy.scope_branch_codes ?? [];
  const agentIds = strategy.scope_agent_user_ids ?? [];
  const dirIds = strategy.scope_trade_direction_ids ?? [];
  const hasBranch = branches.length > 0;
  const hasAgents = agentIds.length > 0;
  const hasDirs = dirIds.length > 0;
  if (!hasBranch && !hasAgents && !hasDirs) return true;
  if (agent == null) return false;

  if (hasBranch || hasAgents) {
    const branchSet = new Set(branches.map((b) => b.trim().toLowerCase()));
    const branchOk =
      hasBranch && agent.branch != null && branchSet.has(agent.branch.trim().toLowerCase());
    const agentOk = hasAgents && agentIds.includes(agent.userId);
    if (hasBranch && hasAgents) {
      if (!(branchOk || agentOk)) return false;
    } else if (hasBranch && !branchOk) return false;
    else if (hasAgents && !agentOk) return false;
  }
  if (hasDirs) {
    if (agent.trade_direction_id == null || !dirIds.includes(agent.trade_direction_id)) {
      return false;
    }
  }
  return true;
}
