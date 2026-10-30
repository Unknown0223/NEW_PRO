/** Tahrir: qulflangan agent id ni zakaz qatoridan aniqlash. */

export function resolveLockedOrderAgentId(
  order: {
    agent_id?: number | null;
    agent_name?: string | null;
    agent_display?: string | null;
  },
  agents: Array<{ id: number; name: string; login: string }>
): string {
  if (order.agent_id != null && Number(order.agent_id) > 0) {
    return String(order.agent_id);
  }
  const name = (order.agent_name ?? "").trim().toLowerCase();
  const display = (order.agent_display ?? "").trim().toLowerCase();
  if (!name && !display) return "";
  const hit = agents.find((u) => {
    const n = (u.name ?? "").trim().toLowerCase();
    const login = (u.login ?? "").trim().toLowerCase();
    if (n && (n === name || (display !== "" && display.includes(n)))) return true;
    if (login && display !== "" && display.includes(login)) return true;
    return false;
  });
  return hit ? String(hit.id) : "";
}

export function countPositiveQtyEntries(qtyByProductId: Record<number, string>): number {
  let n = 0;
  for (const raw of Object.values(qtyByProductId)) {
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    if (Number.isFinite(q) && q > 0) n += 1;
  }
  return n;
}
