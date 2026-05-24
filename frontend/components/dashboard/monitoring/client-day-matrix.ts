import { num } from "@/components/dashboard/monitoring/utils";

export type ClientDayMatrix = {
  clients: Array<{ id: number; name: string; cells: Map<string, string> }>;
  days: string[];
};

export function buildClientDayMatrix(
  rows: Array<{ client_id: number; client_name: string; day: string; sales_sum: string }>
): ClientDayMatrix {
  const byClient = new Map<number, { name: string; cells: Map<string, string> }>();
  const daySet = new Set<string>();
  for (const r of rows) {
    daySet.add(r.day);
    const cur = byClient.get(r.client_id) ?? { name: r.client_name, cells: new Map<string, string>() };
    cur.cells.set(r.day, r.sales_sum);
    byClient.set(r.client_id, cur);
  }
  const days = Array.from(daySet).sort();
  const clients = Array.from(byClient.entries())
    .map(([id, v]) => ({ id, name: v.name, cells: v.cells }))
    .sort((a, b) => {
      const sa = Array.from(a.cells.values()).reduce((s, x) => s + num(x), 0);
      const sb = Array.from(b.cells.values()).reduce((s, x) => s + num(x), 0);
      return sb - sa;
    });
  return { clients, days };
}

export const MATRIX_DAYS_PER_WEEK = 7;
