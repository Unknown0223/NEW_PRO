/**
 * AI Assistant — o‘qish tool’lari (savdo, moliya, dashboard).
 *
 * Har bir tool mavjud API endpointni chaqiradi. `anyOf` — endpoint o‘zi
 * talab qiladigan ruxsat kalitlari (pre-flight uchun nusxa).
 */
import { z } from "zod";
import { REPORT_VIEW_ANY_PERMISSIONS } from "../reports/report-permissions";
import { formatPeriodLabel } from "./ai.dates";
import { genericTable, metricsTable, pickRows, rawTable } from "./ai.format";
import { money, truncate } from "./ai.text";
import { pStr, qs, type AiToolSpec } from "./ai.tool";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const limit = z.coerce.number().int().min(1).max(200).optional();
const page = z.coerce.number().int().min(1).max(1000).optional();
const search = z.string().trim().max(120).optional();

const periodSchema = z.object({ from: ymd.optional(), to: ymd.optional(), limit, page, search });

function periodLabel(params: Record<string, unknown>): string {
  const from = pStr(params, "from");
  const to = pStr(params, "to");
  return formatPeriodLabel({ from, to });
}

/** `{data:[total], agents:[...]}` — savdo yakuni. */
export function formatSalesSummary(payload: unknown): ReturnType<typeof rawTable> {
  const obj = (payload ?? {}) as {
    data?: Array<Record<string, unknown>>;
    agents?: Array<Record<string, unknown>>;
  };
  const total = obj.data?.[0] ?? {};
  const metrics: Array<[string, string]> = [
    ["Buyurtma", String(total.order_count ?? 0)],
    ["Savdo", money(total.total_sum)],
    ["To‘lov", money(total.payment_sum)],
    ["Vozvrat", money(total.return_amount)],
    ["Sof tushum", money(total.net_revenue)]
  ];
  const agents = (obj.agents ?? []).slice(0, 10);
  return {
    title: "Savdo yakuni",
    summary: `Buyurtma: ${total.order_count ?? 0} ta · savdo: ${money(total.total_sum)} · sof: ${money(total.net_revenue)}`,
    columns: ["Agent", "Buyurtma", "Savdo"],
    rows: agents.map((agent) => [
      String(agent.agent_name ?? "—"),
      String(agent.order_count ?? 0),
      money(agent.total_sum)
    ]),
    metrics,
    source: "/reports/sales"
  };
}

function formatReceivables(payload: unknown, maxRows = 50): ReturnType<typeof rawTable> {
  const rows = pickRows(payload);
  const debtors = rows.filter((row) => Number(row.outstanding ?? 0) > 0);
  const total = debtors.reduce((acc, row) => acc + Number(row.outstanding ?? 0), 0);
  return rawTable({
    title: "Qarzdorlik",
    summary: `Jami qarz: ${money(total)} · ${debtors.length} ta mijoz`,
    columns: ["Mijoz", "Telefon", "Qarz", "Kredit limiti"],
    rows: debtors.map((row) => [
      truncate(String(row.name ?? "—"), 40),
      String(row.phone ?? "—"),
      money(row.outstanding),
      money(row.credit_limit)
    ]),
    maxRows,
    source: "/reports/client-receivables"
  });
}

export const READ_TOOLS_FINANCE: AiToolSpec[] = [
  {
    id: "dashboard.stats",
    kind: "read",
    domain: "dashboard",
    title: "Bugungi holat",
    description: "Mijozlar, mahsulotlar, buyurtmalar va to‘lovlar bo‘yicha joriy ko‘rsatkichlar",
    method: "GET",
    anyOf: ["dashboard.prodazhi.view"],
    schema: z.object({}),
    path: () => "/dashboard/stats",
    format: (payload) =>
      metricsTable(payload, {
        title: "Bugungi holat",
        keys: [
          { key: "clients_total", label: "Mijozlar" },
          { key: "products_active", label: "Faol mahsulot" },
          { key: "orders_today", label: "Bugungi buyurtma" },
          { key: "orders_active", label: "Ochiq buyurtma" },
          { key: "payments_sum_today", label: "Bugungi to‘lov", money: true },
          { key: "open_orders_total", label: "Ochiq buyurtma summasi", money: true }
        ],
        source: "/dashboard/stats"
      })
  },
  {
    id: "dashboard.finance",
    kind: "read",
    domain: "dashboard",
    title: "Moliya holati",
    description: "Moliya dashbordi: tushum, xarajat, qoldiq",
    method: "GET",
    anyOf: ["dashboard.finansy.view", "finance.obzor.view"],
    schema: z.object({}),
    path: () => "/dashboard/finance/summary",
    format: (payload) =>
      genericTable(payload, { title: "Moliya holati", maxRows: 20, source: "/dashboard/finance/summary" })
  },
  {
    id: "sales.summary",
    kind: "read",
    domain: "sales",
    title: "Savdo yakuni",
    description: "Davr bo‘yicha savdo, to‘lov, vozvrat va eng yaxshi agentlar",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) => `/reports/sales${qs({ from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload, p) => ({ ...formatSalesSummary(payload), summary: `${formatSalesSummary(payload).summary}${periodLabel(p) ? ` (${periodLabel(p)})` : ""}` })
  },
  {
    id: "sales.trend",
    kind: "read",
    domain: "sales",
    title: "Savdo dinamikasi",
    description: "Kunlik savdo dinamikasi",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) => `/reports/order-trends${qs({ from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Savdo dinamikasi",
        preferred: ["date", "orders", "revenue"],
        maxRows: 60,
        source: "/reports/order-trends"
      })
  },
  {
    id: "sales.by_agent",
    kind: "read",
    domain: "sales",
    title: "Agentlar bo‘yicha savdo",
    description: "Agent kesimida buyurtma va summa",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) =>
      `/reports/agent-orders${qs({ from: pStr(p, "from"), to: pStr(p, "to"), page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Agentlar bo‘yicha savdo",
        preferred: ["agent_name", "name", "order_count", "total_sum", "status"],
        maxRows: 50,
        source: "/reports/agent-orders"
      })
  },
  {
    id: "sales.by_product",
    kind: "read",
    domain: "sales",
    title: "Mahsulotlar bo‘yicha savdo",
    description: "Mahsulot kesimida sotuv",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) =>
      `/reports/product-sales${qs({ from: pStr(p, "from"), to: pStr(p, "to"), page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Mahsulotlar bo‘yicha savdo",
        preferred: ["product_name", "name", "sku", "qty", "total_sum", "amount"],
        maxRows: 50,
        source: "/reports/product-sales"
      })
  },
  {
    id: "sales.by_client",
    kind: "read",
    domain: "sales",
    title: "Mijozlar bo‘yicha savdo",
    description: "Mijoz kesimida savdo",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) =>
      `/reports/client-sales-2${qs({ from: pStr(p, "from"), to: pStr(p, "to"), page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Mijozlar bo‘yicha savdo",
        preferred: ["client_name", "name", "order_count", "total_sum", "debt"],
        maxRows: 50,
        source: "/reports/client-sales-2"
      })
  },
  {
    id: "returns.list",
    kind: "read",
    domain: "sales",
    title: "Vozvratlar",
    description: "Ekspeditor vozvratlari / qaytimlar",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) =>
      `/reports/expeditor-returns/orders${qs({ from: pStr(p, "from"), to: pStr(p, "to"), page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Vozvratlar",
        preferred: ["number", "client_name", "agent_name", "total_sum", "status", "created_at"],
        maxRows: 50,
        source: "/reports/expeditor-returns/orders"
      })
  },
  {
    id: "finance.receivables",
    kind: "read",
    domain: "finance",
    title: "Qarzdorlik",
    description: "Mijozlar bo‘yicha ochiq qarz (kredit yuki)",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: z.object({ limit, page, search, only_over_limit: z.boolean().optional() }),
    path: (p) =>
      `/reports/client-receivables${qs({
        page: pStr(p, "page") ?? 1,
        limit: pStr(p, "limit") ?? 50,
        search: pStr(p, "search"),
        only_over_limit: p["only_over_limit"] === true ? "true" : undefined
      })}`,
    format: (payload, p) => formatReceivables(payload, Number(pStr(p, "limit") ?? 50))
  },
  {
    id: "finance.cashflow",
    kind: "read",
    domain: "finance",
    title: "Pul oqimi",
    description: "Kassa pul oqimi hisoboti",
    method: "GET",
    anyOf: ["cash.otchety.view"],
    schema: periodSchema,
    path: (p) => `/reports/cash-flow${qs({ from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, { title: "Pul oqimi", maxRows: 50, source: "/reports/cash-flow" })
  },
  {
    id: "finance.expenses",
    kind: "read",
    domain: "finance",
    title: "Rasxodlar",
    description: "Kompaniya rasxodlari ro‘yxati",
    method: "GET",
    anyOf: ["cash.rashody_klienta.view"],
    schema: periodSchema,
    path: (p) =>
      `/expenses${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50, from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Rasxodlar",
        preferred: ["expense_type", "expense_date", "amount", "status", "title"],
        maxRows: 50,
        source: "/expenses"
      })
  },
  {
    id: "finance.expenses_summary",
    kind: "read",
    domain: "finance",
    title: "Rasxod yakuni",
    description: "Rasxodlar bo‘yicha jamlanma",
    method: "GET",
    anyOf: ["cash.rashody_klienta.view"],
    schema: z.object({ from: ymd.optional(), to: ymd.optional() }),
    path: (p) => `/expenses/summary${qs({ from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, { title: "Rasxod yakuni", maxRows: 30, source: "/expenses/summary" })
  },
  {
    id: "finance.pnl",
    kind: "read",
    domain: "finance",
    title: "Foyda va zarar",
    description: "P&L: tushum, tannarx, rasxod, foyda",
    method: "GET",
    anyOf: ["cash.otchety.view", ...REPORT_VIEW_ANY_PERMISSIONS],
    schema: z.object({ from: ymd.optional(), to: ymd.optional() }),
    path: (p) => `/expenses/pnl${qs({ from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      metricsTable(payload, {
        title: "Foyda va zarar",
        keys: [
          { key: "revenue", label: "Tushum", money: true },
          { key: "cost", label: "Tannarx", money: true },
          { key: "expenses", label: "Rasxod", money: true },
          { key: "profit", label: "Foyda", money: true },
          { key: "margin", label: "Rentabellik" }
        ],
        source: "/expenses/pnl"
      })
  },
  {
    id: "finance.cash_desks",
    kind: "read",
    domain: "finance",
    title: "Kassalar",
    description: "Kassalar va ulardagi qoldiq",
    method: "GET",
    anyOf: ["cash.kassa.view"],
    schema: z.object({}),
    path: () => "/cash-desks",
    format: (payload) =>
      genericTable(payload, {
        title: "Kassalar",
        preferred: ["name", "balance", "currency", "is_active"],
        maxRows: 30,
        source: "/cash-desks"
      })
  }
];
