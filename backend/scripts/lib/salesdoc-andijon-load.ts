/**
 * Andijon SalesDoc JSON (oldindan yuklangan papka) — faqat o‘qish.
 * Bo‘sh oylar (faqat sarlavha) tashlanadi. Foto yo‘q.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export const LIVE_CUTOFF = "2026-08-30";

export type SdProduct = { id: string; name: string; sku: string; categoryId: string; active: boolean };
export type SdClient = {
  id: string;
  name: string;
  firm: string;
  phone: string;
  agentCode: string;
  agentName: string;
  region: string;
  territory: string;
  address: string;
  landmark: string;
  category: string;
  active: boolean;
  inn: string;
  gps: string;
  createdAt: string;
};
export type SdOrderLine = {
  orderId: string;
  date: string;
  dateLoad: string;
  dateDeliver: string;
  qty: number;
  sum: number;
  productId: string;
  clientId: string;
  agentId: string;
  storeId: string;
  expId: string;
  comment: string;
};
export type SdCash = {
  id: string;
  clientId: string;
  sum: number;
  agentId: string;
  cashbox: string;
  userId: string;
  /** Manba qatori: `YYYY-MM-DD` yoki `YYYY-MM-DD HH:mm:ss`. */
  date: string;
  kind: string;
  orderId: string;
  /** Cash JSON sarlavhasida comment bo‘lsa. Hozirgi fayllarda bunday ustun yo‘q. */
  comment: string;
};
export type SdReturn = {
  orderId: string;
  productId: string;
  qty: number;
  sum: number;
  dealerId: string;
  dealerName: string;
};
export type SdBonus = {
  id: string;
  name: string;
  active: boolean;
  from: string | null;
  to: string | null;
  buy: number;
  free: number;
  products: string[];
  bonusProducts: string[];
  andijon: boolean;
  dealerIds: string[];
  inBlocks: boolean;
};

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
}

function files(dir: string, prefix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export type SdStaff = {
  agents: { id: string; name: string; code: string; phone: string; active: boolean; kind: string }[];
  expeditors: { id: string; name: string }[];
  supervisors: { id: string; name: string; code: string; agents: string[] }[];
  users: { id: string; name: string }[];
  stores: { id: string; name: string }[];
};

/** Diler kassa API (`finans/getData`): `doc_id` + `YYYY-MM-DD HH:mm:ss`. Izoh ustuni yo‘q. */
function readCashClocks(root: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files(path.join(root, "06-pul"), "cash-clock-")) {
    const rows = readJson(file) as unknown[];
    if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) continue;
    const header = (rows[0] as unknown[]).map((h) => String(h));
    const iId = header.indexOf("doc_id");
    const iDate = header.indexOf("date");
    if (iId < 0 || iDate < 0) continue;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || !row[iId]) continue;
      const date = String(row[iDate] ?? "").trim();
      if (/\d{2}:\d{2}/.test(date)) map.set(String(row[iId]), date);
    }
  }
  return map;
}

function readStaff(root: string): SdStaff {
  const file = path.join(root, "08-xodim", "staff.json");
  if (!fs.existsSync(file)) {
    throw new Error("08-xodim/staff.json yo‘q. pull-andijon.ps1 -Group 8");
  }
  const raw = readJson(file) as SdStaff;
  const id = (v: string) => String(v).replace(/^f1-/, "");
  return {
    agents: (raw.agents ?? []).map((a) => ({ ...a, id: id(a.id) })),
    expeditors: (raw.expeditors ?? []).map((a) => ({ ...a, id: id(a.id) })),
    supervisors: (raw.supervisors ?? []).map((a) => ({
      ...a,
      id: id(a.id),
      agents: (a.agents ?? []).map(id)
    })),
    users: (raw.users ?? []).map((a) => ({ ...a, id: id(a.id) })),
    stores: (raw.stores ?? []).map((a) => ({ ...a, id: id(a.id) }))
  };
}

export function loadSalesDoc(root: string, dealerName = "Andijon") {
  const productsRaw = readJson(path.join(root, "02-tovar", "products.json")) as {
    data?: Array<Record<string, unknown>>;
    categories?: Array<{ text: string; value: string }>;
  };
  const products: SdProduct[] = (productsRaw.data ?? []).map((p) => ({
    id: String(p.id ?? ""),
    name: String(p.name ?? "").slice(0, 300),
    sku: String(p.code || p.id || "").slice(0, 64),
    categoryId: String(p.category_id ?? ""),
    active: p.active !== false
  }));
  const categories = productsRaw.categories ?? [];

  const clientsRaw = readJson(path.join(root, "03-mijoz", "clients.json")) as { rows?: string[][] };
  const clients: SdClient[] = [];
  const namedAgents = new Map<string, string>();
  for (const row of clientsRaw.rows ?? []) {
    if (row[0] !== dealerName) continue;
    const id = String(row[1] ?? "").trim();
    if (!id) continue;
    const agentCode = String(row[5] ?? "").trim();
    const agentName = String(row[6] ?? "").trim();
    if (agentCode && agentName) namedAgents.set(agentCode, agentName);
    clients.push({
      id,
      name: String(row[2] ?? "").slice(0, 300) || id,
      firm: String(row[3] ?? "").slice(0, 300),
      phone: String(row[4] ?? "").slice(0, 64),
      agentCode,
      agentName,
      region: String(row[8] ?? "").slice(0, 120),
      territory: String(row[9] ?? "").slice(0, 120),
      address: String(row[10] ?? "").slice(0, 400),
      landmark: String(row[11] ?? "").slice(0, 300),
      category: String(row[12] ?? "").slice(0, 64),
      active: String(row[13] ?? "").toLowerCase().includes("актив") || String(row[13] ?? "") === "1",
      inn: String(row[17] ?? "").replace(/\s/g, "").slice(0, 32),
      gps: String(row[20] ?? ""),
      createdAt: String(row[21] ?? "")
    });
  }

  const lines: SdOrderLine[] = [];
  const saleAgents = new Set<string>();
  const expeditors = new Set<string>();
  const stores = new Set<string>();
  let skippedEmptyMonths = 0;
  for (const file of files(path.join(root, "05-buyurtma"), "sale-lines-")) {
    const rows = readJson(file) as unknown[];
    if (!Array.isArray(rows) || rows.length < 2) {
      skippedEmptyMonths += 1;
      continue;
    }
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r) || !r[1]) continue;
      const date = String(r[2] ?? "").slice(0, 10);
      if (r[9]) saleAgents.add(String(r[9]));
      if (r[15]) expeditors.add(String(r[15]));
      if (r[11]) stores.add(String(r[11]));
      lines.push({
        orderId: String(r[1]),
        date,
        dateLoad: String(r[3] ?? "").slice(0, 10),
        dateDeliver: String(r[4] ?? "").slice(0, 10),
        qty: num(r[5]),
        sum: num(r[6]),
        productId: String(r[7] ?? ""),
        clientId: String(r[8] ?? ""),
        agentId: String(r[9] ?? ""),
        storeId: String(r[11] ?? ""),
        expId: String(r[15] ?? ""),
        comment: String(r[16] ?? "").slice(0, 500)
      });
    }
  }

  const cash: SdCash[] = [];
  const operators = new Map<string, Map<string, number>>();
  const clockById = readCashClocks(root);
  for (const file of files(path.join(root, "06-pul"), "cash-").filter((f) => !path.basename(f).startsWith("cash-clock-"))) {
    const rows = readJson(file) as Array<{ value?: string[] }>;
    if (!Array.isArray(rows) || rows.length < 2) {
      skippedEmptyMonths += 1;
      continue;
    }
    const header = (rows[0]?.value ?? []).map((h) => String(h).toLowerCase());
    const at = (name: string, fallback: number) => {
      const i = header.indexOf(name);
      return i >= 0 ? i : fallback;
    };
    const iId = at("client_trans_id", 1);
    const iClient = at("client_id", 2);
    const iSum = at("summa", 3);
    const iAgent = at("agent_id", 6);
    const iBox = at("cashbox", 9);
    const iUser = at("create_by", 10);
    const iDate = at("date", 11);
    const iKind = at("type", 12);
    const iOrder = at("order_id", 14);
    const iComment = ["comment", "comment_2", "izoh", "prim"].map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
    for (let i = 1; i < rows.length; i++) {
      const v = rows[i]?.value;
      if (!v || !v[iId]) continue;
      const userId = String(v[iUser] ?? "");
      const box = String(v[iBox] ?? "");
      if (userId) {
        const m = operators.get(userId) ?? new Map<string, number>();
        m.set(box, (m.get(box) ?? 0) + 1);
        operators.set(userId, m);
      }
      cash.push({
        id: String(v[iId]),
        clientId: String(v[iClient] ?? ""),
        sum: num(v[iSum]),
        agentId: String(v[iAgent] ?? ""),
        cashbox: box,
        userId,
        date: clockById.get(String(v[iId])) || String(v[iDate] ?? "").trim(),
        kind: String(v[iKind] ?? "Приход"),
        orderId: String(v[iOrder] ?? ""),
        comment: iComment >= 0 ? String(v[iComment] ?? "").trim().slice(0, 2000) : ""
      });
    }
  }

  const returns: SdReturn[] = [];
  for (const file of files(path.join(root, "05-buyurtma"), "returns-")) {
    const rows = readJson(file) as unknown[];
    if (!Array.isArray(rows) || rows.length < 2) {
      skippedEmptyMonths += 1;
      continue;
    }
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r) || !r[0]) continue;
      const qty = num(r[9]);
      if (qty <= 0) continue;
      returns.push({
        orderId: String(r[0]),
        productId: String(r[4] ?? ""),
        qty,
        sum: num(r[7]),
        dealerId: String(r[11] ?? ""),
        dealerName: String(r[12] ?? "")
      });
    }
  }

  const bonusRaw = readJson(path.join(root, "07-bonus", "bonus.json")) as {
    details?: Array<{ data?: { data?: Record<string, unknown> } }>;
  };
  const bonuses: SdBonus[] = [];
  for (const wrap of bonusRaw.details ?? []) {
    const d = wrap?.data?.data;
    if (!d) continue;
    const dealers = Array.isArray(d.dealer_id) ? d.dealer_id.map(String) : [];
    const calc = Array.isArray(d.calculations) ? (d.calculations[0] as Record<string, unknown>) : undefined;
    bonuses.push({
      id: String(d.id ?? ""),
      name: String(d.name ?? "").slice(0, 200),
      active: d.active !== false,
      from: d.date_from ? String(d.date_from).slice(0, 19).replace(" ", "T") : null,
      to: d.date_to ? String(d.date_to).slice(0, 19).replace(" ", "T") : null,
      buy: Math.round(num(calc?.value)),
      free: Math.round(num(calc?.bonus)),
      products: Array.isArray(d.products) ? d.products.map(String) : [],
      bonusProducts: Array.isArray(d.bonus_products) ? d.bonus_products.map(String) : [],
      andijon: dealers.includes("1"),
      dealerIds: dealers,
      inBlocks: Boolean(d.in_block)
    });
  }

  const known = new Set(clients.map((c) => c.id));
  const onSales = new Set(lines.map((l) => l.clientId).filter(Boolean));
  const debtNames = readDebtNames(root);
  const debtFile = fs.existsSync(path.join(root, "06-pul", "client-debt.json"));
  let clientsAddedFromSales = 0;
  for (const id of new Set(cash.map((c) => c.clientId))) {
    if (!debtFile || !id || known.has(id) || !onSales.has(id)) continue;
    const name = debtNames.get(id) || id;
    clients.push({
      id,
      name: name.slice(0, 300),
      firm: "",
      phone: "",
      agentCode: "",
      agentName: "",
      region: "Andijon",
      territory: "",
      address: "",
      landmark: "",
      category: "",
      active: true,
      inn: "",
      gps: "",
      createdAt: ""
    });
    known.add(id);
    clientsAddedFromSales += 1;
  }

  return {
    products,
    categories,
    clients,
    namedAgents,
    lines,
    saleAgents: [...saleAgents],
    expeditors: [...expeditors],
    stores: [...stores],
    cash,
    operators,
    staff: readStaff(root),
    returns,
    bonuses,
    skippedEmptyMonths,
    clientsAddedFromSales
  };
}

function readDebtNames(root: string): Map<string, string> {
  const map = new Map<string, string>();
  const file = path.join(root, "06-pul", "client-debt.json");
  if (!fs.existsSync(file)) return map;
  const raw = readJson(file) as { clients?: Array<{ customer_id?: string; customer_name?: string }> };
  for (const row of raw.clients ?? []) {
    const id = String(row.customer_id ?? "");
    const name = String(row.customer_name ?? "").trim();
    if (id && name) map.set(id, name);
  }
  return map;
}
