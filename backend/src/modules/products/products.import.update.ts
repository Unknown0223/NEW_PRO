import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import { updateProduct } from "./products.crud";
import {
  cellText,
  formatCategoryImportError,
  mapTemplateHeaderRow,
  parseNumLoose,
  resolveBrandIdByCode,
  resolveCatalogGroupIdByCode,
  resolveCategoryIdForImport,
  resolveSegmentIdByCode
} from "./products.import.helpers";
import { decOpt, productListInclude } from "./products.shared";

function decEq(a: Prisma.Decimal | null | undefined, b: string | null | undefined): boolean {
  const sa = a == null ? "" : a.toString();
  const sb = b == null || b === "" ? "" : String(b);
  if (sa === sb) return true;
  const na = Number.parseFloat(sa.replace(",", "."));
  const nb = Number.parseFloat(sb.replace(",", "."));
  return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 1e-9;
}

function intEq(a: number | null | undefined, b: number | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Fayldagi qatorlar bo‘yicha faqat mavjud mahsulotlarni yangilaydi.
 * Faylda yo‘q qoldirilgan mahsulotlarga tegmaydi. SKU bazada yo‘q bo‘lsa — o‘tkazib yuboradi (yangi yaratmaydi).
 */
export async function importProductsCatalogUpdateOnlyXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  actorUserId: number | null = null
): Promise<{
  updated: number;
  skipped_empty: number;
  skipped_unknown_sku: number;
  skipped_no_change: number;
  errors: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      updated: 0,
      skipped_empty: 0,
      skipped_unknown_sku: 0,
      skipped_no_change: 0,
      errors: ["Varaq topilmadi"]
    };
  }

  const headerRow = sheet.getRow(1);
  const headerCells: { col: number; text: string }[] = [];
  headerRow.eachCell({ includeEmpty: true }, (_cell, colNumber) => {
    headerCells.push({ col: colNumber, text: cellText(headerRow, colNumber) });
  });
  const colByField = mapTemplateHeaderRow(headerCells);

  if (!colByField.code) {
    return {
      updated: 0,
      skipped_empty: 0,
      skipped_unknown_sku: 0,
      skipped_no_change: 0,
      errors: ["«Код» (SKU) ustuni majburiy — eksport faylidan foydalaning."]
    };
  }
  if (!colByField.name || !colByField.categoryName || !colByField.unitName) {
    return {
      updated: 0,
      skipped_empty: 0,
      skipped_unknown_sku: 0,
      skipped_no_change: 0,
      errors: [
        "Нужны колонки: Название, Категория, Единица измерения (название), Код — как в шаблоне/экспорте."
      ]
    };
  }

  let updated = 0;
  let skipped_empty = 0;
  let skipped_unknown_sku = 0;
  let skipped_no_change = 0;
  const errors: string[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sku = cellText(row, colByField.code).trim();
    if (!sku) {
      const nameProbe = cellText(row, colByField.name).trim();
      if (!nameProbe) {
        skipped_empty += 1;
        continue;
      }
      skipped_empty += 1;
      continue;
    }

    const existing = await prisma.product.findUnique({
      where: { tenant_id_sku: { tenant_id: tenantId, sku } }
    });
    if (!existing) {
      skipped_unknown_sku += 1;
      continue;
    }

    let name = cellText(row, colByField.name).trim();
    if (!name) name = existing.name;

    let unit = cellText(row, colByField.unitName).trim();
    if (!unit) unit = existing.unit;

    let category_id = existing.category_id;
    const catCell = cellText(row, colByField.categoryName).trim();
    if (catCell) {
      const resolved = await resolveCategoryIdForImport(tenantId, catCell);
      if (!resolved.ok) {
        errors.push(formatCategoryImportError(r, catCell, resolved));
        continue;
      }
      category_id = resolved.id;
    }

    let product_group_id: number | null = existing.product_group_id;
    if (colByField.groupCode !== undefined) {
      const g = cellText(row, colByField.groupCode).trim();
      if (!g) {
        product_group_id = null;
      } else {
        const gid = await resolveCatalogGroupIdByCode(tenantId, g);
        if (gid == null) {
          errors.push(`Строка ${r}: «Группа(код)» «${g}» не найдена`);
          continue;
        }
        product_group_id = gid;
      }
    }

    let segment_id: number | null = existing.segment_id;
    if (colByField.segmentCode !== undefined) {
      const s = cellText(row, colByField.segmentCode).trim();
      if (!s) {
        segment_id = null;
      } else {
        const sid = await resolveSegmentIdByCode(tenantId, s);
        if (sid == null) {
          errors.push(`Строка ${r}: «Сегмент(код)» «${s}» не найден`);
          continue;
        }
        segment_id = sid;
      }
    }

    let brand_id: number | null = existing.brand_id;
    if (colByField.brandCode !== undefined) {
      const b = cellText(row, colByField.brandCode).trim();
      if (!b) {
        brand_id = null;
      } else {
        const bid = await resolveBrandIdByCode(tenantId, b);
        if (bid == null) {
          errors.push(`Строка ${r}: «Бренд(код)» «${b}» не найден`);
          continue;
        }
        brand_id = bid;
      }
    }

    let barcode: string | null = existing.barcode;
    if (colByField.barcode !== undefined) {
      const bc = cellText(row, colByField.barcode).trim();
      barcode = bc === "" ? null : bc;
    }

    let hs_code: string | null = existing.hs_code;
    if (colByField.hsCode !== undefined) {
      const hs = cellText(row, colByField.hsCode).trim();
      hs_code = hs === "" ? null : hs.slice(0, 32);
    }

    let sort_order: number | null = existing.sort_order;
    if (colByField.sortOrder !== undefined) {
      const raw = cellText(row, colByField.sortOrder).trim();
      if (raw === "") {
        sort_order = null;
      } else {
        const so = parseNumLoose(raw);
        sort_order = so != null ? Math.round(so) : null;
      }
    }

    let weight_kg: string | null =
      existing.weight_kg != null ? existing.weight_kg.toString() : null;
    if (colByField.weightKg !== undefined) {
      const w = cellText(row, colByField.weightKg).trim();
      weight_kg = w === "" ? null : w;
    }

    let qty_per_block: number | null = existing.qty_per_block;
    if (colByField.qtyBlock !== undefined) {
      const raw = cellText(row, colByField.qtyBlock).trim();
      if (raw === "") {
        qty_per_block = null;
      } else {
        const q = parseNumLoose(raw);
        qty_per_block = q != null ? Math.round(q) : null;
      }
    }

    let length_cm: string | null =
      existing.length_cm != null ? existing.length_cm.toString() : null;
    let width_cm: string | null =
      existing.width_cm != null ? existing.width_cm.toString() : null;
    let height_cm: string | null =
      existing.height_cm != null ? existing.height_cm.toString() : null;
    let dimension_unit: string | null = existing.dimension_unit;
    let volume_m3: string | null =
      existing.volume_m3 != null ? existing.volume_m3.toString() : null;

    const hasDimCols =
      colByField.lengthM !== undefined ||
      colByField.widthM !== undefined ||
      colByField.thicknessM !== undefined;
    if (hasDimCols) {
      const L = colByField.lengthM ? parseNumLoose(cellText(row, colByField.lengthM)) : null;
      const W = colByField.widthM ? parseNumLoose(cellText(row, colByField.widthM)) : null;
      const T = colByField.thicknessM ? parseNumLoose(cellText(row, colByField.thicknessM)) : null;
      const any =
        (colByField.lengthM && cellText(row, colByField.lengthM).trim() !== "") ||
        (colByField.widthM && cellText(row, colByField.widthM).trim() !== "") ||
        (colByField.thicknessM && cellText(row, colByField.thicknessM).trim() !== "");
      if (!any) {
        length_cm = null;
        width_cm = null;
        height_cm = null;
        dimension_unit = null;
        volume_m3 = null;
      } else {
        length_cm = L != null && L > 0 ? String(L * 100) : null;
        width_cm = W != null && W > 0 ? String(W * 100) : null;
        height_cm = T != null && T > 0 ? String(T * 100) : null;
        dimension_unit = "m";
        if (L != null && W != null && T != null && L > 0 && W > 0 && T > 0) {
          volume_m3 = String(L * W * T);
        } else {
          volume_m3 = null;
        }
      }
    }

    const sameName = existing.name === name;
    const sameUnit = existing.unit === unit;
    const sameCat = existing.category_id === category_id;
    const sameGroup = existing.product_group_id === product_group_id;
    const sameSeg = existing.segment_id === segment_id;
    const sameBrand = existing.brand_id === brand_id;
    const sameBarcode = (existing.barcode ?? "") === (barcode ?? "");
    const sameHs = (existing.hs_code ?? "") === (hs_code ?? "");
    const sameSort = intEq(existing.sort_order, sort_order);
    const sameW = decEq(existing.weight_kg, weight_kg);
    const sameQty = intEq(existing.qty_per_block, qty_per_block);
    const sameLen = decEq(existing.length_cm, length_cm);
    const sameWid = decEq(existing.width_cm, width_cm);
    const sameHt = decEq(existing.height_cm, height_cm);
    const sameDimU = (existing.dimension_unit ?? "") === (dimension_unit ?? "");
    const sameVol = decEq(existing.volume_m3, volume_m3);
    const sameActive = existing.is_active === true;

    if (
      sameName &&
      sameUnit &&
      sameCat &&
      sameGroup &&
      sameSeg &&
      sameBrand &&
      sameBarcode &&
      sameHs &&
      sameSort &&
      sameW &&
      sameQty &&
      sameLen &&
      sameWid &&
      sameHt &&
      sameDimU &&
      sameVol &&
      sameActive
    ) {
      skipped_no_change += 1;
      continue;
    }

    try {
      await updateProduct(
        tenantId,
        existing.id,
        {
          name,
          unit,
          category_id,
          is_active: true,
          product_group_id,
          segment_id,
          brand_id,
          barcode,
          hs_code,
          sort_order,
          weight_kg,
          qty_per_block,
          length_cm,
          width_cm,
          height_cm,
          dimension_unit,
          volume_m3
        },
        actorUserId
      );
      updated += 1;
    } catch (e) {
      errors.push(`Строка ${r}: ${e instanceof Error ? e.message : "ошибка сохранения"}`);
    }
  }

  if (updated > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.product,
      entityId: "bulk",
      action: "import.catalog_update_only",
      payload: {
        updated,
        skipped_empty,
        skipped_unknown_sku,
        skipped_no_change,
        error_count: errors.length
      }
    });
  }

  return {
    updated,
    skipped_empty,
    skipped_unknown_sku,
    skipped_no_change,
    errors
  };
}
