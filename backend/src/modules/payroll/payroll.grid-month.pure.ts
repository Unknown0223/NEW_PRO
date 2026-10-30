export type GridScope = "role" | "user";

export type GridSnap = {
  ym: number;
  scope: GridScope;
  role: string;
  user_id: number;
  base_amount: number | null;
  item_amounts: Record<string, number>;
  raw?: unknown;
};

export const ymKey = (year: number, month: number) => year * 100 + month;

/** Shu oy yoki undan oldingi oxirgi saqlangan setka. Rol ustiga xodim yoziladi. */
export function effectiveGrid(rows: GridSnap[], ym: number, role: string, userId: number): GridSnap | null {
  const prior = rows.filter((r) => r.ym <= ym).sort((a, b) => b.ym - a.ym);
  const roleRow = prior.find((r) => r.scope === "role" && r.role === role);
  const userRow = userId > 0 ? prior.find((r) => r.scope === "user" && r.user_id === userId) : undefined;
  if (!roleRow && !userRow) return null;
  return {
    ym,
    scope: userRow ? "user" : "role",
    role,
    user_id: userId,
    base_amount: userRow?.base_amount ?? roleRow?.base_amount ?? null,
    item_amounts: { ...(roleRow?.item_amounts ?? {}), ...(userRow?.item_amounts ?? {}) },
    raw: userRow?.raw ?? roleRow?.raw
  };
}
