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
    return { applied: 0, errors: ["Varaq topilmadi"], warnings: [] };
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
        "Birinchi qatorda majburiy ustunlar: Ombor (ID yoki nomi), Miqdor; SKU yoki Shtrix kod ustuni kerak. Yoki «Поступление» shabloni: «Количество прихода», «Код товара»."
      ],
      warnings: []
    };
  }
  if (!colIndexByKey.sku && !colIndexByKey.barcode) {
    return {
      applied: 0,
      errors: ["«Tovar smart kodi (SKU)» yoki «Shtrix kod» ustunlaridan kamida bittasi bo‘lishi kerak"],
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
      errors.push(`Qator ${r}: miqdor noto‘g‘ri yoki bo‘sh`);
      continue;
    }

    const whId = await resolveWarehouseId(tenantId, whCell);
    if (whId == null) {
      errors.push(`Qator ${r}: ombor topilmadi («${whCell}»)`);
      continue;
    }

    if (!skuCell && !bcCell) {
      errors.push(`Qator ${r}: SKU yoki shtrix kod kerak`);
      continue;
    }

    const product = await resolveProductForImport(tenantId, skuCell, bcCell);
    if (!product) {
      errors.push(`Qator ${r}: mahsulot topilmadi (SKU: «${skuCell}», shtrix: «${bcCell}»)`);
      continue;
    }

    if (nameCell) {
      if (product.name.trim().toLowerCase() !== nameCell.trim().toLowerCase()) {
        warnings.push(
          `Qator ${r}: «Tovar nomi» jadvaldagi nom bilan mos kelmaydi (SKU ${product.sku}, kutilgan tekshiruv)`
        );
      }
    }
    if (bcCell && product.barcode && product.barcode.trim() !== bcCell.trim()) {
      warnings.push(
        `Qator ${r}: shtrix kod ustuni bazadagi kod bilan mos emas (SKU ${product.sku})`
      );
    }

    if (dateCell) {
      const { iso, raw } = parseDateCellForWarn(dateCell);
      if (raw && !iso) {
        warnings.push(`Qator ${r}: sanani o‘qib bo‘lmadi («${raw}»), kirim baribir qo‘llanadi`);
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
      errors.push(`Qator ${r}: ${e instanceof Error ? e.message : "xato"}`);
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

