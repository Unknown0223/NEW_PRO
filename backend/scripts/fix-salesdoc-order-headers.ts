/**
 * SalesDoctor zakaz ro‘yxatidagi raqam, tur, holat va soatni lokalga yozadi.
 * Raqam ekrandagidek: d0_9898 → 9898.
 * npx tsx scripts/fix-salesdoc-order-headers.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { salesDocInstant } from "./lib/salesdoc-andijon-time";

const TENANT = 1;
const ROOT = "D:/salesdoc-pull";
const DEALERS = [
  { id: "1", dir: "andijon", code: "001", vans: true },
  { id: "2", dir: "namangan", code: "f2-WH", vans: false },
  { id: "5", dir: "qoqon", code: "f5-WH", vans: false },
  { id: "6", dir: "fargona", code: "f6-WH", vans: false },
  { id: "7", dir: "xorazm", code: "f7-WH", vans: false },
  { id: "8", dir: "nukus", code: "f8-WH", vans: false },
  { id: "9", dir: "samarqand", code: "f9-WH", vans: false },
  { id: "10", dir: "buxoro", code: "f10-WH", vans: false },
  { id: "11", dir: "navoiy", code: "f11-WH", vans: false }
] as const;

const TYPE: Record<string, string> = { "1": "order", "2": "return", "3": "exchange", "4": "order" };
const STATUS: Record<string, string> = {
  "1": "new",
  "2": "delivering",
  "3": "delivered",
  "4": "returned",
  "5": "cancelled",
  "10": "new",
  "11": "confirmed",
  "12": "cancelled",
  "13": "delivered"
};

type Row = unknown[];
type Pack = { orders?: Row[]; sales?: Row[]; defects?: Row[]; replaces?: Row[] };
type Doc = {
  sdId: string;
  number: string;
  type: string;
  status: string;
  date: string;
  clientId: string;
  comment: string;
  sum: number;
  lines: { productId: string; qty: number; sum: number }[];
};

function bareNumber(sdId: string): string {
  const tail = sdId.split("_").pop() ?? sdId;
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) ? String(n) : sdId.slice(0, 64);
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function indexMap(header: Row): Map<string, number> {
  return new Map(header.map((name, i) => [String(name), i]));
}

function loadDocs(file: string): Doc[] {
  const pack = JSON.parse(fs.readFileSync(file, "utf8")) as Pack;
  const orders = pack.orders ?? [];
  if (orders.length < 2) return [];
  const col = indexMap(orders[0]);
  const at = (row: Row, name: string) => row[col.get(name) ?? -1];
  const sales = lineMap(pack.sales);
  const defects = lineMap(pack.defects);
  const replaces = lineMap(pack.replaces);
  const docs: Doc[] = [];
  for (let i = 1; i < orders.length; i++) {
    const row = orders[i];
    const sdId = String(at(row, "id") ?? "");
    const type = TYPE[String(at(row, "type") ?? "")] ?? "order";
    const status = STATUS[String(at(row, "status") ?? "")] ?? "delivered";
    if (!sdId) continue;
    const own = (type === "return" ? defects : type === "exchange" ? replaces : sales).get(sdId) ?? [];
    const sum = Math.round(own.reduce((s, line) => s + line.sum, 0) * 100) / 100;
    docs.push({
      sdId,
      number: bareNumber(sdId),
      type,
      status,
      date: String(at(row, "date") ?? ""),
      clientId: String(at(row, "client_id") ?? ""),
      comment: String(at(row, "comment") ?? "").slice(0, 500),
      sum,
      lines: type === "order" ? own : own
    });
  }
  return docs;
}

function lineMap(table: Row[] | undefined): Map<string, Doc["lines"]> {
  const lines = new Map<string, Doc["lines"]>();
  if (!table || table.length < 2) return lines;
  const c = indexMap(table[0]);
  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    const id = String(row[c.get("order_id") ?? 0] ?? "");
    const productId = String(row[c.get("product_id") ?? 1] ?? "");
    const qty = num(row[c.get("count") ?? 2]);
    const sum = Math.abs(num(row[c.get("summa") ?? 3]));
    if (!id || !productId || !qty) continue;
    const list = lines.get(id) ?? [];
    list.push({ productId, qty, sum });
    lines.set(id, list);
  }
  return lines;
}

function aliases(dealerId: string, sdId: string, number: string): string[] {
  return [...new Set([sdId, `${number}`, `f${dealerId}-${sdId}`, `f${dealerId}-${number}`])];
}

async function warehouseIds(code: string, vans: boolean): Promise<number[]> {
  const main = await prisma.warehouse.findFirst({ where: { tenant_id: TENANT, code }, select: { id: true } });
  if (!main) return [];
  if (!vans) return [main.id];
  const extra = await prisma.warehouse.findMany({
    where: { tenant_id: TENANT, code: { startsWith: "SD-" } },
    select: { id: true }
  });
  return [main.id, ...extra.map((w) => w.id)];
}

async function applyDealer(dealer: (typeof DEALERS)[number]) {
  const file = path.join(ROOT, dealer.dir, "09-zakaz", "orders.json");
  if (!fs.existsSync(file)) throw new Error(`yoq ${file}`);
  const docs = loadDocs(file);
  const ids = await warehouseIds(dealer.code, dealer.vans);
  const mainId = ids[0];
  if (!mainId) throw new Error(`ombor yoq ${dealer.code}`);
  const existing = await prisma.order.findMany({
    where: { tenant_id: TENANT, warehouse_id: { in: ids } },
    select: { id: true, number: true, warehouse_id: true }
  });
  const byKey = new Map<string, { id: number; warehouse_id: number }[]>();
  for (const row of existing) {
    const list = byKey.get(row.number) ?? [];
    list.push(row);
    byKey.set(row.number, list);
  }
  let updated = 0;
  let inserted = 0;
  const returnIds: number[] = [];
  const clients = await prisma.client.findMany({
    where: { tenant_id: TENANT, warehouse_id: mainId, client_code: { not: null } },
    select: { id: true, client_code: true }
  });
  const clientId = new Map(clients.map((c) => [c.client_code as string, c.id]));
  const products = await prisma.product.findMany({
    where: { tenant_id: TENANT, sell_code: { not: null } },
    select: { id: true, sell_code: true }
  });
  const productId = new Map(products.map((p) => [p.sell_code as string, p.id]));
  const fresh: Prisma.OrderCreateManyInput[] = [];
  const freshLines = new Map<string, Doc["lines"]>();
  for (const doc of docs) {
    const hits = aliases(dealer.id, doc.sdId, doc.number).flatMap((key) => byKey.get(key) ?? []);
    const seen = new Set<number>();
    if (hits.length === 0) {
      const cid = clientId.get(doc.clientId.slice(0, 32));
      if (!cid || byKey.has(doc.number)) continue;
      fresh.push({
        tenant_id: TENANT,
        number: doc.number,
        client_id: cid,
        warehouse_id: mainId,
        order_type: doc.type,
        status: doc.status,
        total_sum: doc.sum,
        comment: doc.comment || (doc.type === "return" ? "Возврат с полки" : null),
        created_at: salesDocInstant(doc.date || "2025-01-01"),
        payment_method_ref: "pm-naxt"
      });
      freshLines.set(doc.number, doc.lines);
      byKey.set(doc.number, [{ id: 0, warehouse_id: mainId }]);
      continue;
    }
    for (const hit of hits) {
      if (seen.has(hit.id) || hit.warehouse_id === 0) continue;
      seen.add(hit.id);
      await prisma.order.update({
        where: { id: hit.id },
        data: {
          number: doc.number,
          order_type: doc.type,
          status: doc.status,
          total_sum: doc.sum || undefined,
          created_at: doc.date ? salesDocInstant(doc.date) : undefined,
          comment: doc.type === "return" ? doc.comment || "Возврат с полки" : undefined
        }
      });
      if (doc.type === "return") returnIds.push(hit.id);
      updated += 1;
    }
  }
  for (let i = 0; i < fresh.length; i += 200) {
    inserted += (await prisma.order.createMany({ data: fresh.slice(i, i + 200) })).count;
  }
  if (fresh.length) {
    const saved = await prisma.order.findMany({
      where: { tenant_id: TENANT, warehouse_id: mainId, number: { in: [...freshLines.keys()] } },
      select: { id: true, number: true }
    });
    const items: Prisma.OrderItemCreateManyInput[] = [];
    for (const row of saved) {
      for (const line of freshLines.get(row.number) ?? []) {
        const pid = productId.get(line.productId);
        if (!pid) continue;
        items.push({
          order_id: row.id,
          product_id: pid,
          qty: line.qty,
          price: Math.round((line.sum / line.qty) * 100) / 100,
          total: line.sum
        });
      }
    }
    for (let i = 0; i < items.length; i += 500) {
      await prisma.orderItem.createMany({ data: items.slice(i, i + 500) });
    }
  }
  for (let i = 0; i < returnIds.length; i += 500) {
    const chunk = returnIds.slice(i, i + 500);
    await prisma.$executeRaw`
      UPDATE order_items
      SET total = ABS(total), price = ABS(price), qty = ABS(qty)
      WHERE order_id IN (${Prisma.join(chunk)})
        AND (total < 0 OR price < 0 OR qty < 0)
    `;
  }
  console.log(JSON.stringify({ branch: dealer.dir, docs: docs.length, updated, inserted }));
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { slug: true } });
  if (tenant?.slug !== "aksit") throw new Error("tenant aksit emas");
  for (const dealer of DEALERS) await applyDealer(dealer);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
