import { prisma } from "../../config/database";
import { buildClientReconciliationXlsxBuffer } from "../clients/client-reconciliation.xlsx";
import { loadClientReconciliation } from "../clients/client-reconciliation.load";
import { getClientReconciliationPdfBuffer } from "../clients/clients.detail";
import { notifyUsers } from "../payroll/payroll.notify";
import { tgChatAction, tgSendDocument } from "./tg-api";
import {
  loadClientOrder,
  loadClientOrdersPage,
  loadClientPayments,
  loadClientReturns,
  loadClientSummary
} from "./tg-client-data";
import type { ClientIdentity } from "./tg-identity";
import { clearState, dropIncoming, flash, setState, show, type ChatCtx, type View } from "./tg-screen";
import { L, t, type Lang } from "./tg-text";
import {
  btn,
  cb,
  esc,
  fmtDate,
  fmtDateTime,
  grid,
  kb,
  money,
  num,
  pagerRow,
  periodRange,
  statusEmoji,
  ymdToUtcEnd,
  ymdToUtcStart
} from "./tg-ui.pure";

const STATUS: Record<string, [string, string]> = {
  new: ["Yangi", "Новый"],
  confirmed: ["Tasdiqlangan", "Подтверждён"],
  picking: ["Yig‘ilmoqda", "Сборка"],
  delivering: ["Yo‘lda", "В пути"],
  delivered: ["Yetkazildi", "Доставлен"],
  returned: ["Qaytarildi", "Возврат"],
  cancelled: ["Bekor qilingan", "Отменён"]
};

export function statusLabel(lang: Lang, s: string): string {
  const p = STATUS[s];
  return `${statusEmoji(s)} ${p ? (lang === "ru" ? p[1] : p[0]) : s}`;
}

const backHome = (lang: Lang) => [btn(t(lang, "home"), cb("m", "home"))];

export async function clientHome(ctx: ChatCtx, id: ClientIdentity): Promise<View> {
  const s = await loadClientSummary(id.tenantId, id.clientId);
  const lang = ctx.lang;
  const lines = [t(lang, "menuClient", { name: esc(id.clientName) }), ""];
  if (s) {
    const debt = s.balance < 0;
    lines.push(`${debt ? "🔴" : "🟢"} ${L(lang, "Balans", "Баланс")}: <b>${money(s.balance)}</b>`);
    if (s.openOrdersCount > 0) lines.push(`📦 ${L(lang, "Jarayonda", "В работе")}: ${s.openOrdersCount} · ${money(s.openOrdersSum)}`);
    if (s.consignmentTotal > 0) lines.push(`🧾 ${L(lang, "Konsignatsiya", "Консигнация")}: ${money(s.consignmentTotal)}`);
  }
  const rows = [
    s && s.overdue > 0 ? [btn(t(lang, "overdue", { sum: money(s.overdue) }), cb("c", "cons"), "danger")] : null,
    [btn(t(lang, "balance"), cb("c", "bal"), "primary"), btn(t(lang, "orders"), cb("c", "ord", 1), "primary")],
    [btn(t(lang, "payments"), cb("c", "pay", 1)), btn(t(lang, "act"), cb("c", "act"))],
    [btn(t(lang, "consignment"), cb("c", "cons")), btn(t(lang, "returns"), cb("c", "ret", 1))],
    [btn(t(lang, "orderRequest"), cb("c", "req"), "success")],
    [btn(t(lang, "myAgent"), cb("c", "agent")), btn(t(lang, "settings"), cb("x", "set"))],
    id.clientIds.length > 1 ? [btn(t(lang, "switchClient"), cb("c", "sw"))] : null
  ];
  return { text: lines.join("\n"), kb: kb(...rows) };
}

export async function clientBalance(ctx: ChatCtx, id: ClientIdentity): Promise<View> {
  const s = await loadClientSummary(id.tenantId, id.clientId);
  const lang = ctx.lang;
  if (!s) return { text: t(lang, "empty"), kb: kb(backHome(lang)) };
  const lines = [
    `💰 <b>${t(lang, "balance").replace(/^\S+\s/, "")}</b> — ${esc(id.clientName)}`,
    "",
    `${s.balance < 0 ? "🔴" : "🟢"} ${L(lang, "Hisob", "Счёт")}: <b>${money(s.balance)}</b>`,
    `💳 ${L(lang, "Kredit limiti", "Кредитный лимит")}: ${money(s.creditLimit)}`,
    `✅ ${L(lang, "Bo‘sh limit", "Доступно")}: <b>${money(Math.max(0, s.headroom))}</b>`,
    `📦 ${L(lang, "Ochiq buyurtmalar", "Открытые заказы")}: ${s.openOrdersCount} · ${money(s.openOrdersSum)}`
  ];
  if (s.consignmentTotal > 0) lines.push(`🧾 ${L(lang, "Konsignatsiya qarzi", "Долг по консигнации")}: ${money(s.consignmentTotal)}`);
  if (s.overdue > 0) lines.push(`⚠️ <b>${L(lang, "Muddati o‘tgan", "Просрочено")}: ${money(s.overdue)}</b>`);
  lines.push("", `<i>${L(lang, "Yangilandi", "Обновлено")}: ${fmtDateTime(new Date())}</i>`);
  return {
    text: lines.join("\n"),
    kb: kb(
      s.overdue > 0 ? [btn(t(lang, "overdue", { sum: money(s.overdue) }), cb("c", "cons"), "danger")] : null,
      [btn(t(lang, "act"), cb("c", "act")), btn(t(lang, "refresh"), cb("c", "bal"))],
      backHome(lang)
    )
  };
}

export async function clientOrders(ctx: ChatCtx, id: ClientIdentity, page: number): Promise<View> {
  const lang = ctx.lang;
  const p = await loadClientOrdersPage(id.tenantId, id.clientId, page);
  if (p.total === 0) return { text: `📦 ${t(lang, "empty")}`, kb: kb(backHome(lang)) };
  const cur = Math.min(Math.max(1, page), p.pages);
  const text = [`📦 <b>${L(lang, "Buyurtmalar", "Заказы")}</b> (${p.total})`, "", ...p.rows.map((o) => `${statusEmoji(o.status)} <b>№${esc(o.number)}</b> · ${fmtDate(o.created_at)} · ${money(o.total_sum)}${o.is_consignment ? " 🧾" : ""}`)].join("\n");
  return {
    text,
    kb: kb(
      ...p.rows.map((o) => [btn(`${statusEmoji(o.status)} №${o.number} · ${money(o.total_sum)}`, cb("c", "o", o.id, cur))]),
      pagerRow("c:ord", cur, p.pages),
      backHome(lang)
    )
  };
}

export async function clientOrderDetail(ctx: ChatCtx, id: ClientIdentity, orderId: number, backPage: number): Promise<View> {
  const lang = ctx.lang;
  const o = await loadClientOrder(id.tenantId, id.clientId, orderId);
  const back = [btn(t(lang, "back"), cb("c", "ord", backPage)), btn(t(lang, "home"), cb("m", "home"))];
  if (!o) return { text: t(lang, "noAccess"), kb: kb(back) };
  const lines = [
    `🧾 <b>№${esc(o.number)}</b> · ${fmtDate(o.created_at)}`,
    statusLabel(lang, o.status),
    "",
    ...o.items.map((i) => `${i.is_bonus ? "🎁" : "•"} ${esc(i.product.name)} — ${num(i.qty, 2)} ${esc(i.product.unit)}${i.is_bonus ? "" : ` · ${money(i.total)}`}`)
  ];
  if (o._count.items > o.items.length) lines.push(`… +${o._count.items - o.items.length}`);
  lines.push("", `💵 ${L(lang, "Jami", "Итого")}: <b>${money(o.total_sum)}</b>`);
  if (o.status === "delivered") {
    lines.push(`✅ ${L(lang, "To‘langan", "Оплачено")}: ${money(o.paid)}`);
    if (o.unpaid > 0) lines.push(`🔴 ${L(lang, "Qoldiq", "Остаток")}: <b>${money(o.unpaid)}</b>`);
  }
  if (o.is_consignment) lines.push(`🧾 ${L(lang, "Konsignatsiya, muddat", "Консигнация, срок")}: ${fmtDate(o.consignment_due_date)}`);
  if (o.agent) lines.push(`👤 ${L(lang, "Agent", "Агент")}: ${esc(o.agent.name)}${o.agent.phone ? ` · ${esc(o.agent.phone)}` : ""}`);
  if (o.expeditor_user && ["delivering", "delivered"].includes(o.status)) {
    lines.push(`🚚 ${L(lang, "Yetkazuvchi", "Экспедитор")}: ${esc(o.expeditor_user.name)}${o.expeditor_user.phone ? ` · ${esc(o.expeditor_user.phone)}` : ""}`);
  }
  return { text: lines.join("\n"), kb: kb([btn(t(lang, "refresh"), cb("c", "o", o.id, backPage))], back) };
}

const PAY_STATUS: Record<string, string> = { confirmed: "✅", pending: "⏳", pending_confirmation: "⏳", rejected: "❌" };

export async function clientPayments(ctx: ChatCtx, id: ClientIdentity, page: number): Promise<View> {
  const lang = ctx.lang;
  const p = await loadClientPayments(id.tenantId, id.clientId, page);
  if (p.total === 0) return { text: `💳 ${t(lang, "empty")}`, kb: kb(backHome(lang)) };
  const cur = Math.min(Math.max(1, page), p.pages);
  const lines = [`💳 <b>${L(lang, "To‘lovlar", "Оплаты")}</b> (${p.total})`, ""];
  for (const r of p.rows) {
    lines.push(`${PAY_STATUS[r.workflow_status] ?? "•"} ${fmtDate(r.paid_at ?? r.created_at)} · <b>${money(r.amount)}</b> · ${esc(r.payment_type)}`);
  }
  return { text: lines.join("\n"), kb: kb(pagerRow("c:pay", cur, p.pages), backHome(lang)) };
}

export async function clientConsignment(ctx: ChatCtx, id: ClientIdentity): Promise<View> {
  const lang = ctx.lang;
  const s = await loadClientSummary(id.tenantId, id.clientId);
  if (!s || s.consignment.length === 0) return { text: `🧾 ${L(lang, "Konsignatsiya qarzi yo‘q", "Долгов по консигнации нет")} ✅`, kb: kb(backHome(lang)) };
  const lines = [`🧾 <b>${L(lang, "Konsignatsiya", "Консигнация")}</b>: ${money(s.consignmentTotal)}`, ""];
  for (const r of s.consignment.slice(0, 15)) {
    lines.push(`${r.overdue ? "🔴" : "🟡"} №${esc(r.number)} · ${money(r.unpaid)} · ${L(lang, "muddat", "срок")} ${fmtDate(r.due)}`);
  }
  if (s.overdue > 0) lines.push("", `⚠️ <b>${L(lang, "Muddati o‘tgan", "Просрочено")}: ${money(s.overdue)}</b>`);
  return {
    text: lines.join("\n"),
    kb: kb(...s.consignment.slice(0, 6).map((r) => [btn(`${r.overdue ? "🔴" : "🟡"} №${r.number} · ${money(r.unpaid)}`, cb("c", "o", r.id, 1), r.overdue ? "danger" : undefined)]), backHome(lang))
  };
}

export async function clientReturns(ctx: ChatCtx, id: ClientIdentity, page: number): Promise<View> {
  const lang = ctx.lang;
  const p = await loadClientReturns(id.tenantId, id.clientId, page);
  if (p.total === 0) return { text: `↩️ ${t(lang, "empty")}`, kb: kb(backHome(lang)) };
  const cur = Math.min(Math.max(1, page), p.pages);
  const lines = [`↩️ <b>${L(lang, "Vozvratlar", "Возвраты")}</b> (${p.total})`, ""];
  for (const r of p.rows) {
    const st = r.status === "posted" ? "✅" : "⏳";
    lines.push(`${st} №${esc(r.number)} · ${fmtDate(r.created_at)} · ${r._count.lines} ${L(lang, "pozitsiya", "поз.")}${r.refund_amount ? ` · ${money(r.refund_amount)}` : ""}`);
  }
  return { text: lines.join("\n"), kb: kb(pagerRow("c:ret", cur, p.pages), backHome(lang)) };
}

export function periodPicker(lang: Lang, prefix: string, backData: string): View {
  const keys: Array<[string, Parameters<typeof t>[1]]> = [["tm", "pTm"], ["pm", "pPm"], ["30", "p30"], ["90", "p90"], ["ty", "pTy"]];
  return {
    text: t(lang, "choosePeriod"),
    kb: kb(...grid(keys.map(([k, label]) => btn(t(lang, label), `${prefix}:${k}`)), 2), [btn(t(lang, "back"), backData)])
  };
}

export function actFormatView(lang: Lang, period: string): View {
  const r = periodRange(period);
  return {
    text: `📄 <b>${L(lang, "Akt sverka", "Акт сверки")}</b>\n📅 ${fmtDate(r.from)} — ${fmtDate(r.to)}`,
    kb: kb(
      [btn(t(lang, "pdf"), cb("c", "actf", period, "pdf"), "primary"), btn(t(lang, "xlsx"), cb("c", "actf", period, "xlsx"), "success")],
      [btn(t(lang, "back"), cb("c", "act"))]
    )
  };
}

export async function sendClientAct(ctx: ChatCtx, id: ClientIdentity, period: string, format: string): Promise<void> {
  const r = periodRange(period);
  const from = ymdToUtcStart(r.from);
  const to = ymdToUtcEnd(r.to);
  await tgChatAction(ctx.chatId, "upload_document");
  const name = `akt-${id.clientId}-${r.from}_${r.to}`;
  const caption = `📄 ${esc(id.clientName)}\n📅 ${fmtDate(r.from)} — ${fmtDate(r.to)}`;
  if (format === "xlsx") {
    const loaded = await loadClientReconciliation(id.tenantId, id.clientId, from, to);
    const buf = await buildClientReconciliationXlsxBuffer(loaded);
    await tgSendDocument(ctx.chatId, buf, `${name}.xlsx`, caption);
  } else {
    const buf = await getClientReconciliationPdfBuffer(id.tenantId, id.clientId, from, to);
    await tgSendDocument(ctx.chatId, buf, `${name}.pdf`, caption);
  }
}

export async function clientAgent(ctx: ChatCtx, id: ClientIdentity): Promise<View> {
  const lang = ctx.lang;
  const s = await loadClientSummary(id.tenantId, id.clientId);
  const a = s?.client.agent;
  if (!a) return { text: `👤 ${t(lang, "noAgent")}`, kb: kb(backHome(lang)) };
  const lines = [`👤 <b>${esc(a.name)}</b>`];
  if (a.phone) lines.push(`📞 ${esc(a.phone)}`);
  return { text: lines.join("\n"), kb: kb([btn(t(lang, "orderRequest"), cb("c", "req"), "success")], backHome(lang)) };
}

export async function askOrderRequest(ctx: ChatCtx): Promise<void> {
  await setState(ctx, { step: "client_request" });
  await show(ctx, { text: t(ctx.lang, "orderRequestAsk"), kb: kb([btn(t(ctx.lang, "cancel"), cb("m", "home"), "danger")]) });
}

export async function onOrderRequest(ctx: ChatCtx, id: ClientIdentity, text: string, incomingId: number): Promise<void> {
  const body = text.trim().slice(0, 1500);
  if (!body) return;
  const client = await prisma.client.findFirst({ where: { id: id.clientId, tenant_id: id.tenantId }, select: { agent_id: true, name: true } });
  await clearState(ctx);
  if (!client?.agent_id) {
    await flash(ctx, t(ctx.lang, "noAgent"), 6);
    return;
  }
  await notifyUsers(id.tenantId, [client.agent_id], {
    title: `🛒 ${client.name}: buyurtma so‘rovi (Telegram)`,
    body,
    href: `/clients/${id.clientId}`
  });
  await dropIncoming(ctx, incomingId);
  await flash(ctx, t(ctx.lang, "orderRequestSent"), 6);
}

export async function clientSwitchView(ctx: ChatCtx, id: ClientIdentity): Promise<View> {
  const clients = await prisma.client.findMany({
    where: { tenant_id: id.tenantId, id: { in: id.clientIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  return {
    text: `🔀 ${L(ctx.lang, "Mijozni tanlang", "Выберите клиента")}:`,
    kb: kb(...clients.map((c) => [btn(`${c.id === id.clientId ? "✅ " : ""}${c.name}`, cb("c", "sw", c.id), c.id === id.clientId ? "success" : undefined)]), backHome(ctx.lang))
  };
}
