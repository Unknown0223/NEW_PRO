import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { rowToDto, runProductAggCore } from "./product-sales.agg";
import { parseProductSalesReportQuery } from "./product-sales.parse";

export const EXPORT_MAX = 10_000;

export async function exportProductSalesReportXlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
) {
  const f = parseProductSalesReportQuery(q);
  const { rows, total } = await runProductAggCore(tenantId, f, actor, { offset: 0, limit: EXPORT_MAX });
  const truncated = Number(total) > EXPORT_MAX;

  const paymentKeys = new Set<string>();
  for (const r of rows) {
    const p = r.payments;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      for (const k of Object.keys(p as object)) paymentKeys.add(k);
    }
  }
  const payCols = [...paymentKeys].sort((a, b) => a.localeCompare(b, "ru"));

  const header = [
    "№",
    "SAP",
    "SKU",
    "Название",
    "Категория",
    "Блок",
    "Кол-во",
    "Бонус кол-во",
    "Объём м³",
    "Сумма",
    "Бонус сумма",
    "АКБ",
    "Заказов",
    ...payCols
  ];
  const dataRows: (string | number)[][] = rows.map((r, i) => {
    const dto = rowToDto(r, i, 1, 1);
    const payVals = payCols.map((k) => dto.payments[k] ?? "0");
    return [
      i + 1,
      dto.sell_code,
      dto.sku,
      dto.name,
      dto.category_name,
      dto.block,
      dto.qty,
      dto.qty_bonus,
      dto.volume_m3,
      dto.total,
      dto.bonus_total,
      dto.akb,
      dto.order_count,
      ...payVals
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Продажи по товарам");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: Number(total), truncated };
}
