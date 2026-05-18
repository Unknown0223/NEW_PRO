import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { EXPORT_CAP } from "./visits-2.constants";
import { runVisits2Core } from "./visits-2.core";
import { parseVisits2Query } from "./visits-2.parse";

export async function exportVisits2Xlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const f = parseVisits2Query(q);
  const { rows, total } = await runVisits2Core(tenantId, f, actor, { offset: 0, limit: EXPORT_CAP });
  const truncated = total > EXPORT_CAP;

  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "№",
      "Ид клиента",
      "Клиент",
      "Телефон клиента",
      "Агент",
      "День",
      "Пос. визит",
      "Территория"
    ],
    ...rows.map((r) => [
      r.row_number,
      r.client_id,
      r.client_name,
      r.client_phone ?? "",
      r.agent_name,
      r.visit_day_label,
      r.last_visit_at ? r.last_visit_at.slice(0, 19).replace("T", " ") : "",
      r.territory
    ])
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "visits");
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return { buffer, total, truncated };
}

