import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import { createProduct, updateProduct } from "./products.crud";
import type { CreateProductInput } from "./products.types";
import { headerToKey } from "./products.import.helpers";
import {
  normalizeProductDupKey,
  resolveExistingProductForImport,
  assertProductUniqueness
} from "./products.duplicates";

export async function createProductsBulk(
  tenantId: number,
  items: CreateProductInput[],
  actorUserId: number | null = null
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  const seenSku = new Set<string>();
  const seenName = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    try {
      const skuKey = normalizeProductDupKey(items[i].sku);
      const nameKey = normalizeProductDupKey(items[i].name);
      if (seenSku.has(skuKey)) {
        errors.push(`${i + 1}-qator: dublikat SKU «${items[i].sku}»`);
        continue;
      }
      if (seenName.has(nameKey)) {
        errors.push(`${i + 1}-qator: dublikat nom «${items[i].name}»`);
        continue;
      }
      seenSku.add(skuKey);
      seenName.add(nameKey);
      await createProduct(tenantId, items[i], actorUserId);
      created += 1;
    } catch (e) {
      errors.push(
        `${i + 1}-qator: ${e instanceof Error ? e.message : "xato"}`
      );
    }
  }
  if (created > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.product,
      entityId: "bulk",
      action: "create.bulk",
      payload: { created, error_count: errors.length }
    });
  }
  return { created, errors };
}

export async function importProductsFromXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  actorUserId: number | null = null
): Promise<{ created: number; updated: number; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  const nodeBuf = Buffer.from(buffer);
  await workbook.xlsx.load(nodeBuf as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { created: 0, updated: 0, errors: ["Varaq topilmadi"] };
  }

  const headerRow = sheet.getRow(1);
  const colIndexByKey: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const v = cell.text?.trim();
    if (!v) return;
    const key = headerToKey(v);
    if (key) colIndexByKey[key] = colNumber;
  });

  if (!colIndexByKey.sku || !colIndexByKey.name) {
    return {
      created: 0,
      updated: 0,
      errors: ["Birinchi qatorda majburiy ustunlar: SKU (yoki kod) va name (yoki nomi)"]
    };
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const seenSku = new Set<string>();
  const seenName = new Set<string>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sku = String(row.getCell(colIndexByKey.sku).text ?? "").trim();
    const name = String(row.getCell(colIndexByKey.name).text ?? "").trim();
    if (!sku && !name) continue;
    if (!sku || !name) {
      errors.push(`Qator ${r}: SKU va nom bo‘sh bo‘lmasligi kerak`);
      continue;
    }
    const skuKey = normalizeProductDupKey(sku);
    const nameKey = normalizeProductDupKey(name);
    if (seenSku.has(skuKey)) {
      errors.push(`Qator ${r}: dublikat SKU faylda «${sku}»`);
      continue;
    }
    if (seenName.has(nameKey)) {
      errors.push(`Qator ${r}: dublikat nom faylda «${name}»`);
      continue;
    }
    seenSku.add(skuKey);
    seenName.add(nameKey);

    const unitCell = colIndexByKey.unit ? row.getCell(colIndexByKey.unit).text : "";
    const unit = String(unitCell ?? "").trim() || "dona";
    const barcodeCell = colIndexByKey.barcode ? row.getCell(colIndexByKey.barcode).text : "";
    const barcode = String(barcodeCell ?? "").trim() || null;

    try {
      const existing = await resolveExistingProductForImport(tenantId, sku, name);
      if (existing) {
        await updateProduct(
          tenantId,
          existing.id,
          { name, unit, barcode, is_active: true, sku: existing.sku !== sku ? sku : undefined },
          actorUserId
        );
        updated += 1;
      } else {
        await assertProductUniqueness(tenantId, { sku, name, barcode });
        await prisma.product.create({
          data: {
            tenant_id: tenantId,
            sku,
            name,
            unit,
            barcode,
            is_active: true
          }
        });
        created += 1;
      }
    } catch (e) {
      errors.push(`Qator ${r}: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  if (created > 0 || updated > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.product,
      entityId: "bulk",
      action: "import.xlsx",
      payload: { created, updated, error_count: errors.length }
    });
  }

  return { created, updated, errors };
}
