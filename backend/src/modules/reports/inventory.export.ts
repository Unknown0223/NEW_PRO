import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseInventoryQuery } from "./inventory.parse";
import { getInventoryReport } from "./inventory.report";

export async function exportInventoryXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseInventoryQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getInventoryReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Клиент",
    "Телефон",
    "Адрес",
    "Город",
    "Агент",
    "Супервайзер",
    "Тип инвентаря",
    "Кол-во инвентаря",
    "Заказов",
    "Кол-во",
    "Сумма"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.client_name,
    r.phone,
    r.address,
    r.city,
    r.agent_name,
    r.supervisor_name,
    r.inventory_types,
    r.equipment_count,
    r.order_count,
    Number.parseFloat(r.qty),
    Number.parseFloat(r.amount)
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "По инвентарю");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
