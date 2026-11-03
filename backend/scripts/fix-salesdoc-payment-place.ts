/**
 * To‘lovni o‘z agentiga va zakaziga bog‘laydi.
 * VAKANT kod egasiga yozilgan zakazni haqiqiy agentga qaytaradi.
 * npx tsx scripts/fix-salesdoc-payment-place.ts
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/database";

const TENANT = 1;
const ROOT = "D:/salesdoc-pull";
const DEALERS = [
  { dir: "andijon", code: "001", vans: true, hint: "andij", dealerId: 1 },
  { dir: "namangan", code: "f2-WH", vans: false, hint: "namang", dealerId: 2 },
  { dir: "qoqon", code: "f5-WH", vans: false, hint: "qoqon", dealerId: 5 },
  { dir: "fargona", code: "f6-WH", vans: false, hint: "farg", dealerId: 6 },
  { dir: "xorazm", code: "f7-WH", vans: false, hint: "xoraz", dealerId: 7 },
  { dir: "nukus", code: "f8-WH", vans: false, hint: "nukus", dealerId: 8 },
  { dir: "samarqand", code: "f9-WH", vans: false, hint: "samar", dealerId: 9 },
  { dir: "buxoro", code: "f10-WH", vans: false, hint: "buxor", dealerId: 10 },
  { dir: "navoiy", code: "f11-WH", vans: false, hint: "navoi", dealerId: 11 }
] as const;

type Person = { id: string; name: string; code?: string };
type UserRow = { id: number; name: string; code: string | null; role: string; wh: string };

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/g['’`ʻʼ]/gi, "g")
    .replace(/o['’`ʻʼ]/gi, "o")
    .replace(/['’`ʻʼ]/g, "")
    .replace(/ё/g, "e")
    .replace(/\s+/g, " ")
    .trim();
}

function isVacant(name: string): boolean {
  const n = norm(name);
  return n === "vakant" || n === "vacant" || n.startsWith("vakant") || n.startsWith("vacant") || n.includes("vakans");
}

function bare(sdId: string): string {
  const tail = String(sdId).split("_").pop() ?? "";
  return /^\d+$/.test(tail) ? tail : "";
}

function loadAgents(dir: string): Map<string, Person> {
  const file = path.join(ROOT, dir, "08-xodim", "staff.json");
  if (!fs.existsSync(file)) return new Map();
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { agents?: Person[] };
  return new Map((raw.agents ?? []).filter((p) => p.id && p.name).map((p) => [p.id, p]));
}

function loadCash(dir: string): Array<{ id: string; agentId: string; orderId: string }> {
  const folder = path.join(ROOT, dir, "06-pul");
  if (!fs.existsSync(folder)) return [];
  const out: Array<{ id: string; agentId: string; orderId: string }> = [];
  for (const name of fs.readdirSync(folder)) {
    if (!name.startsWith("cash-")) continue;
    const rows = JSON.parse(fs.readFileSync(path.join(folder, name), "utf8")) as Array<{ value?: string[] }>;
    const header = rows[0]?.value ?? [];
    const at = (key: string, fallback: number) => {
      const i = header.indexOf(key);
      return i >= 0 ? i : fallback;
    };
    const iId = at("client_trans_id", 1);
    const iSum = at("summa", 3);
    const iAgent = at("agent_id", 6);
    const iOrder = at("order_id", 14);
    for (let i = 1; i < rows.length; i++) {
      const v = rows[i]?.value;
      if (!v?.[iId] || !(Number(v[iSum]) > 0)) continue;
      out.push({ id: String(v[iId]), agentId: String(v[iAgent] ?? ""), orderId: String(v[iOrder] ?? "") });
    }
  }
  return out;
}

function resolveUser(person: Person | undefined, hint: string, users: UserRow[]): number {
  if (!person || isVacant(person.name)) return 0;
  const name = norm(person.name);
  const code = person.code?.trim();
  const byStaffCode = code ? users.find((u) => u.code === code && !isVacant(u.name)) : undefined;
  if (byStaffCode) return byStaffCode.id;
  const hits = users.filter((u) => norm(u.name) === name && !isVacant(u.name));
  const inBranch = hits.filter((u) => u.wh.includes(hint) || norm(u.wh).includes(hint));
  const pool = inBranch.length > 0 ? inBranch : hits;
  const ranked = [...pool].sort((a, b) => {
    const role = Number(b.role === "agent" || b.role === "expeditor") - Number(a.role === "agent" || a.role === "expeditor");
    if (role) return role;
    const dup = Number(a.code?.startsWith("d0_") || a.code?.startsWith("sd-")) - Number(b.code?.startsWith("d0_") || b.code?.startsWith("sd-"));
    return dup;
  });
  return ranked[0]?.id ?? 0;
}

async function main() {
  const userRows = await prisma.user.findMany({
    where: { tenant_id: TENANT },
    select: { id: true, name: true, code: true, role: true, warehouse: { select: { code: true } } }
  });
  const users: UserRow[] = userRows.map((u) => ({
    id: u.id,
    name: u.name,
    code: u.code,
    role: u.role,
    wh: u.warehouse?.code ?? ""
  }));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  let ordersFixed = 0;
  let agentsFilled = 0;
  let ordersLinked = 0;

  for (const dealer of DEALERS) {
    const agents = loadAgents(dealer.dir);
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
      select: { id: true, number: true, warehouse_id: true, agent_id: true }
    });
    const byNumber = new Map<string, Array<{ id: number; warehouse_id: number | null }>>();
    for (const doc of docs) {
      const list = byNumber.get(doc.number) ?? [];
      list.push(doc);
      byNumber.set(doc.number, list);
    }

    const ordersPath = path.join(ROOT, dealer.dir, "09-zakaz", "orders.json");
    const orderAgentIds: number[] = [];
    const orderNewAgents: number[] = [];
    if (fs.existsSync(ordersPath)) {
      const data = JSON.parse(fs.readFileSync(ordersPath, "utf8")) as { orders: string[][] };
      const header = data.orders[0] ?? [];
      const col = header.indexOf("agent_id");
      const idCol = header.indexOf("id");
      const sdAgent = new Map<string, number>();
      for (let i = 1; i < data.orders.length; i++) {
        const row = data.orders[i] ?? [];
        const num = bare(String(row[idCol] ?? ""));
        const uid = resolveUser(agents.get(String(row[col] ?? "")), dealer.hint, users);
        if (num && uid) sdAgent.set(num, uid);
      }
      for (const doc of docs) {
        const uid = sdAgent.get(doc.number);
        if (!uid || uid === doc.agent_id) continue;
        const current = doc.agent_id ? userName.get(doc.agent_id) ?? "" : "";
        if (doc.agent_id != null && !isVacant(current)) continue;
        orderAgentIds.push(doc.id);
        orderNewAgents.push(uid);
      }
    }
    for (let i = 0; i < orderAgentIds.length; i += 2000) {
      const ids = orderAgentIds.slice(i, i + 2000);
      const ags = orderNewAgents.slice(i, i + 2000);
      await prisma.$executeRaw`
        UPDATE orders AS o
        SET agent_id = v.ag
        FROM unnest(${ids}::int[], ${ags}::int[]) AS v(id, ag)
        WHERE o.id = v.id AND o.tenant_id = ${TENANT}
      `;
    }
    ordersFixed += orderAgentIds.length;

    const cash = loadCash(dealer.dir);
    const payAgent = new Map<string, number>();
    const payOrder = new Map<string, number>();
    for (const row of cash) {
      const keys = [row.id];
      if (![1, 2, 5].includes(dealer.dealerId)) keys.push(`f${dealer.dealerId}-${row.id}`);
      const uid = resolveUser(agents.get(row.agentId), dealer.hint, users);
      const orderNum = bare(row.orderId);
      let orderId = 0;
      if (orderNum) {
        const matches = byNumber.get(orderNum) ?? [];
        const chosen =
          matches.length === 1 ? matches[0] : matches.find((m) => m.warehouse_id != null && mainIds.has(m.warehouse_id));
        orderId = chosen?.id ?? 0;
      }
      for (const key of keys) {
        if (uid) payAgent.set(key, uid);
        if (orderId) payOrder.set(key, orderId);
      }
    }
    const numbers = [...new Set([...payAgent.keys(), ...payOrder.keys()])];
    let payWrite = 0;
    for (let i = 0; i < numbers.length; i += 5000) {
      const chunk = numbers.slice(i, i + 5000);
      const pays = await prisma.payment.findMany({
        where: { tenant_id: TENANT, deleted_at: null, number: { in: chunk } },
        select: { id: true, number: true, ledger_agent_id: true, order_id: true }
      });
      const ids: number[] = [];
      const ags: number[] = [];
      const oids: number[] = [];
      for (const pay of pays) {
        const num = pay.number ?? "";
        const uid = payAgent.get(num) ?? 0;
        const oid = pay.order_id == null ? payOrder.get(num) ?? 0 : 0;
        const current = pay.ledger_agent_id ? userName.get(pay.ledger_agent_id) ?? "" : "";
        const setAgent = uid > 0 && uid !== pay.ledger_agent_id && (pay.ledger_agent_id == null || isVacant(current));
        if (!setAgent && !oid) continue;
        ids.push(pay.id);
        ags.push(setAgent ? uid : 0);
        oids.push(oid);
        if (setAgent) agentsFilled += 1;
        if (oid) ordersLinked += 1;
      }
      if (!ids.length) continue;
      payWrite += ids.length;
      await prisma.$executeRaw`
        UPDATE client_payments AS p
        SET ledger_agent_id = CASE WHEN v.ag <> 0 THEN v.ag ELSE p.ledger_agent_id END,
            order_id = CASE WHEN p.order_id IS NULL AND v.oid <> 0 THEN v.oid ELSE p.order_id END
        FROM unnest(${ids}::int[], ${ags}::int[], ${oids}::int[]) AS v(id, ag, oid)
        WHERE p.id = v.id AND p.tenant_id = ${TENANT}
      `;
    }
    console.log(`${dealer.dir} orders=${orderAgentIds.length} payments=${payWrite}`);
  }

  console.log(`done ordersFixed=${ordersFixed} agentsFilled=${agentsFilled} ordersLinked=${ordersLinked}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
