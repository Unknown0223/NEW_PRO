import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-2.types";
import { parseClientSales2Query } from "./client-sales-2.parse";
import { getClientSales3Report } from "./client-sales-3.report";

export async function exportClientSales3Xlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseClientSales2Query({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getClientSales3Report(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "Ид клиента",
    "Название",
    "Дата добавления",
    "Категория",
    "Активный",
    "Сумма",
    "Кол-во",
    "Объем",
    "Агент",
    "Дни посещения",
    "Последний закуп",
    "Кол-во дней с послед. закупа",
    "Территория",
    "Адрес",
    "Телефон",
    "Экспедитор"
  ];
  const rows = report.clients.map((r) => [
    r.client_id,
    r.client_name,
    new Date(r.created_at).toLocaleDateString("ru-RU"),
    r.category,
    r.active ? "Да" : "Нет",
    Number.parseFloat(r.amount),
    Number.parseFloat(r.qty),
    Number.parseFloat(r.volume),
    r.agents_list,
    r.visit_days,
    r.last_order ?? "",
    r.days_since_last ?? "",
    r.city,
    r.address,
    r.phone,
    r.expeditor_name
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Клиенты");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
