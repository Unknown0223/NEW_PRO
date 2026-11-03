/**
 * SalesDoctor zakazidagi agent va ekspeditorni bo'sh qolgan hujjatlarga yozadi.
 * Kod bo'yicha (PMAND009), topilmasa filial ichidagi ism bo'yicha.
 * npx tsx scripts/fix-salesdoc-order-agents.ts
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/database";

const TENANT = 1;
const ROOT = "D:/salesdoc-pull";
const DEALERS = [
  { dir: "andijon", code: "001", vans: true, hint: "andij" },
  { dir: "namangan", code: "f2-WH", vans: false, hint: "namang" },
  { dir: "qoqon", code: "f5-WH", vans: false, hint: "qoqon" },
  { dir: "fargona", code: "f6-WH", vans: false, hint: "farg" },
  { dir: "xorazm", code: "f7-WH", vans: false, hint: "xoraz" },
  { dir: "nukus", code: "f8-WH", vans: false, hint: "nukus" },
  { dir: "samarqand", code: "f9-WH", vans: false, hint: "samar" },
  { dir: "buxoro", code: "f10-WH", vans: false, hint: "buxor" },
  { dir: "navoiy", code: "f11-WH", vans: false, hint: "navoi" }
] as const;

type Person = { id: string; name: string; code?: string };
type UserRow = { id: number; name: string; code: string | null; branch: string | null; role: string };

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

function bareNumber(sdId: string): string {
  const tail = sdId.split("_").pop() ?? sdId;
  return /^\d+$/.test(tail) ? tail : "";
}

function loadPeople(file: string, key: "agents" | "expeditors"): Person[] {
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { agents?: Person[]; expeditors?: Person[] };
  return (raw[key] ?? []).filter((p) => p.id && p.name);
}

function indexUsers(rows: UserRow[]) {
  const byCode = new Map<string, UserRow>();
  const byName = new Map<string, UserRow[]>();
  for (const row of rows) {
    const code = row.code?.trim();
    if (code && !byCode.has(code)) byCode.set(code, row);
    const name = norm(row.name);
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push(row);
    byName.set(name, list);
  }
  return { byCode, byName };
}

function resolveUser(
  person: Person | undefined,
  hint: string,
  index: ReturnType<typeof indexUsers>
): number {
  if (!person) return 0;
  const code = person.code?.trim();
  if (code && index.byCode.has(code)) return index.byCode.get(code)!.id;
  const hits = index.byName.get(norm(person.name)) ?? [];
  const inBranch = hits.filter((u) => norm(u.branch ?? "").includes(hint));
  const pool = inBranch.length > 0 ? inBranch : hits.length === 1 ? hits : [];
  const ranked = [...pool].sort((a, b) => Number(b.role === "agent" || b.role === "expeditor") - Number(a.role === "agent" || a.role === "expeditor"));
  return ranked[0]?.id ?? 0;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { tenant_id: TENANT },
    select: { id: true, name: true, code: true, branch: true, role: true }
  });
  const index = indexUsers(users);
  let agentsFilled = 0;
  let expsFilled = 0;

  for (const dealer of DEALERS) {
    const staffPath = path.join(ROOT, dealer.dir, "08-xodim", "staff.json");
    const ordersPath = path.join(ROOT, dealer.dir, "09-zakaz", "orders.json");
    if (!fs.existsSync(ordersPath)) continue;
    const agents = new Map(loadPeople(staffPath, "agents").map((p) => [p.id, p]));
    const exps = new Map(loadPeople(staffPath, "expeditors").map((p) => [p.id, p]));
    const data = JSON.parse(fs.readFileSync(ordersPath, "utf8")) as { orders: string[][] };
    const header = data.orders[0] ?? [];
    const col = (name: string) => header.indexOf(name);
    const byNumber = new Map<string, { agent: number; exp: number }>();
    let missed = 0;
    for (let i = 1; i < data.orders.length; i++) {
      const row = data.orders[i] ?? [];
      const num = bareNumber(String(row[col("id")] ?? ""));
      if (!num) continue;
      const agent = resolveUser(agents.get(String(row[col("agent_id")] ?? "")), dealer.hint, index);
      const exp = resolveUser(exps.get(String(row[col("expeditor_id")] ?? "")), dealer.hint, index);
      if (!agent && row[col("agent_id")]) missed += 1;
      if (!agent && !exp) continue;
      byNumber.set(num, { agent, exp });
    }
    const wh = await prisma.warehouse.findMany({
      where: {
        tenant_id: TENANT,
        OR: [{ code: dealer.code }, ...(dealer.vans ? [{ code: { startsWith: "SD-d0_" } }] : [])]
      },
      select: { id: true }
    });
    const docs = await prisma.order.findMany({
      where: { tenant_id: TENANT, warehouse_id: { in: wh.map((w) => w.id) }, OR: [{ agent_id: null }, { expeditor_user_id: null }] },
      select: { id: true, number: true, agent_id: true, expeditor_user_id: true }
    });
    const ids: number[] = [];
    const agentIds: number[] = [];
    const expIds: number[] = [];
    for (const doc of docs) {
      const hit = byNumber.get(doc.number);
      if (!hit) continue;
      const agent = doc.agent_id == null ? hit.agent : 0;
      const exp = doc.expeditor_user_id == null ? hit.exp : 0;
      if (!agent && !exp) continue;
      ids.push(doc.id);
      agentIds.push(agent);
      expIds.push(exp);
      if (agent) agentsFilled += 1;
      if (exp) expsFilled += 1;
    }
    for (let i = 0; i < ids.length; i += 2000) {
      const slice = [ids.slice(i, i + 2000), agentIds.slice(i, i + 2000), expIds.slice(i, i + 2000)] as const;
      await prisma.$executeRaw`
        UPDATE orders AS o
        SET agent_id = CASE WHEN v.agent <> 0 THEN v.agent ELSE o.agent_id END,
            expeditor_user_id = CASE WHEN v.exp <> 0 THEN v.exp ELSE o.expeditor_user_id END
        FROM unnest(${slice[0]}::int[], ${slice[1]}::int[], ${slice[2]}::int[]) AS v(id, agent, exp)
        WHERE o.id = v.id AND o.tenant_id = ${TENANT}
      `;
    }
    console.log(`${dealer.dir} docs=${docs.length} write=${ids.length} missedAgent=${missed}`);
  }
  console.log(`filled agents=${agentsFilled} expeditors=${expsFilled}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
