import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseCumulativeBonusQuery } from "./cumulative-bonus.parse";
import { getCumulativeBonusReport } from "./cumulative-bonus.report";

export async function exportCumulativeBonusXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseCumulativeBonusQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getCumulativeBonusReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Название",
    "Агент",
    "Клиент",
    "Правило",
    "Сумма закупа",
    "Бонус кол-во",
    "Общий бонус",
    "Заказов",
    "АКБ",
    "Правил"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.name,
    r.agent_name,
    r.client_name,
    r.rule_name,
    r.purchase_sum,
    r.bonus_qty,
    r.bonus_sum,
    r.order_count,
    r.akb,
    r.rules_count
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Накопительный бонус");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
