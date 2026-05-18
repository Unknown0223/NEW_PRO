import ExcelJS from "exceljs";
import type { StockReceiptReportOpts } from "./stock.receipt-report.types";
import { listStockReceiptReport } from "./stock.receipt-report.list";

export async function buildStockReceiptReportExportBuffer(
  tenantId: number,
  opts: Omit<StockReceiptReportOpts, "page" | "limit">
): Promise<Buffer> {
  const res = await listStockReceiptReport(tenantId, { ...opts, page: 1, limit: 25_000 });
  if (res.total > 25_000) throw new Error("EXPORT_TOO_LARGE");
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet("Отчет по приходам", { views: [{ state: "frozen", ySplit: 1 }] });
  sh.columns = [
    { header: "Категория продукта", key: "category", width: 28 },
    { header: "Код", key: "sku", width: 16 },
    { header: "Асcортимент", key: "name", width: 38 },
    { header: "Дата последнего закупа", key: "last", width: 20 },
    { header: "Кол-во", key: "qty", width: 14 },
    { header: "Цена", key: "price", width: 14 },
    { header: "Сумма", key: "sum", width: 16 }
  ];
  for (const r of res.data) {
    sh.addRow({
      category: r.category_name ?? "",
      sku: r.sku,
      name: r.product_name,
      last: r.last_purchase_at ? r.last_purchase_at.slice(0, 10) : "",
      qty: r.qty,
      price: r.price,
      sum: r.total
    });
  }
  sh.addRow({
    category: "Итого",
    qty: res.totals.qty,
    sum: res.totals.total
  });
  sh.getRow(1).font = { bold: true };
  sh.getRow(sh.rowCount).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
