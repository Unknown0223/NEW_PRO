import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockReceipt } from "./stock.movements";
import {
  parseQtyCell,
  resolveProductForImport,
  resolveWarehouseId,
  type StockImportResult
} from "./stock.import.helpers";

export async function importPostupleniya2StockReceiptFromSheet(
  tenantId: number,
  sheet: ExcelJS.Worksheet,
  colIndexByKey: Record<string, number>,
  defaultWarehouseId: number | undefined,
  actorUserId: number | null
): Promise<StockImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let applied = 0;

  const rq = colIndexByKey.receipt_qty;
  if (rq == null) {
    return { applied: 0, errors: ["«Количество прихода» ustuni topilmadi"], warnings: [] };
  }
  if (!colIndexByKey.sku && !colIndexByKey.barcode) {
    return {
      applied: 0,
      errors: ["«Код товара» yoki SKU / shtrix kod ustuni kerak"],
      warnings: []
    };
  }

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const skuCell = colIndexByKey.sku ? String(row.getCell(colIndexByKey.sku).text ?? "").trim() : "";
    const bcCell = colIndexByKey.barcode
      ? String(row.getCell(colIndexByKey.barcode).text ?? "").trim()
      : "";
    const whCell = colIndexByKey.warehouse
      ? String(row.getCell(colIndexByKey.warehouse).text ?? "").trim()
      : "";
    const nameCell = colIndexByKey.name
      ? String(row.getCell(colIndexByKey.name).text ?? "").trim()
      : "";
    const categoryCell = colIndexByKey.category
      ? String(row.getCell(colIndexByKey.category).text ?? "").trim()
      : "";

    if (!skuCell && !bcCell && !whCell && !nameCell && !categoryCell) continue;

    const receiptQty = parseQtyCell(row.getCell(rq));
    if (receiptQty == null || receiptQty <= 0) {
      errors.push(`Qator ${r}: «Количество прихода» noto‘g‘ri yoki bo‘sh`);
      continue;
    }

    let blockMul = 1;
    if (colIndexByKey.block_qty) {
      const b = parseQtyCell(row.getCell(colIndexByKey.block_qty));
      if (b != null && b > 0) blockMul = b;
    }
    const qty = receiptQty * blockMul;
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push(`Qator ${r}: umumiy miqdor noto‘g‘ri`);
      continue;
    }

    let whId: number | null = null;
    if (whCell) {
      whId = await resolveWarehouseId(tenantId, whCell);
      if (whId == null) {
        errors.push(`Qator ${r}: ombor topilmadi («${whCell}»)`);
        continue;
      }
    } else if (defaultWarehouseId != null && defaultWarehouseId > 0) {
      const wh = await prisma.warehouse.findFirst({
        where: { id: defaultWarehouseId, tenant_id: tenantId }
      });
      whId = wh?.id ?? null;
      if (whId == null) {
        errors.push(`Qator ${r}: tanlangan ombor (import) topilmadi`);
        continue;
      }
    } else {
      errors.push(
        `Qator ${r}: «Склад» ustunini to‘ldiring yoki importdan oldin omborni tanlang (postupleniya shabloni)`
      );
      continue;
    }

    if (!skuCell && !bcCell) {
      errors.push(`Qator ${r}: «Код товара» / SKU yoki shtrix kod kerak`);
      continue;
    }

    const product = await resolveProductForImport(tenantId, skuCell, bcCell);
    if (!product) {
      errors.push(`Qator ${r}: mahsulot topilmadi (SKU: «${skuCell}», shtrix: «${bcCell}»)`);
      continue;
    }

    if (categoryCell && product.categoryName) {
      if (product.categoryName.trim().toLowerCase() !== categoryCell.trim().toLowerCase()) {
        warnings.push(
          `Qator ${r}: «Категория» bazadagi kategoriya bilan mos emas (${product.sku})`
        );
      }
    }
    if (nameCell && product.name.trim().toLowerCase() !== nameCell.trim().toLowerCase()) {
      warnings.push(
        `Qator ${r}: «Продукт» nomi bazadagi nom bilan mos kelmaydi (${product.sku})`
      );
    }
    if (bcCell && product.barcode && product.barcode.trim() !== bcCell.trim()) {
      warnings.push(`Qator ${r}: shtrix kod bazadagi kod bilan mos emas (${product.sku})`);
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
      action: "import.xlsx.postupleniya2",
      payload: { applied_rows: applied, error_count: errors.length, warning_count: warnings.length }
    });
  }

  return { applied, errors, warnings };
}

/**
 * Excel orqali omborga kirim:
 * - **Klassik** shablon: ombor, SKU/shtrix, miqdor, …
 * - **Поступление / postupleniya-2**: «Количество прихода», «Количество в блоке», «Код товара», …; ombor qatorda yoki `defaultWarehouseId`
 */
