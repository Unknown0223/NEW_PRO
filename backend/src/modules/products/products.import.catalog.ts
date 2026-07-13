import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import { createProduct, updateProduct } from "./products.crud";
import type { CreateProductInput } from "./products.types";
import { CATALOG_IMPORT_TEMPLATE_HEADERS } from "./products.import.helpers";
import {
  allocateUniqueSku,
  cellText,
  formatCategoryImportError,
  headerToTemplateCol,
  parseNumLoose,
  resolveBrandIdByCode,
  resolveCatalogGroupIdByCode,
  resolveCategoryIdForImport,
  resolveSegmentIdByCode,
  type TemplateCol
} from "./products.import.helpers";
export async function importProductsFromCatalogTemplateXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  actorUserId: number | null = null
): Promise<{ created: number; updated: number; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { created: 0, updated: 0, errors: ["Varaq topilmadi"] };
  }

  const headerRow = sheet.getRow(1);
  const colByField: Partial<Record<TemplateCol, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const raw = String(cell.text ?? "").trim();
    if (!raw) return;
    const key = headerToTemplateCol(raw);
    if (key) colByField[key] = colNumber;
  });

  if (!colByField.name || !colByField.categoryName || !colByField.unitCode) {
    return {
      created: 0,
      updated: 0,
      errors: [
        "Шаблон: нужны колонки «Название», «Категория», «Единица измерения(код)». Скачайте шаблон с сервера."
      ]
    };
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row, colByField.name);
    if (!name) continue;

    const categoryName = cellText(row, colByField.categoryName);
    const unitCode = cellText(row, colByField.unitCode);
    if (!categoryName) {
      errors.push(`Строка ${r}: категория обязательна`);
      continue;
    }
    if (!unitCode) {
      errors.push(`Строка ${r}: «Единица измерения(код)» обязательна`);
      continue;
    }

    const categoryResolved = await resolveCategoryIdForImport(tenantId, categoryName);
    if (!categoryResolved.ok) {
      errors.push(formatCategoryImportError(r, categoryName, categoryResolved));
      continue;
    }
    const categoryId = categoryResolved.id;

    let codeVal = colByField.code ? cellText(row, colByField.code) : "";
    let sku = codeVal.trim();
    if (!sku) {
      sku = await allocateUniqueSku(tenantId, `IMP-${tenantId}-${r}-${Date.now().toString(36)}`);
    }

    const barcode = colByField.barcode ? cellText(row, colByField.barcode) || null : null;
    const hsRaw = colByField.hsCode ? cellText(row, colByField.hsCode) : "";
    const hs_code = hsRaw.trim().slice(0, 32) || null;

    let product_group_id: number | null = null;
    if (colByField.groupCode) {
      const g = cellText(row, colByField.groupCode);
      if (g) {
        product_group_id = await resolveCatalogGroupIdByCode(tenantId, g);
        if (product_group_id == null) {
          errors.push(`Строка ${r}: «Группа(код)» не найдена: «${g}»`);
          continue;
        }
      }
    }

    let segment_id: number | null = null;
    if (colByField.segmentCode) {
      const s = cellText(row, colByField.segmentCode);
      if (s) {
        segment_id = await resolveSegmentIdByCode(tenantId, s);
        if (segment_id == null) {
          errors.push(`Строка ${r}: «Сегмент(код)» не найден: «${s}»`);
          continue;
        }
      }
    }

    let brand_id: number | null = null;
    if (colByField.brandCode) {
      const b = cellText(row, colByField.brandCode);
      if (b) {
        brand_id = await resolveBrandIdByCode(tenantId, b);
        if (brand_id == null) {
          errors.push(`Строка ${r}: «Бренд(код)» не найден: «${b}»`);
          continue;
        }
      }
    }

    let sort_order: number | null = null;
    if (colByField.sortOrder) {
      const so = parseNumLoose(cellText(row, colByField.sortOrder));
      if (so != null) sort_order = Math.round(so);
    }

    const weight_kg =
      colByField.weightKg && cellText(row, colByField.weightKg)
        ? cellText(row, colByField.weightKg)
        : null;
    let qty_per_block: number | null = null;
    if (colByField.qtyBlock) {
      const q = parseNumLoose(cellText(row, colByField.qtyBlock));
      if (q != null) qty_per_block = Math.round(q);
    }

    const L =
      colByField.lengthM != null ? parseNumLoose(cellText(row, colByField.lengthM)) : null;
    const W =
      colByField.widthM != null ? parseNumLoose(cellText(row, colByField.widthM)) : null;
    const T =
      colByField.thicknessM != null ? parseNumLoose(cellText(row, colByField.thicknessM)) : null;

    let length_cm: string | null = null;
    let width_cm: string | null = null;
    let height_cm: string | null = null;
    let dimension_unit: string | null = null;
    if (L != null && L > 0) length_cm = String(L * 100);
    if (W != null && W > 0) width_cm = String(W * 100);
    if (T != null && T > 0) height_cm = String(T * 100);
    if (L != null || W != null || T != null) dimension_unit = "m";

    let volume_m3: string | null = null;
    if (L != null && W != null && T != null && L > 0 && W > 0 && T > 0) {
      volume_m3 = String(L * W * T);
    }

    const input: CreateProductInput = {
      sku,
      name,
      unit: unitCode.trim(),
      barcode,
      category_id: categoryId,
      is_active: true,
      product_group_id,
      brand_id,
      segment_id,
      hs_code,
      sort_order,
      weight_kg,
      qty_per_block,
      length_cm,
      width_cm,
      height_cm,
      dimension_unit,
      volume_m3
    };

    try {
      const existing = await prisma.product.findUnique({
        where: { tenant_id_sku: { tenant_id: tenantId, sku } }
      });
      if (existing) {
        await updateProduct(
          tenantId,
          existing.id,
          {
            name: input.name,
            unit: input.unit,
            barcode: input.barcode,
            category_id: input.category_id,
            product_group_id: input.product_group_id,
            brand_id: input.brand_id,
            segment_id: input.segment_id,
            hs_code: input.hs_code,
            sort_order: input.sort_order,
            weight_kg: input.weight_kg,
            qty_per_block: input.qty_per_block,
            length_cm: input.length_cm,
            width_cm: input.width_cm,
            height_cm: input.height_cm,
            dimension_unit: input.dimension_unit,
            volume_m3: input.volume_m3
          },
          actorUserId
        );
        updated += 1;
      } else {
        await createProduct(tenantId, input, actorUserId);
        created += 1;
      }
    } catch (e) {
      errors.push(`Строка ${r}: ${e instanceof Error ? e.message : "ошибка сохранения"}`);
    }
  }

  if (created > 0 || updated > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.product,
      entityId: "bulk",
      action: "import.catalog_xlsx",
      payload: { created, updated, error_count: errors.length }
    });
  }

  return { created, updated, errors };
}

/** Joriy katalogni shablon ustunlari tartibida eksport (yangilash uchun) */
export async function exportTenantCatalogProductsXlsx(tenantId: number): Promise<Buffer> {
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId },
    include: {
      category: { select: { name: true } },
      product_group: { select: { code: true } },
      brand: { select: { code: true } },
      segment: { select: { code: true } }
    },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  sheet.addRow([...CATALOG_IMPORT_TEMPLATE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F4F2" }
  };

  for (const p of products) {
    const L =
      p.length_cm != null && p.length_cm.gt(0)
        ? Number(p.length_cm.toString()) / 100
        : "";
    const W =
      p.width_cm != null && p.width_cm.gt(0) ? Number(p.width_cm.toString()) / 100 : "";
    const T =
      p.height_cm != null && p.height_cm.gt(0) ? Number(p.height_cm.toString()) / 100 : "";
    sheet.addRow([
      p.name,
      p.sku,
      p.category?.name ?? "",
      p.unit,
      p.product_group?.code ?? "",
      p.segment?.code ?? "",
      p.barcode ?? "",
      p.hs_code ?? "",
      p.brand?.code ?? "",
      p.sort_order ?? "",
      p.weight_kg != null ? p.weight_kg.toString() : "",
      p.qty_per_block ?? "",
      L === "" ? "" : L,
      W === "" ? "" : W,
      T === "" ? "" : T
    ]);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
