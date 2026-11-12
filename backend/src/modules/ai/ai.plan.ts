/**
 * AI Assistant — intent + slotlardan bajarilish planini tuzish (pure).
 *
 * Plan faqat registrdagi tool’lardan iborat bo‘ladi (allow-list).
 */
import { addDays, monthEnd, tashkentToday } from "./ai.dates";
import { detectIntent, extractSlots, isWriteIntent } from "./ai.intent";
import { pNum, pStr } from "./ai.tool";
import type { AiParams, AiPlan, AiSlots, AiToolCall } from "./ai.types";

export type AiPlanResult = AiPlan & {
  /** Foydalanuvchidan so‘ralishi kerak bo‘lgan maydonlar. */
  missing: string[];
  /** Write tool uchun obyektni topish kerak: product | client | staff. */
  resolve?: { kind: "product" | "client" | "staff" | "order"; query: string };
};

const MAX_CALLS = 4;

function defaultPeriod(slots: AiSlots, days = 7): { from: string; to: string } {
  const today = tashkentToday();
  return { from: slots.from ?? addDays(slots.to ?? today, -(days - 1)), to: slots.to ?? today };
}

function withLimit(slots: AiSlots, fallback = 30): number {
  return Math.min(100, Math.max(1, slots.limit ?? fallback));
}

function readCall(tool: string, params: AiParams): AiToolCall {
  return { tool, params };
}

function buildReadCalls(intent: string, slots: AiSlots): AiToolCall[] {
  const period = defaultPeriod(slots);
  const limit = withLimit(slots);
  const search = slots.search;

  switch (intent) {
    case "overview":
      return [
        readCall("dashboard.stats", {}),
        readCall("sales.summary", { from: period.from, to: period.to }),
        readCall("finance.receivables", { limit: 20 }),
        readCall("finance.cash_desks", {})
      ];
    case "dashboard.stats":
      return [readCall("dashboard.stats", {})];
    case "dashboard.finance":
      return [readCall("dashboard.finance", {})];
    case "sales.summary":
      return [
        readCall("sales.summary", { from: period.from, to: period.to }),
        readCall("sales.trend", { from: period.from, to: period.to })
      ];
    case "sales.trend":
      return [readCall("sales.trend", { from: period.from, to: period.to })];
    case "sales.by_agent":
      return [readCall("sales.by_agent", { from: period.from, to: period.to, limit })];
    case "sales.by_product":
      return [readCall("sales.by_product", { from: period.from, to: period.to, limit })];
    case "sales.by_client":
      return [readCall("sales.by_client", { from: period.from, to: period.to, limit })];
    case "returns.list":
      return [readCall("returns.list", { from: period.from, to: period.to, limit })];
    case "orders.detail":
      return [readCall("orders.detail", { order_id: slots.order_id })];
    case "returns.detail":
      return [readCall("returns.detail", { return_id: slots.return_id })];
    case "consignment.list":
      return [readCall("consignment.list", { from: period.from, to: period.to, limit })];
    case "branch.stats":
      return [readCall("branch.stats", { branch_id: slots.branch_id, limit })];
    case "tabel.list": {
      const base = slots.to ?? tashkentToday();
      return [readCall("tabel.list", { year: slots.year ?? Number(base.slice(0, 4)), month: slots.month ?? Number(base.slice(5, 7)), search })];
    }
    case "kpi.plan":
      return [readCall("kpi.plan", { from: period.from, to: period.to, limit })];
    case "price.matrix":
      return [readCall("price.matrix", { search, limit })];
    case "price.as-of":
      return [readCall("price.as-of", { search, as_of: slots.from, limit })];
    case "inventory.turnover":
      return [readCall("inventory.turnover", { from: period.from, to: period.to, limit })];
    case "reports.visits":
      return [readCall("reports.visits", { from: period.from, to: period.to, limit })];
    case "tabel.marks":
      return [readCall("tabel.marks", { year: slots.year ?? Number(tashkentToday().slice(0, 4)), month: slots.month ?? Number(tashkentToday().slice(5, 7)), search })];
    case "stock.transfer":
      return [readCall("stock.transfer", { from: period.from, to: period.to, limit })];
    case "finance.receivables":
      return [readCall("finance.receivables", { limit, search })];
    case "finance.cashflow":
      return [readCall("finance.cashflow", { from: period.from, to: period.to })];
    case "finance.expenses":
      return [
        readCall("finance.expenses", { from: period.from, to: period.to, limit }),
        readCall("finance.expenses_summary", { from: period.from, to: period.to })
      ];
    case "finance.expenses_summary":
      return [readCall("finance.expenses_summary", { from: period.from, to: period.to })];
    case "finance.pnl":
      return [readCall("finance.pnl", { from: period.from, to: period.to })];
    case "finance.cash_desks":
      return [readCall("finance.cash_desks", {})];
    case "orders.list":
      return [readCall("orders.list", { limit, search, status: slots.status })];
    case "payments.list":
      return [readCall("payments.list", { limit, from: slots.from, to: slots.to })];
    case "clients.list":
      return [readCall("clients.list", { limit, search })];
    case "products.list":
      return [readCall("products.list", { limit, search })];
    case "stock.balances":
      return [readCall("stock.balances", { limit, search })];
    case "staff.list":
      return [readCall("staff.list", { limit, search, staffKind: slots.staffKind ?? "agent" })];
    case "tasks.list":
      return [readCall("tasks.list", { limit, search })];
    case "payroll.list": {
      const base = slots.to ?? tashkentToday();
      return [readCall("payroll.list", { year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)), search })];
    }
    case "export.table":
      return [readCall("sales.summary", { from: period.from, to: period.to })];
    default:
      return [];
  }
}

type WriteDraft = {
  tool: string;
  params: AiParams;
  missing: string[];
  resolve?: AiPlanResult["resolve"];
};

function buildWriteDraft(intent: string, slots: AiSlots, question: string): WriteDraft {
  switch (intent) {
    case "write.set_price": {
      const price = slots.amount ?? slots.price;
      const missing: string[] = [];
      if (!slots.search) missing.push("mahsulot (SKU yoki nom)");
      if (price === undefined) missing.push("yangi narx");
      return {
        tool: "write.set_price",
        params: { price_type: slots.priceType ?? "retail", price },
        missing,
        resolve: slots.search ? { kind: "product", query: slots.search } : undefined
      };
    }
    case "write.create_employee": {
      const missing: string[] = [];
      if (!slots.name) missing.push("xodim ismi");
      if (!slots.login) missing.push("login");
      if (!slots.password) missing.push("parol (kamida 8 belgi)");
      return {
        tool: "write.create_employee",
        params: {
          staffKind: slots.staffKind ?? "agent",
          first_name: slots.name,
          login: slots.login,
          password: slots.password,
          phone: slots.phone
        },
        missing
      };
    }
    case "write.update_employee": {
      const query = slots.search ?? slots.login ?? slots.name ?? "";
      return {
        tool: "write.update_employee",
        params: { staffKind: slots.staffKind ?? "agent", is_active: slots.active, phone: slots.phone },
        missing: query ? [] : ["xodim (login yoki F.I.SH)"],
        resolve: query ? { kind: "staff", query } : undefined
      };
    }
    case "write.create_client": {
      const missing: string[] = [];
      if (!slots.name) missing.push("mijoz nomi");
      if (!slots.phone) missing.push("telefon");
      missing.push("hudud (viloyat)");
      missing.push("koordinatalar (lat, long)");
      return { tool: "write.create_client", params: { name: slots.name, phone: slots.phone }, missing };
    }
    case "write.update_client": {
      return {
        tool: "write.update_client",
        params: { credit_limit: slots.amount, phone: slots.phone },
        missing: slots.search ? [] : ["mijoz (nom yoki telefon)"],
        resolve: slots.search ? { kind: "client", query: slots.search } : undefined
      };
    }
    case "write.create_product": {
      const missing: string[] = [];
      if (!slots.sku && !slots.search) missing.push("SKU");
      if (!slots.name) missing.push("mahsulot nomi");
      missing.push("kategoriya ID");
      return {
        tool: "write.create_product",
        params: { sku: slots.sku ?? slots.search, name: slots.name },
        missing
      };
    }
    case "write.update_settings": {
      return {
        tool: "write.update_settings",
        params: { name: slots.name },
        missing: slots.name ? [] : ["qaysi sozlama va yangi qiymat"]
      };
    }
    case "write.create_task": {
      const title = question.replace(/^.*?(?:vazifa|topshiriq|задач\w*)\s*[:：-]?\s*/i, "").trim();
      return {
        tool: "write.create_task",
        params: { title: title.slice(0, 500) },
        missing: slots.search ? [] : ["kimga (xodim)"],
        resolve: slots.search ? { kind: "staff", query: slots.search } : undefined
      };
    }
    case "write.update_product": {
      const missing: string[] = [];
      if (!slots.product_id && !slots.sku && !slots.search) missing.push("mahsulot (SKU yoki ID)");
      if (!slots.name && !slots.price && !slots.unit) missing.push("qaysi maydonni o'zgartirmoqchisiz (nom, narx, o'lchov va h.k.)");
      return {
        tool: "write.update_product",
        params: {
          product_id: slots.product_id,
          sku: slots.sku,
          name: slots.name,
          unit: slots.unit,
          price: slots.price
        },
        missing,
        resolve: slots.search ? { kind: "product", query: slots.search } : undefined
      };
    }
    case "write.order_status": {
      const missing: string[] = [];
      if (!slots.order_id && !slots.search) missing.push("buyurtma raqami (ID)");
      if (!slots.status) missing.push("yangi holat (tasdiqlandi, yuborildi, bekor qilindi va h.k.)");
      return {
        tool: "write.order_status",
        params: {
          order_id: slots.order_id,
          status: slots.status
        },
        missing,
        resolve: slots.search ? { kind: "order", query: slots.search } : undefined
      };
    }
    default:
      return { tool: "", params: {}, missing: [] };
  }
}

export type BuiltPlan = {
  intent: string;
  slots: AiSlots;
  plan: AiPlanResult;
  write: boolean;
};

/** Savol → intent + slot + plan. */
export function planFromQuestion(question: string, today: string = tashkentToday()): BuiltPlan {
  const match = detectIntent(question);
  const slots = extractSlots(question, today);
  const write = isWriteIntent(match.intent);

  if (write) {
    const draft = buildWriteDraft(match.intent, slots, question);
    const params = Object.fromEntries(Object.entries(draft.params).filter(([, value]) => value !== undefined));
    return {
      intent: match.intent,
      slots,
      write: true,
      plan: {
        intent: match.intent,
        source: "rules",
        calls: draft.tool ? [{ tool: draft.tool, params }] : [],
        missing: draft.missing,
        resolve: draft.resolve,
        note: draft.missing.length ? `Aniqlashtirish kerak: ${draft.missing.join(", ")}` : undefined
      }
    };
  }

  const calls = buildReadCalls(match.intent, slots).slice(0, MAX_CALLS);
  return {
    intent: match.intent,
    slots,
    write: false,
    plan: {
      intent: match.intent,
      source: "rules",
      calls,
      missing: calls.length ? [] : ["savol mavzusi (savdo, qarz, mijoz, xodim va h.k.)"]
    }
  };
}

/** Plan parametrlarini tekshirish (write uchun qo‘shimcha). */
export function planPeriod(plan: AiPlanResult): { from?: string; to?: string } {
  for (const call of plan.calls) {
    const from = pStr(call.params, "from");
    const to = pStr(call.params, "to");
    if (from || to) return { from, to };
  }
  const year = pNum(plan.calls[0]?.params ?? {}, "year");
  const month = pNum(plan.calls[0]?.params ?? {}, "month");
  if (year && month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    return { from, to: monthEnd(from) };
  }
  return {};
}
