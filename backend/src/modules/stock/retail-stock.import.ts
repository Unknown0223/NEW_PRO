import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


import { parseImportDateCell } from "./retail-stock.helpers";
import {
  headerIndexByAliases,
  normalizeHeader,
  numFromCell,
  resolveClientId,
  resolveProductId,
  strFromCell,
  type RetailImportResult
} from "./retail-stock.import-helpers";

export async function importRetailStockFromXlsx(
  tenantId: number,
  buf: Buffer,
  actorUserId: number | null,
  fileName: string
): Promise<RetailImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(buf) as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) return { applied: 0, errors: ["Sheet topilmadi"] };
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, idx) => headers.set(normalizeHeader(strFromCell(cell)), idx));
  const idx = {
    date: headerIndexByAliases(headers, ["Дата", "Sana"]),
    client: headerIndexByAliases(headers, ["Клиент", "TT", "Торговая точка", "Do'kon"]),
    product: headerIndexByAliases(headers, ["Продукт", "Товар", "SKU", "Код товара"]),
    qty: headerIndexByAliases(headers, ["Количество", "Кол-во", "Qoldiq", "Остаток"]),
    sold: headerIndexByAliases(headers, ["Кол-во (продажа)", "Продажа", "Sotuv", "Sold"]),
    price: headerIndexByAliases(headers, ["Цена", "Narx"]),
    amount: headerIndexByAliases(headers, ["Сумма", "Summa"]),
    priceType: headerIndexByAliases(headers, ["Тип цены", "Price type"]),
    volume: headerIndexByAliases(headers, ["Объем", "Hajm", "Объём"]),
    comment: headerIndexByAliases(headers, ["Комментарий", "Izoh"])
  };
  if (!idx.date || !idx.client || !idx.product || !idx.qty) {
    return { applied: 0, errors: ["Majburiy ustunlar: Дата, Клиент, Продукт, Количество"] };
  }

  let applied = 0;
  const errors: string[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const dateRaw = idx.date ? strFromCell(row.getCell(idx.date)) : "";
    const clientRaw = strFromCell(row.getCell(idx.client));
    const productRaw = strFromCell(row.getCell(idx.product));
    const qty = numFromCell(row.getCell(idx.qty));
    const sold = idx.sold ? numFromCell(row.getCell(idx.sold)) ?? 0 : 0;
    const price = idx.price ? numFromCell(row.getCell(idx.price)) : null;
    const amountCell = idx.amount ? numFromCell(row.getCell(idx.amount)) : null;
    if (!dateRaw && !clientRaw && !productRaw && qty == null) continue;
    const date = idx.date ? parseImportDateCell(row.getCell(idx.date)) : null;
    if (!date) {
      errors.push(`Qator ${r}: sana noto‘g‘ri`);
      continue;
    }
    if (qty == null || qty < 0) {
      errors.push(`Qator ${r}: количество noto‘g‘ri`);
      continue;
    }
    const clientId = await resolveClientId(tenantId, clientRaw);
    if (!clientId) {
      errors.push(`Qator ${r}: klient topilmadi (${clientRaw})`);
      continue;
    }
    const productId = await resolveProductId(tenantId, productRaw);
    if (!productId) {
      errors.push(`Qator ${r}: product topilmadi (${productRaw})`);
      continue;
    }
    const client = await prisma.client.findFirst({
      where: { tenant_id: tenantId, id: clientId },
      select: { region: true, zone: true, city: true, agent_id: true }
    });
    if (!client) {
      errors.push(`Qator ${r}: klient topilmadi (${clientRaw})`);
      continue;
    }
    const amount = amountCell ?? (price != null ? price * qty : null);
    await prisma.retailOutletStock.upsert({
      where: {
        tenant_id_stock_date_client_id_product_id: {
          tenant_id: tenantId,
          stock_date: date,
          client_id: clientId,
          product_id: productId
        }
      },
      update: {
        quantity: new Prisma.Decimal(qty),
        sold_quantity: new Prisma.Decimal(sold),
        amount: amount != null ? new Prisma.Decimal(amount) : null,
        price_type: idx.priceType ? strFromCell(row.getCell(idx.priceType)).slice(0, 64) || null : null,
        volume: idx.volume ? strFromCell(row.getCell(idx.volume)).slice(0, 64) || null : null,
        comment: idx.comment ? strFromCell(row.getCell(idx.comment)).slice(0, 2000) || null : null,
        agent_id: client.agent_id ?? null,
        territory_1: client.region ?? null,
        territory_2: client.zone ?? null,
        territory_3: client.city ?? null
      },
      create: {
        tenant_id: tenantId,
        stock_date: date,
        client_id: clientId,
        product_id: productId,
        quantity: new Prisma.Decimal(qty),
        sold_quantity: new Prisma.Decimal(sold),
        amount: amount != null ? new Prisma.Decimal(amount) : null,
        price_type: idx.priceType ? strFromCell(row.getCell(idx.priceType)).slice(0, 64) || null : null,
        volume: idx.volume ? strFromCell(row.getCell(idx.volume)).slice(0, 64) || null : null,
        comment: idx.comment ? strFromCell(row.getCell(idx.comment)).slice(0, 2000) || null : null,
        agent_id: client.agent_id ?? null,
        territory_1: client.region ?? null,
        territory_2: client.zone ?? null,
        territory_3: client.city ?? null
      }
    });
    applied += 1;
  }

  await prisma.stockUpload.create({
    data: {
      tenant_id: tenantId,
      uploaded_by_user_id: actorUserId ?? undefined,
      file_name: fileName.slice(0, 512) || "retail-stock.xlsx",
      rows_total: Math.max(0, sheet.rowCount - 1),
      rows_applied: applied,
      errors_count: errors.length
    }
  });

  return { applied, errors };
}

