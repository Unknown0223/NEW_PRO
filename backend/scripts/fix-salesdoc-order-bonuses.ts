/**
 * SalesDoctor zakaz bonus qatorlari (`orders.json` → bonuses).
 * To‘langan qatorga tegmaydi. Bonus narxi 0, dona `is_bonus` qatorda.
 * npx tsx scripts/fix-salesdoc-order-bonuses.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";

const TENANT = 1;
const ROOT = "D:/salesdoc-pull";
const DEALERS = [
  { dir: "andijon", code: "001", vans: true },
  { dir: "namangan", code: "f2-WH", vans: false },
  { dir: "qoqon", code: "f5-WH", vans: false },
  { dir: "fargona", code: "f6-WH", vans: false },
  { dir: "xorazm", code: "f7-WH", vans: false },
  { dir: "nukus", code: "f8-WH", vans: false },
  { dir: "samarqand", code: "f9-WH", vans: false },
  { dir: "buxoro", code: "f10-WH", vans: false },
  { dir: "navoiy", code: "f11-WH", vans: false }
] as const;

function bare(sdId: string): string {
  const tail = String(sdId).split("_").pop() ?? "";
  return /^\d+$/.test(tail) ? tail : "";
}

function productSkuBySd(dir: string): Map<string, string> {
  const file = path.join(ROOT, dir, "02-tovar", "products.json");
  const out = new Map<string, string>();
  if (!fs.existsSync(file)) return out;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    data?: Array<{ id?: string; code?: string }>;
  };
  for (const row of raw.data ?? []) {
    const id = String(row.id ?? "");
    const sku = String(row.code ?? "").trim();
    if (id && sku) out.set(id, sku);
  }
  return out;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sku: { not: "" } },
    select: { id: true, sku: true }
  });
  const productBySku = new Map(products.map((p) => [p.sku, p.id]));

  let inserted = 0;
  let skippedOrder = 0;
  let skippedProduct = 0;
  let skippedExists = 0;

  for (const dealer of DEALERS) {
    const file = path.join(ROOT, dealer.dir, "09-zakaz", "orders.json");
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { bonuses?: string[][] };
    const rows = data.bonuses ?? [];
    const skuBySd = productSkuBySd(dealer.dir);
    const wh = await prisma.warehouse.findMany({
      where: {
        tenant_id: TENANT,
        OR: [{ code: dealer.code }, ...(dealer.vans ? [{ code: { startsWith: "SD-d0_" } }] : [])]
      },
      select: { id: true, code: true }
    });
    const mainIds = new Set(wh.filter((w) => w.code === dealer.code).map((w) => w.id));
    const docs = await prisma.order.findMany({
      where: { tenant_id: TENANT, warehouse_id: { in: wh.map((w) => w.id) } },
      select: { id: true, number: true, warehouse_id: true }
    });
    const byNumber = new Map<string, Array<{ id: number; warehouse_id: number | null }>>();
    for (const doc of docs) {
      const list = byNumber.get(doc.number) ?? [];
      list.push(doc);
      byNumber.set(doc.number, list);
    }
    const existing = await prisma.orderItem.findMany({
      where: { is_bonus: true, order_id: { in: docs.map((d) => d.id) } },
      select: { order_id: true, product_id: true }
    });
    const have = new Set(existing.map((r) => `${r.order_id}:${r.product_id}`));

    const batch: Array<{ order_id: number; product_id: number; qty: Prisma.Decimal; price: Prisma.Decimal; total: Prisma.Decimal; is_bonus: boolean }> = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const num = bare(String(row[0] ?? ""));
      const qty = Number(row[3] ?? 0);
      if (!num || !(qty > 0)) continue;
      const matches = byNumber.get(num) ?? [];
      const chosen =
        matches.length === 1
          ? matches[0]
          : matches.find((m) => m.warehouse_id != null && mainIds.has(m.warehouse_id)) ?? null;
      if (!chosen) {
        skippedOrder += 1;
        continue;
      }
      const sku = skuBySd.get(String(row[1] ?? ""));
      const productId = sku ? productBySku.get(sku) : undefined;
      if (!productId) {
        skippedProduct += 1;
        continue;
      }
      const key = `${chosen.id}:${productId}`;
      if (have.has(key)) {
        skippedExists += 1;
        continue;
      }
      have.add(key);
      batch.push({
        order_id: chosen.id,
        product_id: productId,
        qty: new Prisma.Decimal(qty),
        price: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        is_bonus: true
      });
    }
    for (let i = 0; i < batch.length; i += 2000) {
      const chunk = batch.slice(i, i + 2000);
      const res = await prisma.orderItem.createMany({ data: chunk });
      inserted += res.count;
    }
    console.log(`${dealer.dir} bonus_rows=${Math.max(0, rows.length - 1)} write=${batch.length}`);
  }

  console.log(
    `done inserted=${inserted} skippedOrder=${skippedOrder} skippedProduct=${skippedProduct} skippedExists=${skippedExists}`
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
