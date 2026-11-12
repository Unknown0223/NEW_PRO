/** AI Assistant — o‘qish tool’lari (operatsiyalar: buyurtma, mijoz, ombor, xodim). */
import { z } from "zod";
import { genericTable, pickRows, rawTable } from "./ai.format";
import { money, truncate } from "./ai.text";
import { pStr, qs, type AiToolSpec } from "./ai.tool";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const limit = z.coerce.number().int().min(1).max(200).optional();
const page = z.coerce.number().int().min(1).max(1000).optional();
const search = z.string().trim().max(120).optional();

const STAFF_PATHS: Record<string, string> = {
  agent: "/agents",
  operator: "/operators",
  supervisor: "/supervisors",
  expeditor: "/expeditors",
  collector: "/collectors",
  auditor: "/auditors",
  skladchik: "/skladchik"
};

const STAFF_TITLES: Record<string, string> = {
  agent: "Agentlar",
  operator: "Operatorlar",
  supervisor: "Supervayzerlar",
  expeditor: "Ekspeditorlar",
  collector: "Inkassatorlar",
  auditor: "Auditorlar",
  skladchik: "Skladchiklar"
};

const STAFF_KEYS = [
  "staff.agent.view",
  "staff.sotrudniki.view",
  "staff.supervayzer.view",
  "staff.ekspeditor.view",
  "staff.inkassator.view",
  "staff.auditor.view",
  "staff.skladchik.view"
];

function staffRows(payload: unknown, query: string | undefined) {
  const rows = pickRows(payload);
  const q = (query ?? "").toLowerCase();
  const filtered = q
    ? rows.filter((row) =>
        [row.name, row.login, row.code, row.phone]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(q))
      )
    : rows;
  return { rows, filtered };
}

export const READ_TOOLS_OPS: AiToolSpec[] = [
  {
    id: "orders.list",
    kind: "read",
    domain: "orders",
    title: "Buyurtmalar",
    description: "Buyurtmalar ro‘yxati (qidiruv va holat bo‘yicha)",
    method: "GET",
    anyOf: ["orders.zakaz.view"],
    schema: z.object({ limit, page, search, status: z.string().max(40).optional() }),
    path: (p) =>
      `/orders${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 30, search: pStr(p, "search"), status: pStr(p, "status") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Buyurtmalar",
        preferred: ["number", "created_at", "client_name", "agent_name", "total_sum", "status"],
        maxRows: 50,
        source: "/orders"
      })
  },
  {
    id: "payments.list",
    kind: "read",
    domain: "payments",
    title: "To‘lovlar",
    description: "Kassa to‘lovlari ro‘yxati",
    method: "GET",
    anyOf: ["cash.oplaty_klientov.view"],
    schema: z.object({ limit, page, search, from: ymd.optional(), to: ymd.optional() }),
    path: (p) =>
      `/payments${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 30, from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "To‘lovlar",
        preferred: ["paid_at", "created_at", "client_name", "agent_name", "amount", "payment_type"],
        maxRows: 50,
        source: "/payments"
      })
  },
  {
    id: "clients.list",
    kind: "read",
    domain: "clients",
    title: "Mijozlar",
    description: "Mijozlar ro‘yxati / qidiruv",
    method: "GET",
    anyOf: ["clients.klient.view", "clients.karta.view", "clients.vizity.view"],
    schema: z.object({ limit, page, search }),
    path: (p) => `/clients${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 30, search: pStr(p, "search") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Mijozlar",
        preferred: ["name", "phone", "agent_name", "category", "is_active"],
        maxRows: 50,
        source: "/clients"
      })
  },
  {
    id: "products.list",
    kind: "read",
    domain: "products",
    title: "Mahsulotlar",
    description: "Mahsulot katalogi / narxlar",
    method: "GET",
    anyOf: ["settings.tovar.view"],
    schema: z.object({ limit, page, search, is_active: z.boolean().optional() }),
    path: (p) =>
      `/products${qs({
        page: pStr(p, "page") ?? 1,
        limit: pStr(p, "limit") ?? 30,
        search: pStr(p, "search"),
        is_active: p["is_active"] === true ? "true" : p["is_active"] === false ? "false" : undefined
      })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Mahsulotlar",
        preferred: ["sku", "name", "unit", "price", "is_active", "category_name"],
        maxRows: 50,
        source: "/products"
      })
  },
  {
    id: "stock.balances",
    kind: "read",
    domain: "stock",
    title: "Ombor qoldig‘i",
    description: "Ombor bo‘yicha qoldiq",
    method: "GET",
    anyOf: ["warehouse.ostatki.view"],
    schema: z.object({ limit, page, search }),
    path: (p) =>
      `/stock/balances${qs({
        page: pStr(p, "page") ?? 1,
        limit: pStr(p, "limit") ?? 30,
        q: pStr(p, "search") ?? "",
        active_only: "true"
      })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Ombor qoldig‘i",
        preferred: ["name", "sku", "warehouse_name", "available", "qty", "unit"],
        maxRows: 50,
        source: "/stock/balances"
      })
  },
  {
    id: "staff.list",
    kind: "read",
    domain: "staff",
    title: "Xodimlar",
    description: "Xodimlar ro‘yxati (agent, operator, ekspeditor va h.k.)",
    method: "GET",
    anyOf: STAFF_KEYS,
    schema: z.object({
      limit,
      page,
      search,
      staffKind: z.enum(["agent", "operator", "supervisor", "expeditor", "collector", "auditor", "skladchik"]).optional(),
      is_active: z.boolean().optional()
    }),
    path: (p) => {
      const kind = pStr(p, "staffKind") ?? "agent";
      const base = STAFF_PATHS[kind] ?? "/agents";
      return `${base}${qs({
        is_active: p["is_active"] === true ? "true" : p["is_active"] === false ? "false" : undefined
      })}`;
    },
    format: (payload, p) => {
      const kind = pStr(p, "staffKind") ?? "agent";
      const { filtered } = staffRows(payload, pStr(p, "search"));
      const maxRows = Number(pStr(p, "limit") ?? 50);
      return rawTable({
        title: STAFF_TITLES[kind] ?? "Xodimlar",
        summary: `${filtered.length} ta xodim`,
        columns: ["F.I.SH", "Login", "Telefon", "Rol", "Holat"],
        rows: filtered.map((row) => [
          truncate(String(row.name ?? row.fio ?? "—"), 40),
          String(row.login ?? "—"),
          String(row.phone ?? "—"),
          String(row.role ?? kind),
          row.is_active === false ? "Nofaol" : "Faol"
        ]),
        maxRows,
        source: STAFF_PATHS[kind] ?? "/agents"
      });
    }
  },
  {
    id: "tasks.list",
    kind: "read",
    domain: "tasks",
    title: "Vazifalar",
    description: "Topshiriqlar ro‘yxati",
    method: "GET",
    anyOf: ["staff.zadachi_spisok.view"],
    schema: z.object({ limit, page, search, status: z.string().max(40).optional() }),
    path: (p) =>
      `/tasks${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 30, q: pStr(p, "search"), status: pStr(p, "status") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Vazifalar",
        preferred: ["title", "assignee_name", "status", "priority", "due_at"],
        maxRows: 50,
        source: "/tasks"
      })
  },
  {
    id: "payroll.list",
    kind: "read",
    domain: "payroll",
    title: "Ish haqi",
    description: "Oy bo‘yicha ish haqi hisob-kitobi",
    method: "GET",
    anyOf: ["staff.zarplaty.view"],
    schema: z.object({
      year: z.coerce.number().int().min(2000).max(2100),
      month: z.coerce.number().int().min(1).max(12),
      search: z.string().trim().max(120).optional()
    }),
    path: (p) => `/payroll/records${qs({ year: pStr(p, "year"), month: pStr(p, "month") })}`,
    format: (payload, p) => {
      const rows = pickRows(payload);
      const q = (pStr(p, "search") ?? "").toLowerCase();
      const filtered = q
        ? rows.filter((row) => String(row.name ?? row.fio ?? "").toLowerCase().includes(q))
        : rows;
      const total = filtered.reduce((acc, row) => acc + Number(row.total ?? row.amount ?? 0), 0);
      return rawTable({
        title: "Ish haqi",
        summary: `${pStr(p, "year")}-${pStr(p, "month")} · ${filtered.length} ta · jami ${money(total)}`,
        columns: ["Xodim", "Rol", "Hisoblangan", "To‘langan", "Qoldiq"],
        rows: filtered.map((row) => [
          truncate(String(row.name ?? row.fio ?? "—"), 40),
          String(row.role ?? "—"),
          money(row.total ?? row.amount),
          money(row.paid),
          money(row.balance ?? row.debt)
        ]),
        maxRows: 50,
        source: "/payroll/records"
      });
    }
  }
];
