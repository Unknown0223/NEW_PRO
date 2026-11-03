/**
 * Zakaz izohi va «kim yaratgan», to‘lov izohi va muallifi — SalesDoctor dan.
 * npx tsx scripts/fix-salesdoc-order-meta.ts
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/database";

const TENANT = 1;
const ROOT = "D:/salesdoc-pull";
const DEALERS = [
  { id: 1, dir: "andijon", code: "001", vans: true },
  { id: 2, dir: "namangan", code: "f2-WH", vans: false },
  { id: 5, dir: "qoqon", code: "f5-WH", vans: false },
  { id: 6, dir: "fargona", code: "f6-WH", vans: false },
  { id: 7, dir: "xorazm", code: "f7-WH", vans: false },
  { id: 8, dir: "nukus", code: "f8-WH", vans: false },
  { id: 9, dir: "samarqand", code: "f9-WH", vans: false },
  { id: 10, dir: "buxoro", code: "f10-WH", vans: false },
  { id: 11, dir: "navoiy", code: "f11-WH", vans: false }
] as const;

function bare(sdId: string): string {
  const tail = sdId.split("_").pop() ?? "";
  return /^\d+$/.test(tail) ? tail : "";
}

function clip(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function authorName(raw: string, users: Map<string, string>): string {
  const text = clip(raw);
  if (!text) return "";
  if (/^d0_/i.test(text)) return clip(users.get(text) ?? "");
  return text;
}

function loadUsers(file: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(file)) return out;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    users?: Array<{ id?: string; name?: string }>;
    agents?: Array<{ id?: string; name?: string }>;
    expeditors?: Array<{ id?: string; name?: string }>;
  };
  for (const list of [raw.users, raw.agents, raw.expeditors]) {
    for (const person of list ?? []) {
      if (person.id && person.name) out.set(person.id, person.name);
    }
  }
  return out;
}

async function writeOrders(ids: number[], comments: string[], authors: string[]) {
  for (let i = 0; i < ids.length; i += 1500) {
    const a = ids.slice(i, i + 1500);
    const b = comments.slice(i, i + 1500);
    const c = authors.slice(i, i + 1500);
    await prisma.$executeRaw`
      UPDATE orders AS o
      SET comment = CASE
            WHEN v.comment <> '' AND (o.comment IS NULL OR BTRIM(o.comment) = '' OR o.comment LIKE 'Возврат%')
            THEN v.comment ELSE o.comment END,
          source_created_by = CASE WHEN v.author <> '' THEN v.author ELSE o.source_created_by END
      FROM unnest(${a}::int[], ${b}::text[], ${c}::text[]) AS v(id, comment, author)
      WHERE o.id = v.id AND o.tenant_id = ${TENANT}
    `;
  }
}

async function writePayments(nums: string[], notes: string[], authors: string[]) {
  for (let i = 0; i < nums.length; i += 1500) {
    const a = nums.slice(i, i + 1500);
    const b = notes.slice(i, i + 1500);
    const c = authors.slice(i, i + 1500);
    await prisma.$executeRaw`
      UPDATE client_payments AS p
      SET note = CASE
            WHEN v.note <> '' AND (p.note IS NULL OR BTRIM(p.note) = '') THEN v.note ELSE p.note END,
          source_created_by = CASE WHEN v.author <> '' THEN v.author ELSE p.source_created_by END
      FROM unnest(${a}::text[], ${b}::text[], ${c}::text[]) AS v(num, note, author)
      WHERE p.tenant_id = ${TENANT} AND p.number = v.num AND p.deleted_at IS NULL
    `;
  }
}

async function main() {
  let orderWrites = 0;
  let payWrites = 0;
  for (const dealer of DEALERS) {
    const users = loadUsers(path.join(ROOT, dealer.dir, "08-xodim", "staff.json"));
    const ordersPath = path.join(ROOT, dealer.dir, "09-zakaz", "orders.json");
    const byNumber = new Map<string, { comment: string; author: string }>();
    if (fs.existsSync(ordersPath)) {
      const data = JSON.parse(fs.readFileSync(ordersPath, "utf8")) as { orders: string[][] };
      const header = data.orders[0] ?? [];
      const col = (name: string) => header.indexOf(name);
      for (let i = 1; i < data.orders.length; i++) {
        const row = data.orders[i] ?? [];
        const num = bare(String(row[col("id")] ?? ""));
        if (!num) continue;
        byNumber.set(num, {
          comment: clip(String(row[col("comment")] ?? "")),
          author: authorName(String(row[col("created_by")] ?? ""), users)
        });
      }
    }
    const wh = await prisma.warehouse.findMany({
      where: {
        tenant_id: TENANT,
        OR: [{ code: dealer.code }, ...(dealer.vans ? [{ code: { startsWith: "SD-d0_" } }] : [])]
      },
      select: { id: true }
    });
    const docs = await prisma.order.findMany({
      where: { tenant_id: TENANT, warehouse_id: { in: wh.map((w) => w.id) } },
      select: { id: true, number: true }
    });
    const ids: number[] = [];
    const comments: string[] = [];
    const authors: string[] = [];
    for (const doc of docs) {
      const hit = byNumber.get(doc.number);
      if (!hit || (!hit.comment && !hit.author)) continue;
      ids.push(doc.id);
      comments.push(hit.comment);
      authors.push(hit.author);
    }
    await writeOrders(ids, comments, authors);
    orderWrites += ids.length;

    const pay = new Map<string, { note: string; author: string }>();
    const pul = path.join(ROOT, dealer.dir, "06-pul");
    if (fs.existsSync(pul)) {
      for (const name of fs.readdirSync(pul)) {
        if (!name.startsWith("cash-") || name.startsWith("cash-clock")) continue;
        const rows = JSON.parse(fs.readFileSync(path.join(pul, name), "utf8")) as Array<{ value?: string[] }>;
        const header = (rows[0]?.value ?? []).map((h) => h.toLowerCase());
        const at = (key: string, fallback: number) => {
          const i = header.indexOf(key);
          return i >= 0 ? i : fallback;
        };
        const iId = at("client_trans_id", 1);
        const iUser = at("create_by", 10);
        const iComment = ["comment", "comment_2", "izoh", "prim"].map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
        for (let i = 1; i < rows.length; i++) {
          const v = rows[i]?.value;
          const id = String(v?.[iId] ?? "").trim();
          if (!id) continue;
          const note = iComment >= 0 ? clip(String(v?.[iComment] ?? "")) : "";
          const author = authorName(String(v?.[iUser] ?? ""), users);
          if (!note && !author) continue;
          const keys = dealer.id === 1 || dealer.id === 2 || dealer.id === 5 ? [id] : [id, `f${dealer.id}-${id}`];
          for (const key of keys) pay.set(key, { note, author });
        }
      }
    }
    const nums = [...pay.keys()];
    await writePayments(nums, nums.map((n) => pay.get(n)!.note), nums.map((n) => pay.get(n)!.author));
    payWrites += nums.length;
    console.log(`${dealer.dir} orders=${ids.length} payments=${nums.length}`);
  }
  console.log(`done orders=${orderWrites} payments=${payWrites}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
