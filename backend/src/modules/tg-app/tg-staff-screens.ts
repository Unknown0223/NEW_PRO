import { prisma } from "../../config/database";
import { getMobileAgentDashboard } from "../mobile/mobile-agent-orders.service";
import { getMobileAgentKpi } from "../mobile/mobile-agent-kpi.service";
import { getSupervisorTeamKpi } from "../mobile/mobile-supervisor-kpi.service";
import { getMobileExpeditorDashboard } from "../mobile/mobile.expeditor.workflow.deliver";
import { completeTask } from "../tasks/tasks.service";
import { hasPerm, type StaffIdentity } from "./tg-identity";
import type { ChatCtx, View } from "./tg-screen";
import {
  loadAgentsToday,
  loadCashToday,
  loadMyConsignment,
  loadMyPayroll,
  loadMyTasks,
  loadSalesToday,
  loadStaffScope,
  loadStockSummary,
  loadTopDebtors,
  teamAgentIds
} from "./tg-staff-data";
import { L, t, type Lang } from "./tg-text";
import { bar, btn, cb, esc, fmtDate, fmtDateTime, kb, money, num, todayYmd } from "./tg-ui.pure";

export const PERM = {
  sales: ["dashboard.prodazhi.view"],
  debts: ["cash.balansy_klientov.view", "dashboard.finansy.view", "finance.obzor.view"],
  cash: ["cash.kassa.view"],
  stock: ["warehouse.ostatki.view"],
  reports: ["reports.konstruktor.view"]
} as const;

export function staffCan(id: StaffIdentity, section: string): boolean {
  const r = id.user.role;
  switch (section) {
    case "kpi":
      return r === "agent" || r === "supervisor";
    case "team":
      return r === "supervisor" || hasPerm(id, ...PERM.sales);
    case "cons":
      return r === "agent";
    case "sales":
      return hasPerm(id, ...PERM.sales);
    case "debt":
      return hasPerm(id, ...PERM.debts);
    case "cash":
      return hasPerm(id, ...PERM.cash);
    case "stock":
      return hasPerm(id, ...PERM.stock);
    case "reports":
      return hasPerm(id, ...PERM.reports);
    default:
      return true;
  }
}

const homeRow = (lang: Lang) => [btn(t(lang, "home"), cb("m", "home"))];
const refreshRow = (lang: Lang, data: string) => [btn(t(lang, "refresh"), data), btn(t(lang, "home"), cb("m", "home"))];

export function staffHome(ctx: ChatCtx, id: StaffIdentity): View {
  const lang = ctx.lang;
  const s = (key: string) => staffCan(id, key);
  const items = [
    btn(t(lang, "today"), cb("s", "today"), "primary"),
    s("kpi") ? btn(t(lang, "kpi"), cb("s", "kpi"), "primary") : null,
    s("team") ? btn(t(lang, "team"), cb("s", "team")) : null,
    s("cons") ? btn(t(lang, "myConsignment"), cb("s", "cons")) : null,
    s("debt") ? btn(t(lang, "debts"), cb("s", "debt")) : null,
    s("cash") ? btn(t(lang, "cash"), cb("s", "cash")) : null,
    s("stock") ? btn(t(lang, "stock"), cb("s", "stock")) : null,
    btn(t(lang, "tasks"), cb("s", "tasks")),
    btn(t(lang, "payroll"), cb("s", "pay", 0)),
    s("reports") ? btn(t(lang, "reports"), cb("r", "list"), "success") : null
  ].filter((b): b is NonNullable<typeof b> => b != null);
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  rows.push([btn(t(lang, "settings"), cb("x", "set"))]);
  return {
    text: `👔 <b>${esc(id.user.name)}</b>\n<i>${esc(id.user.role)}</i> · ${fmtDate(new Date())}`,
    kb: kb(...rows)
  };
}

export async function staffToday(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  const lines: string[] = [`📊 <b>${L(lang, "Bugun", "Сегодня")}</b> · ${fmtDate(new Date())}`, ""];
  if (id.user.role === "agent") {
    const d = await getMobileAgentDashboard(id.tenantId, id.user.id);
    lines.push(
      `🛒 ${L(lang, "Buyurtmalar", "Заказы")}: <b>${d.orders_today}</b> · ${money(d.orders_sum_today)}`,
      `📍 ${L(lang, "Vizitlar", "Визиты")}: ${d.visits_today}`,
      `🏪 ${L(lang, "Mijozlar", "Клиенты")}: ${d.clients_count}`
    );
    if (d.plan_sum > 0) lines.push(`🎯 ${L(lang, "Oylik reja", "План месяца")}: ${money(d.plan_sum)}`);
    if (d.pending_offline > 0) lines.push(`⏳ ${L(lang, "Sinxronlanmagan", "Не синхронизировано")}: ${d.pending_offline}`);
  } else if (id.user.role === "expeditor") {
    const d = await getMobileExpeditorDashboard(id.tenantId, id.user.id);
    lines.push(
      `🚚 ${L(lang, "Yetkazildi", "Доставлено")}: <b>${d.daily_report.visited}</b> / ${d.daily_report.visit_total}`,
      bar(d.daily_report.performance_pct),
      `⏳ ${L(lang, "Qoldi", "Осталось")}: ${d.daily_report.remaining}`,
      "",
      `💵 ${L(lang, "Tasdiqlangan to‘lov", "Подтверждено оплат")}: ${money(d.payments.confirmed_sum)} (${d.payments.confirmed_count})`,
      `⏳ ${L(lang, "Tasdiq kutmoqda", "Ждут подтверждения")}: ${money(d.payments.pending_sum)} (${d.payments.pending_count})`
    );
  } else {
    const scope = await loadStaffScope(id);
    const agentIds = id.user.role === "supervisor" ? await teamAgentIds(id.tenantId, id.user.id) : scope.agentIds;
    if (!staffCan(id, "sales") && id.user.role !== "supervisor") {
      lines.push(L(lang, "Bugungi ko‘rsatkichlar uchun ruxsat yo‘q. Vazifalar va oylik bo‘limidan foydalaning.", "Нет доступа к показателям дня. Используйте задачи и зарплату."));
    } else {
      const d = await loadSalesToday(id.tenantId, agentIds);
      lines.push(
        `🛒 ${L(lang, "Buyurtmalar", "Заказы")}: <b>${d.ordersCount}</b> · ${money(d.ordersSum)}`,
        `✔️ ${L(lang, "Yetkazildi", "Доставлено")}: ${d.deliveredCount} · ${money(d.deliveredSum)}`,
        `💵 ${L(lang, "To‘lovlar", "Оплаты")}: ${d.paymentsCount} · ${money(d.paymentsSum)}`,
        "",
        `🆕 ${L(lang, "Yangi (tasdiqlanmagan)", "Новые (не подтверждены)")}: ${d.newCount}`,
        `🚚 ${L(lang, "Yo‘lda", "В пути")}: ${d.delivering}`
      );
      if (d.pendingPayCount > 0) lines.push(`⏳ ${L(lang, "Tasdiq kutayotgan to‘lovlar", "Оплаты ждут подтверждения")}: ${d.pendingPayCount} · ${money(d.pendingPaySum)}`);
    }
  }
  lines.push("", `<i>${fmtDateTime(new Date())}</i>`);
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "today"))) };
}

export async function staffKpi(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  if (id.user.role === "supervisor") {
    const k = await getSupervisorTeamKpi(id.tenantId, id.user.id);
    const lines = [`🎯 <b>${L(lang, "Jamoa KPI", "KPI команды")}</b> · ${k.period.month}`, ""];
    let plan = 0;
    let fact = 0;
    for (const a of k.agents.slice(0, 15)) {
      plan += a.kpi.month.plan_sum;
      fact += a.kpi.month.fact_sum;
      const pct = a.kpi.month.execution_pct;
      lines.push(`${pct != null && pct >= 100 ? "🟢" : pct != null && pct >= 70 ? "🟡" : "🔴"} ${esc(a.name)} — ${money(a.kpi.month.fact_sum)}${pct != null ? ` · ${num(pct)}%` : ""}`);
    }
    if (plan > 0) lines.splice(1, 0, `${L(lang, "Jami", "Итого")}: ${money(fact)} / ${money(plan)}`, bar((fact / plan) * 100));
    return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "kpi"))) };
  }
  const k = await getMobileAgentKpi(id.tenantId, id.user.id);
  const m = k.month;
  const d = k.today;
  const lines = [
    `🎯 <b>KPI</b> · ${k.period.month}`,
    "",
    `<b>${L(lang, "Oy", "Месяц")}</b>`,
    `${L(lang, "Reja", "План")}: ${money(m.plan_sum)}`,
    `${L(lang, "Fakt", "Факт")}: <b>${money(m.fact_sum)}</b>`,
    m.execution_pct != null ? bar(m.execution_pct) : "",
    `${L(lang, "Qoldi", "Осталось")}: ${money(m.remaining_sum)}`,
    m.forecast_pct != null ? `📈 ${L(lang, "Prognoz", "Прогноз")}: ${num(m.forecast_pct)}%` : "",
    "",
    `<b>${L(lang, "Bugun", "Сегодня")}</b>`,
    `${L(lang, "Kunlik reja", "План дня")}: ${money(d.plan_day_sum)}`,
    `${L(lang, "Fakt", "Факт")}: <b>${money(d.sales_sum)}</b>${d.execution_pct != null ? ` · ${num(d.execution_pct)}%` : ""}`,
    `🛒 ${d.orders_count} · 📍 ${d.visits}`
  ].filter((x) => x !== "");
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "kpi"))) };
}

export async function staffTeam(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  let ids: number[];
  if (id.user.role === "supervisor") ids = await teamAgentIds(id.tenantId, id.user.id);
  else {
    const scope = await loadStaffScope(id);
    ids =
      scope.agentIds ??
      (await prisma.user.findMany({ where: { tenant_id: id.tenantId, role: "agent", is_active: true }, select: { id: true }, take: 200 })).map((u) => u.id);
  }
  const rows = await loadAgentsToday(id.tenantId, ids);
  if (rows.length === 0) return { text: `👥 ${t(lang, "empty")}`, kb: kb(homeRow(lang)) };
  const total = rows.reduce((s, r) => s + r.sum, 0);
  const medal = ["🥇", "🥈", "🥉"];
  const lines = [`👥 <b>${L(lang, "Agentlar — bugun", "Агенты — сегодня")}</b>`, `${L(lang, "Jami", "Итого")}: <b>${money(total)}</b>`, ""];
  rows.slice(0, 20).forEach((r, i) => lines.push(`${medal[i] ?? `${i + 1}.`} ${esc(r.name)} — ${money(r.sum)} · 🛒${r.orders} · 📍${r.visits}`));
  const idle = rows.filter((r) => r.orders === 0 && r.visits === 0).length;
  if (idle > 0) lines.push("", `⚠️ ${L(lang, "Faoliyatsiz agentlar", "Без активности")}: ${idle}`);
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "team"))) };
}

export async function staffConsignment(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  const c = await loadMyConsignment(id.tenantId, id.user.id);
  if (!c || !c.enabled) return { text: `🧾 ${L(lang, "Konsignatsiya yoqilmagan", "Консигнация не включена")}`, kb: kb(homeRow(lang)) };
  const lines = [`🧾 <b>${L(lang, "Konsignatsiyam", "Моя консигнация")}</b>`, ""];
  if (c.limit != null) {
    lines.push(`${L(lang, "Limit", "Лимит")}: ${money(c.limit)}`, `${L(lang, "Band", "Занято")}: <b>${money(c.outstanding)}</b>`, bar(c.limit > 0 ? (c.outstanding / c.limit) * 100 : 0), `✅ ${L(lang, "Bo‘sh", "Свободно")}: ${money(c.free)}`);
  } else lines.push(`${L(lang, "Ochiq qarz", "Открытый долг")}: <b>${money(c.outstanding)}</b>`);
  if (c.overdue.length > 0) {
    lines.push("", `🔴 <b>${L(lang, "Muddati o‘tgan", "Просрочено")}: ${c.overdue.length} · ${money(c.overdue.reduce((s, r) => s + r.unpaid, 0))}</b>`);
    c.overdue.slice(0, 8).forEach((r) => lines.push(`• №${esc(r.number)} ${esc(r.client_name)} — ${money(r.unpaid)} · ${fmtDate(r.due)}`));
  }
  if (c.dueSoon.length > 0) {
    lines.push("", `🟡 ${L(lang, "3 kun ichida muddati", "Срок в течение 3 дней")}: ${c.dueSoon.length}`);
    c.dueSoon.slice(0, 5).forEach((r) => lines.push(`• №${esc(r.number)} ${esc(r.client_name)} — ${money(r.unpaid)} · ${fmtDate(r.due)}`));
  }
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "cons"))) };
}

export async function staffDebts(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  const scope = await loadStaffScope(id);
  const agentIds = id.user.role === "supervisor" ? await teamAgentIds(id.tenantId, id.user.id) : scope.agentIds;
  const d = await loadTopDebtors(id.tenantId, agentIds);
  const lines = [`💸 <b>${L(lang, "Qarzdorlik", "Задолженность")}</b>`, `${L(lang, "Jami", "Итого")}: <b>${money(Math.abs(d.total))}</b> · ${d.count} ${L(lang, "mijoz", "клиент.")}`, ""];
  d.rows.forEach((r, i) => lines.push(`${i + 1}. ${esc(r.client.name)} — <b>${money(Math.abs(Number(r.balance)))}</b>${r.client.agent ? ` · ${esc(r.client.agent.name)}` : ""}`));
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "debt"))) };
}

export async function staffCash(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  const scope = await loadStaffScope(id);
  const rows = await loadCashToday(id.tenantId, scope.cashDeskIds);
  if (rows.length === 0) return { text: `🏦 ${t(lang, "empty")}`, kb: kb(homeRow(lang)) };
  const lines = [`🏦 <b>${L(lang, "Kassalar — bugun", "Кассы — сегодня")}</b>`, ""];
  let total = 0;
  for (const r of rows) {
    total += r.todaySum;
    lines.push(`${r.is_closed ? "🔒" : "🟢"} <b>${esc(r.name)}</b>: ${money(r.todaySum)} (${r.todayCount})${r.pendingCount > 0 ? ` · ⏳${r.pendingCount} ${money(r.pendingSum)}` : ""}`);
  }
  lines.splice(1, 0, `${L(lang, "Jami kirim", "Всего приход")}: <b>${money(total)}</b>`);
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "cash"))) };
}

export async function staffStock(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  const scope = await loadStaffScope(id);
  const rows = await loadStockSummary(id.tenantId, scope.warehouseIds);
  if (rows.length === 0) return { text: `📦 ${t(lang, "empty")}`, kb: kb(homeRow(lang)) };
  const lines = [`📦 <b>${L(lang, "Ombor qoldiqlari", "Остатки склада")}</b>`, ""];
  for (const r of rows) {
    lines.push(`🏬 <b>${esc(r.name)}</b>`, `   SKU: ${r.skus} · ${L(lang, "jami", "всего")} ${num(r.qty)} · ${L(lang, "bron", "резерв")} ${num(r.reserved)}${r.outOfStock > 0 ? ` · 🔴 ${L(lang, "tugagan", "нет")} ${r.outOfStock}` : ""}`);
  }
  return { text: lines.join("\n"), kb: kb(refreshRow(lang, cb("s", "stock"))) };
}

export async function staffTasks(ctx: ChatCtx, id: StaffIdentity): Promise<View> {
  const lang = ctx.lang;
  const rows = await loadMyTasks(id.tenantId, id.user.id);
  if (rows.length === 0) return { text: `✅ ${L(lang, "Ochiq vazifalar yo‘q", "Открытых задач нет")} 🎉`, kb: kb(homeRow(lang)) };
  const now = Date.now();
  const lines = [`✅ <b>${L(lang, "Vazifalarim", "Мои задачи")}</b> (${rows.length})`, ""];
  rows.forEach((r) => {
    const late = r.due_at && r.due_at.getTime() < now;
    lines.push(`${late ? "🔴" : r.status === "in_progress" ? "🟡" : "⚪"} ${esc(r.title)}${r.due_at ? ` · ${fmtDate(r.due_at)}` : ""}`);
  });
  return {
    text: lines.join("\n"),
    kb: kb(...rows.slice(0, 6).map((r) => [btn(`✔️ ${r.title.slice(0, 40)}`, cb("s", "tdone", r.id), "success")]), refreshRow(lang, cb("s", "tasks")))
  };
}

export async function staffCompleteTask(id: StaffIdentity, taskId: number): Promise<boolean> {
  try {
    await completeTask(id.tenantId, taskId, id.user.id, { comment: "Telegram" });
    return true;
  } catch {
    return false;
  }
}

const PAYROLL_STATUS: Record<string, [string, string]> = {
  draft: ["📝 Hisoblanmoqda", "📝 Черновик"],
  calculated: ["🧮 Hisoblandi", "🧮 Рассчитано"],
  confirmed: ["✅ Tasdiqlandi", "✅ Подтверждено"],
  paid: ["💵 To‘landi", "💵 Выплачено"],
  closed: ["🔒 Yopildi", "🔒 Закрыто"]
};

const ADV_STATUS: Record<string, string> = { sent: "⏳", approved: "✅", rejected: "❌", paid: "💵" };

export async function staffPayroll(ctx: ChatCtx, id: StaffIdentity, offset: number): Promise<View> {
  const lang = ctx.lang;
  const [y, m] = todayYmd().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - Math.max(0, Math.min(11, offset)), 1));
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const { record, advances } = await loadMyPayroll(id.tenantId, id.user.id, year, month);
  const ym = `${String(month).padStart(2, "0")}.${year}`;
  const nav = [btn("◀️", cb("s", "pay", offset + 1)), btn(ym, "noop"), offset > 0 ? btn("▶️", cb("s", "pay", offset - 1)) : null].filter(
    (b): b is NonNullable<typeof b> => b != null
  );
  const lines = [`💵 <b>${L(lang, "Oyligim", "Моя зарплата")}</b> · ${ym}`, ""];
  if (!record) lines.push(L(lang, "Bu oy uchun hisob hali yo‘q.", "Расчёта за этот месяц пока нет."));
  else {
    const st = PAYROLL_STATUS[record.status];
    lines.push(
      st ? (lang === "ru" ? st[1] : st[0]) : record.status,
      "",
      `${L(lang, "Oklad", "Оклад")}: ${money(record.base_salary)}`,
      `${L(lang, "Ishlagan kun", "Отработано дней")}: ${num(record.worked_days, 1)}`,
      `➕ ${L(lang, "Qo‘shimchalar", "Начисления")}: ${money(record.allowances_total)}`,
      `➖ ${L(lang, "Ushlanmalar", "Удержания")}: ${money(record.deductions_total)}`,
      `💳 ${L(lang, "Avanslar", "Авансы")}: ${money(record.advances_total)}`,
      `<b>${L(lang, "Hisoblangan", "Начислено")}: ${money(record.gross)}</b>`,
      `${L(lang, "To‘langan", "Выплачено")}: ${money(record.paid_total)}`,
      `<b>${L(lang, "Qoldiq", "Остаток")}: ${money(record.balance)}</b>`
    );
  }
  if (advances.length > 0) {
    lines.push("", `<b>${L(lang, "Avans so‘rovlari", "Заявки на аванс")}</b>`);
    advances.forEach((a) => lines.push(`${ADV_STATUS[a.status] ?? "•"} ${fmtDate(a.created_at)} · ${money(a.amount)}`));
  }
  return { text: lines.join("\n"), kb: kb(nav, homeRow(lang)) };
}
