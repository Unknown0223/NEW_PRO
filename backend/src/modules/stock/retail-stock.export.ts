import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


import type { RetailStockCategoryRow, RetailStockDetailedRow, RetailStockListQuery } from "./retail-stock.types";
import { listRetailStock } from "./retail-stock.list";

export async function buildRetailStockExportBuffer(
  tenantId: number,
  q: RetailStockListQuery
): Promise<Buffer> {
  const data = await listRetailStock(tenantId, { ...q, page: 1, limit: 25000 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Retail stock", { views: [{ state: "frozen", ySplit: 1 }] });
  if (data.view === "categories") {
    const headers = ["Дата", "Категория", "Кол-во", "Кол-во (продажа)", "Сумма", "ТТ с наличием"];
    headers.forEach((h, i) => {
      sheet.getRow(1).getCell(i + 1).value = h;
      sheet.getRow(1).getCell(i + 1).font = { bold: true };
    });
    (data.data as RetailStockCategoryRow[]).forEach((r, idx) => {
      const row = sheet.getRow(idx + 2);
      row.getCell(1).value = r.stock_date;
      row.getCell(2).value = r.category_name;
      row.getCell(3).value = r.quantity;
      row.getCell(4).value = r.sold_quantity;
      row.getCell(5).value = r.amount;
      row.getCell(6).value = r.coverage_clients;
    });
  } else {
    const headers = [
      "Дата",
      "Клиент",
      "Территория",
      "Агент",
      "Категория",
      "Продукт",
      "Код",
      "Кол-во",
      "Кол-во (продажа)",
      "Объем",
      "Сумма",
      "Тип цены",
      "Комментарий"
    ];
    headers.forEach((h, i) => {
      sheet.getRow(1).getCell(i + 1).value = h;
      sheet.getRow(1).getCell(i + 1).font = { bold: true };
    });
    (data.data as RetailStockDetailedRow[]).forEach((r, idx) => {
      const row = sheet.getRow(idx + 2);
      row.getCell(1).value = r.stock_date;
      row.getCell(2).value = r.client_name;
      row.getCell(3).value = r.territory;
      row.getCell(4).value = r.agent_name ?? "";
      row.getCell(5).value = r.category_name ?? "";
      row.getCell(6).value = r.product_name;
      row.getCell(7).value = r.sku;
      row.getCell(8).value = r.quantity;
      row.getCell(9).value = r.sold_quantity;
      row.getCell(10).value = r.volume ?? "";
      row.getCell(11).value = r.amount;
      row.getCell(12).value = r.price_type ?? "";
      row.getCell(13).value = r.comment ?? "";
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

