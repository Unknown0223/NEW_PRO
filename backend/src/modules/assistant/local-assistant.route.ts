import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { parseDateRange } from "../reports/reports.shared";
import { dashboardStatsPreHandler } from "../dashboard/dashboard.routes.shared";
import { assistantGuide, isOverviewQuestion, overviewPaths, sanitizeCalls, tashkentDay } from "./local-assistant.catalog";
import { formatTable, money, narrow, type TableGroup } from "./local-assistant.format";

const RETURN_TYPES = ["return", "partial_return", "return_by_order"];

async function salesFact(tenantId: number, from: string, to: string, withReturns: boolean) {
  const range = parseDateRange(from, to);
  const created_at = { gte: range.gte, lte: range.lte };
  const sold = await prisma.order.aggregate({
    where: {
      tenant_id: tenantId,
      created_at,
      status: { notIn: ["returned", "cancelled"] },
      order_type: { notIn: RETURN_TYPES }
    },
    _sum: { total_sum: true },
    _count: true
  });
  if (!withReturns) {
    return { sum: sold._sum.total_sum?.toString() ?? "0", count: sold._count, returns: "0" };
  }
  const back = await prisma.order.aggregate({
    where: {
      tenant_id: tenantId,
      created_at,
      OR: [{ status: "returned" }, { order_type: { in: RETURN_TYPES } }]
    },
    _sum: { total_sum: true }
  });
  return { sum: sold._sum.total_sum?.toString() ?? "0", count: sold._count, returns: back._sum.total_sum?.toString() ?? "0" };
}

function salesTable(path: string, result: unknown): Omit<TableGroup, "title"> {
  const params = new URLSearchParams(path.split("?")[1] || "");
  const from = params.get("from") || "";
  const to = params.get("to") || from;
  const row = (result as { data?: Array<Record<string, unknown>> }).data?.[0];
  const when = from === to ? from : `${from} — ${to}`;
  const sum = money(row?.total_sum);
  return {
    summary: `${when} kuni umumiy savdo summasi ${sum} bo'ldi`,
    columns: ["Sana", "Umumiy savdo", "Buyurtma"],
    rows: [[when, sum, String(row?.order_count ?? 0)]]
  };
}

function groupTitle(path: string) {
  if (path.startsWith("/orders")) return "Buyurtmalar";
  if (path.startsWith("/payments")) return "To'lovlar";
  if (path.includes("receivables")) return "Qarzlar";
  if (path.startsWith("/clients")) return "Mijozlar";
  if (path.startsWith("/users")) return "Xodimlar";
  if (path.startsWith("/agents")) return "Agentlar";
  if (path.startsWith("/products")) return "Mahsulotlar";
  if (path.includes("/sales")) return "Savdo";
  if (path.includes("stats")) return "Bugungi holat";
  if (path.startsWith("/expenses")) return "Rasxodlar";
  if (path.startsWith("/cash-desks")) return "Kassalar";
  if (path.startsWith("/payroll")) return "Ish haqi";
  if (path.startsWith("/transfers") || path.startsWith("/stock")) return "Ombor";
  if (path.includes("finance")) return "Moliya";
  if (path.includes("income") || path.includes("cash-flow")) return "Pul oqimi";
  return "Ma'lumot";
}

function salesPath(question: string) {
  const q = question.toLowerCase();
  const today = tashkentDay(0);
  if (/kecha|вчера/.test(q)) {
    const day = tashkentDay(-1);
    return `/reports/sales?from=${day}&to=${day}`;
  }
  if (/bugun|сегодня/.test(q)) return `/reports/sales?from=${today}&to=${today}`;
  const from = tashkentDay(-6);
  return `/reports/sales?from=${from}&to=${today}`;
}

function wants(question: string) {
  const q = question.toLowerCase();
  return {
    order: /zakaz|buyurtma|заказ/.test(q),
    pay: /oplata|tolov|to'lov|платеж|оплат/.test(q),
    debt: /qarz|долг|дебитор|qardor/.test(q),
    client: /mijoz|клиент|klent/.test(q),
    staff: /foydalanuv|xodim|пользовател|сотрудник/.test(q),
    agent: /agent/.test(q),
    countOnly: /soni|nechta|aktiv|nofaol|neaktiv/.test(q) && !/ro'yxat|royxat|ismlari|hammasi/.test(q),
    product: /mahsulot|товар|продукт/.test(q),
    sales: /savdo|продаж/.test(q),
    returns: /vazvrat|vozvrat|возврат|fact|факт/.test(q),
    today: /bugun|сегодня/.test(q),
    idOnly: /\bid\b|idlari|idni|idisi/.test(q),
    sumOnly: /summa|qancha|jami/.test(q) && !/ro'yxat|royxat|hammasi|barchasi/.test(q)
  };
}

function pathsFor(question: string, fromModel: string[]) {
  const w = wants(question);
  const out: string[] = [];
  const add = (path: string) => {
    if (path && !out.includes(path)) out.push(path);
  };
  if (w.order) add("/orders?page=1&limit=30");
  if (w.pay) add("/payments?page=1&limit=30");
  if (w.debt) add("/reports/receivables?page=1&limit=30");
  if (w.client && !w.debt && !w.order && !w.pay) add("/clients?page=1&limit=20");
  if (w.agent && !w.order && !w.pay && !w.debt && !w.sales) add("/agents");
  if (w.staff && !w.agent) add("/users");
  if (w.product) add("/products?page=1&limit=20");
  if (w.sales && !w.order && !w.pay && !w.debt) add(salesPath(question));
  if (w.today && out.length === 0) add("/dashboard/stats");
  if (out.length === 0) {
    for (const path of fromModel.slice(0, 1)) {
      const only = path.split("?")[0] || "";
      if (sanitizeCalls([path]).length) add(path);
    }
  }
  return out.slice(0, 2);
}

function assistantEndpoint(): { url: string; headers: Record<string, string>; model: string; remote: boolean } {
  const key = process.env.ASSISTANT_API_KEY?.trim();
  if (key) {
    const base = (process.env.ASSISTANT_API_BASE || "https://zro.moonmath.ai/v1").replace(/\/$/, "");
    return {
      url: `${base}/chat/completions`,
      remote: true,
      model: process.env.ASSISTANT_MODEL?.trim() || "glm-5.3-flash",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      }
    };
  }
  return {
    url: process.env.LMSTUDIO_URL || "http://127.0.0.1:1234/v1/chat/completions",
    remote: false,
    model: "qwen3",
    headers: { "content-type": "application/json" }
  };
}

function parseCalls(text: string): string[] {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth += 1;
    else if (cleaned[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, i + 1)) as {
            calls?: Array<{ path?: string }>;
            call?: { path?: string };
          };
          const many = (parsed.calls || []).map((item) => item.path || "").filter(Boolean);
          if (many.length) return many;
          return parsed.call?.path ? [parsed.call.path] : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

export function registerLocalAssistantRoutes(app: FastifyInstance): void {
  app.post("/api/:slug/local-assistant/ask", { preHandler: dashboardStatsPreHandler }, async (request, reply) => {
    const body = request.body as { question?: string; history?: Array<{ role?: string; text?: string }> };
    const question = body.question?.trim() ?? "";
    if (!question) return reply.code(400).send({ message: "Savol yozing" });
    const earlier = (body.history || [])
      .map((item) => item.text || "")
      .filter(Boolean)
      .slice(-4)
      .join(". ");
    const followUp = /^(shu|uning|idisi|idni|summasi|qancha)\b/i.test(question);
    const understood = followUp && earlier ? `${earlier}. ${question}` : question;
    const slug = (request.params as { slug: string }).slug;
    const asked = wants(understood);
    const today = tashkentDay(0);
    let paths: string[] = [];
    if (isOverviewQuestion(understood)) {
      paths = overviewPaths();
    } else {
      const hinted = pathsFor(understood, []);
      const llm = assistantEndpoint();
      try {
        const res = await fetch(llm.url, {
          method: "POST",
          headers: llm.headers,
          body: JSON.stringify({
            model: llm.model,
            temperature: 0.1,
            max_tokens: 700,
            ...(llm.remote ? {} : { chat_template_kwargs: { enable_thinking: false } }),
            messages: [
              { role: "system", content: assistantGuide(today) },
              { role: "user", content: understood }
            ]
          })
        });
        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          paths = sanitizeCalls(parseCalls(data.choices?.[0]?.message?.content || ""));
        }
      } catch {
        paths = [];
      }
      if (!paths.length) paths = hinted;
    }
    if (!paths.length) {
      return reply.send({ title: "Savol tushunilmadi", lines: ["Qarz, buyurtma, to'lov yoki mijoz haqida aniqroq so'rang."] });
    }
    const groups: TableGroup[] = [];
    for (const path of paths) {
      const injected = await app.inject({
        method: "GET",
        url: `/api/${slug}${path.startsWith("/") ? path : `/${path}`}`,
        headers: { authorization: String(request.headers.authorization || "") }
      });
      if (injected.statusCode >= 400) {
        groups.push({ title: groupTitle(path), summary: "Ma'lumot olinmadi.", columns: [], rows: [] });
        continue;
      }
      const payload = injected.json() as { data?: Array<Record<string, unknown>> };
      if (asked.countOnly && Array.isArray(payload?.data)) {
        const people = payload.data.filter((row) => !asked.agent || row.role == null || row.role === "agent");
        const active = people.filter((row) => row.is_active !== false).length;
        groups.push({
          title: groupTitle(path),
          summary: `Jami ${people.length} ta`,
          columns: ["Holat", "Soni"],
          rows: [
            ["Faol", String(active)],
            ["Nofaol", String(people.length - active)]
          ]
        });
        continue;
      }
      const salesQuery = new URLSearchParams(path.split("?")[1] || "");
      let table: Omit<TableGroup, "title"> = path.includes("/reports/sales") ? salesTable(path, payload) : formatTable(payload);
      if (path.includes("/reports/sales") && request.tenant?.id) {
        const from = salesQuery.get("from") || "";
        const to = salesQuery.get("to") || from;
        const fact = await salesFact(request.tenant.id, from, to, asked.returns);
        const when = from === to ? from : `${from} — ${to}`;
        const net = asked.returns ? Number(fact.sum) - Number(fact.returns) : Number(fact.sum);
        table = {
          summary: asked.returns
            ? `${when} savdo ${money(fact.sum)}, vozvrat ${money(fact.returns)} ayrildi, qoldi ${money(net)}`
            : `${when} kuni umumiy savdo summasi ${money(fact.sum)} bo'ldi`,
          columns: asked.returns ? ["Sana", "Savdo", "Vozvrat", "Qoldiq", "Buyurtma"] : ["Sana", "Umumiy savdo", "Buyurtma"],
          rows: asked.returns
            ? [[when, money(fact.sum), money(fact.returns), money(net), String(fact.count)]]
            : [[when, money(fact.sum), String(fact.count)]]
        };
      }
      if (asked.today) {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
        const dateAt = table.columns.findIndex((column) => column === "Sana");
        if (dateAt >= 0) table = { ...table, rows: table.rows.filter((row) => row[dateAt] === today), summary: `Bugun, ${today}` };
      }
      if (!table.rows.length) table = { summary: "Bu savol bo'yicha yozuv yo'q", columns: [], rows: [] };
      const mode = path.includes("/reports/sales") ? { idOnly: false, sumOnly: false } : asked;
      groups.push({ title: groupTitle(path), ...narrow(table, mode) });
    }
    return reply.send({
      title: "Javob",
      groups,
      lines: groups.flatMap((group) => [group.title, group.summary, ...group.rows.map((row) => row.join(" | "))])
    });
  });
}
