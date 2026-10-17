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
    return { applied: 0, errors: ["Столбец «Количество прихода» не найден"], warnings: [] };
  }
  if (!colIndexByKey.sku && !colIndexByKey.barcode) {
    return {
      applied: 0,
      errors: ["Нужен столбец «Код товара» либо SKU / штрихкод"],
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
      errors.push(`Строка ${r}: «Количество прихода» неверное или пустое`);
      continue;
    }

    let blockMul = 1;
    if (colIndexByKey.block_qty) {
      const b = parseQtyCell(row.getCell(colIndexByKey.block_qty));
      if (b != null && b > 0) blockMul = b;
    }
    const qty = receiptQty * blockMul;
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push(`Строка ${r}: неверное общее количество`);
      continue;
    }

    let whId: number | null = null;
    if (whCell) {
      whId = await resolveWarehouseId(tenantId, whCell);
      if (whId == null) {
        errors.push(`Строка ${r}: склад не найден («${whCell}»)`);
        continue;
      }
    } else if (defaultWarehouseId != null && defaultWarehouseId > 0) {
      const wh = await prisma.warehouse.findFirst({
        where: { id: defaultWarehouseId, tenant_id: tenantId }
      });
      whId = wh?.id ?? null;
      if (whId == null) {
        errors.push(`Строка ${r}: выбранный для импорта склад не найден`);
        continue;
      }
    } else {
      errors.push(
        `Строка ${r}: заполните столбец «Склад» или выберите склад перед импортом (шаблон «Поступление»)`
      );
      continue;
    }

    if (!skuCell && !bcCell) {
      errors.push(`Строка ${r}: нужен «Код товара» / SKU или штрихкод`);
      continue;
    }

    const product = await resolveProductForImport(tenantId, skuCell, bcCell);
    if (!product) {
      errors.push(`Строка ${r}: товар не найден (SKU: «${skuCell}», штрихкод: «${bcCell}»)`);
      continue;
    }

    if (categoryCell && product.categoryName) {
      if (product.categoryName.trim().toLowerCase() !== categoryCell.trim().toLowerCase()) {
        warnings.push(
          `Строка ${r}: «Категория» не совпадает с категорией в базе (${product.sku})`
        );
      }
    }
    if (nameCell && product.name.trim().toLowerCase() !== nameCell.trim().toLowerCase()) {
      warnings.push(
        `Строка ${r}: название «Продукт» не совпадает с названием в базе (${product.sku})`
      );
    }
    if (bcCell && product.barcode && product.barcode.trim() !== bcCell.trim()) {
      warnings.push(`Строка ${r}: штрихкод не совпадает со штрихкодом в базе (${product.sku})`);
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
