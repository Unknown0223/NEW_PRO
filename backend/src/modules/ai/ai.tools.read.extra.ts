/**
 * AI Assistant — qo'shimcha o'qish tool'lari (SalesArena bo'mlari: buyurtma, vozvrat, konsignatsiya, visits, tabel, KPI, narx matritsa, ombor transfer).
 *
 * Barcha endpointlar mavjud SALEC API'dan foydalanadi; foydalanuvchi o'zi JWT bilan chaqiradi.
 */
import { z } from "zod";
import { REPORT_VIEW_ANY_PERMISSIONS } from "../reports/report-permissions";
import { genericTable, pickRows, rawTable } from "./ai.format";
import { money, truncate } from "./ai.text";
import { pStr, qs, type AiToolSpec } from "./ai.tool";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const limit = z.coerce.number().int().min(1).max(200).optional();
const page = z.coerce.number().int().min(1).max(1000).optional();
const search = z.string().trim().max(120).optional();
const periodSchema = z.object({ from: ymd.optional(), to: ymd.optional(), limit, page, search });

export const READ_TOOLS_EXTRA: AiToolSpec[] = [
  {
    id: "orders.detail",
    kind: "read",
    domain: "orders",
    title: "Buyurtma tafsilotlari",
    description: "Bitta buyurtma haqida to'liq ma'lumot (mahsulotlar, mijoz, agent, holat)",
    method: "GET",
    anyOf: ["orders.zakaz.view"],
    schema: z.object({ order_id: z.coerce.number().int().positive() }),
    path: (p) => `/orders/${pNum(p, "order_id")}`,
    body: undefined,
    format: (payload) => {
      const rows = pickRows(payload);
      const first = rows[0] ?? {};
      return rawTable({
        title: `Buyurtma #${first.number ?? first.id ?? "?"}`,
        summary: `Mijoz: ${truncate(String(first.client_name ?? "—"), 40)} · holat: ${String(first.status ?? "—")}`,
        columns: ["Maydon", "Qiymat"],
        rows: [
          ["Buyurtma raqami", String(first.number ?? first.id ?? "—")],
          ["Sana", String(first.created_at ?? "—")],
          ["Mijoz", truncate(String(first.client_name ?? "—"), 40)],
          ["Agent", truncate(String(first.agent_name ?? "—"), 40)],
          ["Umumiy summa", money(first.total_sum)],
          ["To'langan", money(first.payment_sum)],
          ["Qarz", money(first.outstanding ?? first.debt)],
          ["Holat", String(first.status ?? "—")],
          ["Filial", truncate(String(first.branch_name ?? "—"), 40)],
          ["Ombor", truncate(String(first.warehouse_name ?? "—"), 40)]
        ],
        maxRows: 30,
        source: "/orders/:id"
      });
    }
  },
  {
    id: "returns.detail",
    kind: "read",
    domain: "sales",
    title: "Qaytarish tafsiloti",
    description: "Bitta vozvrat buyurtmasi haqida to'liq ma'lumot",
    method: "GET",
    anyOf: ["reports.vozvrat_ekspeditora.view"],
    schema: z.object({ return_id: z.coerce.number().int().positive() }),
    path: (p) => `/reports/expeditor-returns/orders/${pNum(p, "return_id")}`,
    format: (payload) => {
      const rows = pickRows(payload);
      const first = rows[0] ?? {};
      return rawTable({
        title: `Qaytarish #${first.number ?? first.id ?? "?"}`,
        summary: `Mijoz: ${truncate(String(first.client_name ?? "—"), 40)} · summa: ${money(first.total_sum)}`,
        columns: ["Maydon", "Qiymat"],
        rows: [
          ["Qaytarish raqami", String(first.number ?? first.id ?? "—")],
          ["Sana", String(first.created_at ?? "—")],
          ["Mijoz", truncate(String(first.client_name ?? "—"), 40)],
          ["Ekspeditor", truncate(String(first.agent_name ?? "—"), 40)],
          ["Umumiy summa", money(first.total_sum)],
          ["Sabab", truncate(String(first.reason ?? "—"), 60)],
          ["Holat", String(first.status ?? "—")]
        ],
        maxRows: 30,
        source: "/reports/expeditor-returns/orders/:id"
      });
    }
  },
  {
    id: "consignment.list",
    kind: "read",
    domain: "stock",
    title: "Konsignatsiya qarzlari",
    description: "Agentlar bo'yicha konsignatsiya to'lov jarayoni qarzlari",
    method: "GET",
    anyOf: ["staff.konsignatsiya.view", "staff.agent.view"],
    schema: periodSchema,
    path: (p) => `/consignment/agents${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50, from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Konsignatsiya qarzlari",
        preferred: ["agent_name", "total_sum", "paid_sum", "debt", "status"],
        maxRows: 50,
        source: "/consignment/agents"
      })
  },
  {
    id: "reports.visits",
    kind: "read",
    domain: "sales",
    title: "Bozori ziyoratlar",
    description: "Mijoz bozori ziyoratlari hisoboti",
    method: "GET",
    anyOf: ["reports.vizity.view"],
    schema: periodSchema,
    path: (p) => `/reports/visits-2${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50, from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Bozori ziyoratlar",
        preferred: ["client_name", "visit_date", "agent_name", "result", "note"],
        maxRows: 50,
        source: "/reports/visits-2"
      })
  },
  {
    id: "tabel.marks",
    kind: "read",
    domain: "staff",
    title: "Tabel marks",
    description: "Xodimlar ish kunlarida bo'ladigan marks/izlab chiquvchi tafsilot",
    method: "GET",
    anyOf: ["tabel.otmetki.view", "staff.tabel.view"],
    schema: z.object({ year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12), search }),
    path: (p) => `/tabel/marks${qs({ year: pStr(p, "year"), month: pStr(p, "month"), search: pStr(p, "search") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Tabel marks",
        preferred: ["name", "date", "status", "check_in", "check_out"],
        maxRows: 50,
        source: "/tabel/marks"
      })
  },
  {
    id: "kpi.plan",
    kind: "read",
    domain: "sales",
    title: "KPI / plan-rasto",
    description: "Agent/mijoz bo'yicha savdo planigaqaraganda natija",
    method: "GET",
    anyOf: [...REPORT_VIEW_ANY_PERMISSIONS],
    schema: periodSchema,
    path: (p) => `/reports/agent-kpi${qs({ from: pStr(p, "from"), to: pStr(p, "to"), page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "KPI / plan-rasto",
        preferred: ["agent_name", "plan_sum", "fact_sum", "percent", "status"],
        maxRows: 50,
        source: "/reports/agent-kpi"
      })
  },
  {
    id: "price.matrix",
    kind: "read",
    domain: "products",
    title: "Narx matritsasi",
    description: "Mahsulot bo'yicha barcha narx turlari va kategoriyalar",
    method: "GET",
    anyOf: ["settings.tovar.view", "settings.tsena.view"],
    schema: z.object({ search, limit }),
    path: (p) => `/price-matrix/lookup${qs({ search: pStr(p, "search"), limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Narx matritsasi",
        preferred: ["sku", "product_name", "price_type", "price", "currency", "effective_at"],
        maxRows: 50,
        source: "/price-matrix/lookup"
      })
  },
  {
    id: "stock.transfer",
    kind: "read",
    domain: "stock",
    title: "Ombor transfer / qoldiq",
    description: "Ombordagi mahsulot o'tkazmasi va qoldiqlar",
    method: "GET",
    anyOf: ["warehouse.ostatki.view", "staff.konsignatsiya.view"],
    schema: periodSchema,
    path: (p) => `/orders/consignment-transfers${qs({ page: pStr(p, "page") ?? 1, limit: pStr(p, "limit") ?? 50, from: pStr(p, "from"), to: pStr(p, "to") })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Ombor transfer",
        preferred: ["product_name", "sku", "from_warehouse", "to_warehouse", "qty", "status"],
        maxRows: 50,
        source: "/orders/consignment-transfers"
      })
  },
  {
    id: "price.as-of",
    kind: "read",
    domain: "products",
    title: "Narx bo'yicha sana",
    description: "Berilgan sana bo'yicha mahsulot narxini ko'rsatish",
    method: "GET",
    anyOf: ["settings.tovar.view", "settings.tsena.view"],
    schema: z.object({ search: z.string().trim().max(120).optional(), as_of: ymd.optional(), limit }),
    path: (p) => `/orders/prices-as-of${qs({ search: pStr(p, "search"), as_of: pStr(p, "as_of"), limit: pStr(p, "limit") ?? 50 })}`,
    format: (payload) =>
      genericTable(payload, {
        title: "Narx bo'yicha sana",
        preferred: ["sku", "product_name", "price_type", "price", "currency", "as_of"],
        maxRows: 50,
        source: "/orders/prices-as-of"
      })
  }

];

function pNum(params: Record<string, unknown>, key: string): number | undefined {
  const v = params[key];
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
