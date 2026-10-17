import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockReceipt } from "./stock.movements";
import {
  parseDateCellForWarn,
  parseQtyCell,
  resolveProductForImport,
  resolveWarehouseId,
  stockImportHeaderToKey,
  type StockImportOptions,
  type StockImportResult
} from "./stock.import.helpers";
import { importPostupleniya2StockReceiptFromSheet } from "./stock.receipt-import";

export async function importStockReceiptFromXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  actorUserId: number | null = null,
  options?: StockImportOptions
): Promise<StockImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { applied: 0, errors: ["Лист не найден"], warnings: [] };
  }

  const headerRow = sheet.getRow(1);
  const colIndexByKey: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const v = cell.text?.trim();
    if (!v) return;
    const key = stockImportHeaderToKey(v);
    if (key) colIndexByKey[key] = colNumber;
  });

  const isPostupleniya2 = colIndexByKey.receipt_qty != null;
  if (isPostupleniya2) {
    return importPostupleniya2StockReceiptFromSheet(
      tenantId,
      sheet,
      colIndexByKey,
      options?.defaultWarehouseId,
      actorUserId
    );
  }

  if (!colIndexByKey.warehouse || !colIndexByKey.qty) {
    return {
      applied: 0,
      errors: [
        "В первой строке обязательны столбцы «Ombor (ID yoki nomi)» и «Miqdor», а также столбец SKU или штрихкода. Либо используйте шаблон «Поступление»: «Количество прихода», «Код товара»."
      ],
      warnings: []
    };
  }
  if (!colIndexByKey.sku && !colIndexByKey.barcode) {
    return {
      applied: 0,
      errors: ["Нужен хотя бы один из столбцов «Tovar smart kodi (SKU)» или «Shtrix kod»"],
      warnings: []
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let applied = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const whCell = row.getCell(colIndexByKey.warehouse).text?.trim() ?? "";
    const skuCell = colIndexByKey.sku ? String(row.getCell(colIndexByKey.sku).text ?? "").trim() : "";
    const bcCell = colIndexByKey.barcode
      ? String(row.getCell(colIndexByKey.barcode).text ?? "").trim()
      : "";
    const nameCell = colIndexByKey.name
      ? String(row.getCell(colIndexByKey.name).text ?? "").trim()
      : "";
    const qtyCell = row.getCell(colIndexByKey.qty);
    const dateCell = colIndexByKey.date ? row.getCell(colIndexByKey.date) : null;

    if (!whCell && !skuCell && !bcCell) continue;

    const qty = parseQtyCell(qtyCell);
    if (qty == null || qty <= 0) {
      errors.push(`Строка ${r}: количество неверное или пустое`);
      continue;
    }

    const whId = await resolveWarehouseId(tenantId, whCell);
    if (whId == null) {
      errors.push(`Строка ${r}: склад не найден («${whCell}»)`);
      continue;
    }

    if (!skuCell && !bcCell) {
      errors.push(`Строка ${r}: нужен SKU или штрихкод`);
      continue;
    }

    const product = await resolveProductForImport(tenantId, skuCell, bcCell);
    if (!product) {
      errors.push(`Строка ${r}: товар не найден (SKU: «${skuCell}», штрихкод: «${bcCell}»)`);
      continue;
    }

    if (nameCell) {
      if (product.name.trim().toLowerCase() !== nameCell.trim().toLowerCase()) {
        warnings.push(
          `Строка ${r}: «Tovar nomi» не совпадает с названием в справочнике (SKU ${product.sku}, контрольная проверка)`
        );
      }
    }
    if (bcCell && product.barcode && product.barcode.trim() !== bcCell.trim()) {
      warnings.push(
        `Строка ${r}: штрихкод в файле не совпадает со штрихкодом в базе (SKU ${product.sku})`
      );
    }

    if (dateCell) {
      const { iso, raw } = parseDateCellForWarn(dateCell);
      if (raw && !iso) {
        warnings.push(`Строка ${r}: не удалось прочитать дату («${raw}»), приход всё равно будет проведён`);
      }
    }

    try {
      await applyStockReceipt(
        tenantId,
        {
          warehouse_id: whId,
          items: [{ product_id: product.id, qty }]
        },
        actorUserId,
        { skipAudit: true }
      );
      applied += 1;
    } catch (e) {
      errors.push(`Строка ${r}: ${e instanceof Error ? e.message : "ошибка"}`);
    }
  }

  if (applied > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.stock,
      entityId: "bulk",
      action: "import.xlsx",
      payload: { applied_rows: applied, error_count: errors.length, warning_count: warnings.length }
    });
  }

  return { applied, errors, warnings };
}

