type TradeDirectionRef = { id: number; name: string; code: string | null };

type DirectionUser = {
  trade_direction_id: number | null;
  trade_direction: string | null;
};

/** Foydalanuvchi tanlangan yo'nalishga tegishlimi (FK yoki legacy matn). */
export function userMatchesTradeDirection(user: DirectionUser, direction: TradeDirectionRef): boolean {
  if (user.trade_direction_id === direction.id) return true;
  const legacy = user.trade_direction?.trim().toLowerCase();
  if (!legacy) return false;
  const name = direction.name.trim().toLowerCase();
  const code = direction.code?.trim().toLowerCase() ?? "";
  if (legacy === name || (code && legacy === code)) return true;
  if (code && legacy === `${name} (${code})`.toLowerCase()) return true;
  return false;
}

/** Rahbarlar tenant bo'yicha — yo'nalishdan mustaqil. */
export function isTenantPlanningLeader(userId: number, leaderIds: readonly number[]): boolean {
  return leaderIds.includes(userId);
}
