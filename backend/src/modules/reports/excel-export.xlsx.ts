import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseExcelExportQuery } from "./excel-export.parse";
import { getExcelExportReport } from "./excel-export.report";

export async function exportExcelExportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(20000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "10000", 10) || 10000));
  const f = parseExcelExportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getExcelExportReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "Заказ ID",
    "Номер",
    "Дата отгрузки",
    "Клиент",
    "Код клиента",
    "Продукт",
    "Количество",
    "Статус",
    "Агент",
    "Код агента",
    "Экспедитор",
    "Код экспедитора",
    "Категория клиента",
    "Территория",
    "Тип цены",
    "Тип оплаты",
    "Категория продукта",
    "Единица",
    "Цена",
    "Сумма",
    "discount",
    "Дата заявки",
    "Дата доставки"
  ];

  const rows = report.rows.map((r) => [
    r.order_id,
    r.order_number,
    r.shipped_at ? new Date(r.shipped_at).toLocaleString("ru-RU") : "",
    r.client_name,
    r.client_code,
    r.product_name,
    Number.parseFloat(r.qty),
    r.status_label,
    r.agent_name,
    r.agent_code,
    r.expeditor_name,
    r.expeditor_code,
    r.client_category,
    r.territory,
    r.price_type,
    r.payment_method,
    r.product_category,
    r.unit,
    Number.parseFloat(r.price),
    Number.parseFloat(r.amount),
    Number.parseFloat(r.discount),
    new Date(r.order_date).toLocaleString("ru-RU"),
    r.delivered_at ? new Date(r.delivered_at).toLocaleString("ru-RU") : ""
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Excel экспорт");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
