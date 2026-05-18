/**
 * Supervisor dashboard: `/api/:slug/dashboard/supervisor` query string (frontend = backend `parseSupervisorDashboardFilters` bilan mos).
 */
export type SupervisorDashboardQueryInput = {
  date: string;
  payment_types: string[];
  agent_ids: string[];
  supervisor_ids: string[];
  trade_directions: string[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
};

function joinCsv(values: string[]): string | undefined {
  const u = [...new Set(values.map((x) => String(x).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
  return u.length ? u.join(",") : undefined;
}

export function buildSupervisorDashboardQueryString(applied: SupervisorDashboardQueryInput): string {
  const q = new URLSearchParams();
  q.set("date", applied.date);
  const pay = joinCsv(applied.payment_types);
  if (pay) q.set("payment_type", pay);
  const agents = joinCsv(applied.agent_ids);
  if (agents) q.set("agent_ids", agents);
  const sups = joinCsv(applied.supervisor_ids);
  if (sups) q.set("supervisor_ids", sups);
  const td = joinCsv(applied.trade_directions);
  if (td) q.set("trade_direction", td);
  const cat = joinCsv(applied.client_categories);
  if (cat) q.set("client_category", cat);
  const t1 = joinCsv(applied.territory_1_list);
  if (t1) q.set("territory_1", t1);
  const t2 = joinCsv(applied.territory_2_list);
  if (t2) q.set("territory_2", t2);
  const t3 = joinCsv(applied.territory_3_list);
  if (t3) q.set("territory_3", t3);
  return q.toString();
}
