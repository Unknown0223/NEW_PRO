import * as XLSX from "xlsx";
import { parsePricesReportQuery } from "./prices-report.parse";
import { getPricesReport } from "./prices-report.report";

export async function exportPricesReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parsePricesReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getPricesReport(tenantId, f);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Дата",
    "Товар",
    "SKU",
    "Категория",
    "Бренд",
    "Тип цены",
    "Цена",
    "Валюта",
    "Предыдущая",
    "Разница"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.changed_at,
    r.product_name,
    r.sku,
    r.category_name,
    r.brand_name,
    r.price_type_label,
    r.price,
    r.currency,
    r.previous_price ?? "",
    r.diff ?? ""
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "По ценам");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
