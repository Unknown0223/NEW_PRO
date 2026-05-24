import type { MonitoringDraft } from "@/components/dashboard/monitoring/types";
import { joinCsv } from "@/components/dashboard/monitoring/utils";

export function buildMonitoringQuery(applied: MonitoringDraft): string {
  const q = new URLSearchParams();
  q.set("month", String(applied.month));
  q.set("year", String(applied.year));
  const branches = joinCsv(applied.branch_codes);
  if (branches) q.set("branches", branches);
  const tid = joinCsv(applied.territory_ids);
  if (tid) q.set("territory_ids", tid);
  const t1 = joinCsv(applied.territory_1_list);
  if (t1) q.set("territory_1", t1);
  const t2 = joinCsv(applied.territory_2_list);
  if (t2) q.set("territory_2", t2);
  const t3 = joinCsv(applied.territory_3_list);
  if (t3) q.set("territory_3", t3);
  const agentIds = joinCsv(applied.agent_ids);
  if (agentIds) q.set("agent_ids", agentIds);
  const supIds = joinCsv(applied.supervisor_ids);
  if (supIds) q.set("supervisor_ids", supIds);
  const pay = joinCsv(applied.payment_methods);
  if (pay) q.set("payment_methods", pay);
  const st = joinCsv(applied.order_statuses);
  if (st) q.set("order_statuses", st);
  const cat = joinCsv(applied.category_ids);
  if (cat) q.set("category_ids", cat);
  return q.toString();
}
