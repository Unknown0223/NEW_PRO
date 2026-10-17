import { logger } from "../../config/logger";
import { tgAnswerCallback, type TgCallbackQuery, type TgMessage, type TgUpdate } from "./tg-api";
import {
  askOrderRequest,
  actFormatView,
  clientAgent,
  clientBalance,
  clientConsignment,
  clientHome,
  clientOrderDetail,
  clientOrders,
  clientPayments,
  clientReturns,
  clientSwitchView,
  onOrderRequest,
  periodPicker,
  sendClientAct
} from "./tg-client-screens";
import { resolveBotTenant, resolveIdentity, type Identity } from "./tg-identity";
import { askClientCode, linkPendingView, onClientCode, onClientContact, onClientOrder } from "./tg-link-client";
import { askStaffLogin, onStaffLogin, onStaffPassword, onStaffSmart } from "./tg-link-staff";
import { canViewReports, reportPeriodView, reportSummary, reportsList, sendReportXlsx } from "./tg-reports";
import { clearState, dropIncoming, flash, loadChat, patchChat, show, type ChatCtx, type View } from "./tg-screen";
import { doUnlink, notifyView, settingsView, toggleLang, toggleNotifyType, toggleQuiet, unlinkConfirmView } from "./tg-settings";
import {
  staffCan,
  staffCash,
  staffCompleteTask,
  staffConsignment,
  staffDebts,
  staffHome,
  staffKpi,
  staffPayroll,
  staffStock,
  staffTasks,
  staffTeam,
  staffToday
} from "./tg-staff-screens";
import { L, t } from "./tg-text";
import { btn, cb, kb, parseCb } from "./tg-ui.pure";

/** Bitta foydalanuvchi yangilanishlarini ketma-ket bajarish (poyga holatlarisiz). */
const chains = new Map<string, Promise<void>>();
function exclusive(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
  chains.set(key, next);
  return next;
}

/** Oddiy flood himoyasi: 10 soniyada 25 tadan ortiq amal — e'tiborsiz. */
const hits = new Map<string, number[]>();
function flooding(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((x) => now - x < 10_000);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 10_000) hits.clear();
  return arr.length > 25;
}

function welcomeView(ctx: ChatCtx): View {
  const lang = ctx.lang;
  return {
    text: t(lang, "welcome"),
    kb: kb(
      [btn(t(lang, "iAmClient"), cb("l", "client"), "primary")],
      [btn(t(lang, "iAmStaff"), cb("l", "staff"))],
      [btn(lang === "uz" ? "🌐 Русский" : "🌐 O‘zbekcha", cb("x", "lang"))]
    )
  };
}

async function homeView(ctx: ChatCtx, id: Identity): Promise<View> {
  if (id.kind === "staff") return staffHome(ctx, id);
  if (id.kind === "client") return clientHome(ctx, id);
  if (id.kind === "pending") return linkPendingView(ctx);
  return welcomeView(ctx);
}

async function goHome(ctx: ChatCtx, fresh = false): Promise<void> {
  const id = await resolveIdentity(ctx.tenantId, ctx.telegramId, ctx.row.active_client_id);
  await show(ctx, await homeView(ctx, id), { fresh });
}

async function onMessage(tenantId: number, msg: TgMessage): Promise<void> {
  const from = msg.from!;
  const ctx = await loadChat(tenantId, BigInt(from.id), BigInt(msg.chat.id));
  const text = (msg.text ?? "").trim();
  const step = ctx.state.step;

  if (text.startsWith("/start") || text === "/menu") {
    await dropIncoming(ctx, msg.message_id);
    await clearState(ctx);
    const payload = text.split(/\s+/)[1] ?? "";
    if (payload.startsWith("c_")) {
      await onClientCode(ctx, payload, true);
      return;
    }
    await goHome(ctx, true);
    return;
  }

  if (msg.contact) {
    if (step === "client_phone") {
      await onClientContact(ctx, msg.contact, from.id, msg.message_id);
      if (!ctx.state.step) await goHome(ctx, true);
    } else await dropIncoming(ctx, msg.message_id);
    return;
  }

  if (text && step) {
    switch (step) {
      case "client_code":
        await dropIncoming(ctx, msg.message_id);
        await onClientCode(ctx, text, true);
        return;
      case "client_order":
        await onClientOrder(ctx, text, msg.message_id);
        return;
      case "staff_login":
        await onStaffLogin(ctx, text, msg.message_id);
        return;
      case "staff_password":
        await onStaffPassword(ctx, text, msg.message_id);
        if (!ctx.state.step) await goHome(ctx, true);
        return;
      case "staff_smart":
        await onStaffSmart(ctx, text, msg.message_id);
        if (!ctx.state.step) await goHome(ctx, true);
        return;
      case "client_request": {
        const id = await resolveIdentity(ctx.tenantId, ctx.telegramId, ctx.row.active_client_id);
        if (id.kind === "client") await onOrderRequest(ctx, id, text, msg.message_id);
        else await dropIncoming(ctx, msg.message_id);
        await clearState(ctx);
        await goHome(ctx, true);
        return;
      }
      default:
        await clearState(ctx);
    }
  }
  await dropIncoming(ctx, msg.message_id);
  await goHome(ctx, true);
}

async function onCallback(tenantId: number, q: TgCallbackQuery): Promise<void> {
  if (!q.message) {
    await tgAnswerCallback(q.id);
    return;
  }
  const ctx = await loadChat(tenantId, BigInt(q.from.id), BigInt(q.message.chat.id));
  ctx.cbMessageId = q.message.message_id;
  const p = parseCb(q.data);
  const [area, action, a1, a2] = p;
  if (area === "noop" || p.length === 0) {
    await tgAnswerCallback(q.id);
    return;
  }
  let answered = false;
  const answer = async (text?: string, alert = false) => {
    if (answered) return;
    answered = true;
    await tgAnswerCallback(q.id, text, alert);
  };

  try {
    if (area === "m") {
      await clearState(ctx);
      await answer();
      await goHome(ctx);
      return;
    }
    if (area === "x" && action === "lang") {
      await toggleLang(ctx);
      await answer();
      await goHome(ctx);
      return;
    }
    if (area === "l") {
      await answer();
      if (action === "client") await askClientCode(ctx);
      else if (action === "staff") await askStaffLogin(ctx);
      else if (action === "skip" && ctx.state.step === "client_phone") {
        await onClientContact(ctx, null, q.from.id);
        await goHome(ctx, true);
      } else await goHome(ctx);
      return;
    }

    const id = await resolveIdentity(ctx.tenantId, ctx.telegramId, ctx.row.active_client_id);

    if (area === "x") {
      await answer();
      if (id.kind === "none") return goHome(ctx);
      if (action === "set") return show(ctx, settingsView(ctx, id));
      if (action === "quiet") {
        await toggleQuiet(ctx);
        return show(ctx, settingsView(ctx, id));
      }
      if (action === "nt") {
        if (a1) await toggleNotifyType(ctx, a1);
        return show(ctx, notifyView(ctx, id));
      }
      if (action === "unlink") {
        if (a1 !== "y") return show(ctx, unlinkConfirmView(ctx));
        await doUnlink(ctx, id);
        await show(ctx, { text: t(ctx.lang, "unlinked"), kb: kb([btn(t(ctx.lang, "home"), cb("m", "home"))]) });
        return;
      }
      return goHome(ctx);
    }

    if (area === "c") {
      if (id.kind !== "client") {
        await answer(t(ctx.lang, "noAccess"), true);
        return goHome(ctx);
      }
      const n1 = Number(a1) || 1;
      switch (action) {
        case "bal":
          await answer();
          return show(ctx, await clientBalance(ctx, id));
        case "ord":
          await answer();
          return show(ctx, await clientOrders(ctx, id, n1));
        case "o":
          await answer();
          return show(ctx, await clientOrderDetail(ctx, id, Number(a1), Number(a2) || 1));
        case "pay":
          await answer();
          return show(ctx, await clientPayments(ctx, id, n1));
        case "ret":
          await answer();
          return show(ctx, await clientReturns(ctx, id, n1));
        case "cons":
          await answer();
          return show(ctx, await clientConsignment(ctx, id));
        case "agent":
          await answer();
          return show(ctx, await clientAgent(ctx, id));
        case "act":
          await answer();
          return show(ctx, periodPicker(ctx.lang, "c:actp", cb("m", "home")));
        case "actp":
          await answer();
          return show(ctx, actFormatView(ctx.lang, a1 ?? "tm"));
        case "actf":
          await answer(t(ctx.lang, "loading"));
          await sendClientAct(ctx, id, a1 ?? "tm", a2 === "xlsx" ? "xlsx" : "pdf");
          ctx.cbMessageId = undefined;
          return show(ctx, await clientHome(ctx, id), { fresh: true });
        case "req":
          await answer();
          return askOrderRequest(ctx);
        case "sw":
          await answer();
          if (a1 && id.clientIds.includes(Number(a1))) {
            await patchChat(ctx, { active_client_id: Number(a1) });
            return goHome(ctx);
          }
          return show(ctx, await clientSwitchView(ctx, id));
        default:
          await answer();
          return goHome(ctx);
      }
    }

    if (area === "s" || area === "r") {
      if (id.kind !== "staff") {
        await answer(t(ctx.lang, "noAccess"), true);
        return goHome(ctx);
      }
      if (area === "r") {
        if (!canViewReports(id)) {
          await answer(t(ctx.lang, "noAccess"), true);
          return;
        }
        if (action === "x") {
          await answer(t(ctx.lang, "loading"));
          const ok = await sendReportXlsx(ctx, id, Number(a1), a2 ?? "tm");
          if (!ok) await flash(ctx, t(ctx.lang, "noAccess"), 6);
          ctx.cbMessageId = undefined;
          return show(ctx, await reportSummary(ctx, id, Number(a1), a2 ?? "tm"), { fresh: true });
        }
        await answer(action === "v" ? t(ctx.lang, "loading") : undefined);
        if (action === "o") return show(ctx, await reportPeriodView(ctx, id, Number(a1)));
        if (action === "v") return show(ctx, await reportSummary(ctx, id, Number(a1), a2 ?? "tm"));
        return show(ctx, await reportsList(ctx, id, Number(a1) || 1));
      }
      const section = action === "tdone" ? "tasks" : action;
      if (!staffCan(id, section)) {
        await answer(t(ctx.lang, "noAccess"), true);
        return;
      }
      await answer();
      switch (action) {
        case "today":
          return show(ctx, await staffToday(ctx, id));
        case "kpi":
          return show(ctx, await staffKpi(ctx, id));
        case "team":
          return show(ctx, await staffTeam(ctx, id));
        case "cons":
          return show(ctx, await staffConsignment(ctx, id));
        case "debt":
          return show(ctx, await staffDebts(ctx, id));
        case "cash":
          return show(ctx, await staffCash(ctx, id));
        case "stock":
          return show(ctx, await staffStock(ctx, id));
        case "tasks":
          return show(ctx, await staffTasks(ctx, id));
        case "tdone": {
          const ok = await staffCompleteTask(id, Number(a1));
          if (ok) await flash(ctx, "✅", 4);
          return show(ctx, await staffTasks(ctx, id));
        }
        case "pay":
          return show(ctx, await staffPayroll(ctx, id, Number(a1) || 0));
        default:
          return goHome(ctx);
      }
    }
    await answer();
    await goHome(ctx);
  } catch (e) {
    logger.warn({ err: e, data: q.data }, "tg-app callback failed");
    await answer(L(ctx.lang, "⚠️ Xatolik. Qayta urinib ko‘ring.", "⚠️ Ошибка. Попробуйте ещё раз."), true);
  }
}

export async function handleUpdate(u: TgUpdate): Promise<void> {
  const tenant = await resolveBotTenant();
  if (!tenant) return;
  const from = u.callback_query?.from ?? u.message?.from;
  const chatType = u.callback_query?.message?.chat.type ?? u.message?.chat.type;
  if (!from || from.is_bot || chatType !== "private") return;
  const key = String(from.id);
  if (flooding(key)) {
    if (u.callback_query) await tgAnswerCallback(u.callback_query.id);
    return;
  }
  await exclusive(key, async () => {
    try {
      if (u.callback_query) await onCallback(tenant.id, u.callback_query);
      else if (u.message) await onMessage(tenant.id, u.message);
    } catch (e) {
      logger.warn({ err: e, update: u.update_id }, "tg-app update failed");
    }
  });
}
