import { InputFile } from "grammy";
import { EXCEL_MIN_CLIENTS } from "./config.js";
import * as db from "./db.js";
import { buildIntakeExcelBuffer } from "./excel.js";
import { missingRequiredFields } from "./quality.js";
import { asDraft, dropWizardCard, showWizard } from "./flow.js";
import { T, formatMyList, wizardScreen } from "./texts.js";
import { confirmInlineKb, mainMenuKb } from "./keyboards.js";
import { checkDraftAgainstSalec } from "./salec.js";
import { apiIntakeScope } from "./salec-api.js";
import type { BotUser, SessionData } from "./types.js";
import { EMPTY_SESSION, botCanAdd, botCanDownload } from "./types.js";
import type { Ctx } from "./ctx.js";
import { HTML, htmlKb, esc } from "./ui.js";

type ApiCfg = { apiUrl: string; apiSecret: string; tenantSlug: string };

async function scopedAgentIds(
  ctx: Ctx,
  user: BotUser,
  api: ApiCfg
): Promise<{ ok: true; agentIds: number[] } | { ok: false; message: string }> {
  if (!ctx.from) return { ok: false, message: "Telegram ID yo‘q." };
  const scope = await apiIntakeScope(api, ctx.from.id);
  if (!scope.ok) return { ok: false, message: scope.message };
  return { ok: true, agentIds: scope.scope.agent_ids };
}

export async function handleAgentMy(ctx: Ctx, user: BotUser, databaseUrl: string) {
  const rows = await db.listClientsByAgents(databaseUrl, user.tenant_id, [user.salec_user_id]);
  await ctx.reply(formatMyList(rows), htmlKb(mainMenuKb(user)));
}

export async function handleViewerStats(
  ctx: Ctx,
  user: BotUser,
  databaseUrl: string,
  api: ApiCfg
) {
  if (!botCanDownload(user)) {
    await ctx.reply(T.excelAgentDenied, HTML);
    return;
  }
  const scoped = await scopedAgentIds(ctx, user, api);
  if (!scoped.ok) {
    await ctx.reply(`🔴 ${scoped.message}`, htmlKb(mainMenuKb(user)));
    return;
  }
  if (scoped.agentIds.length === 0) {
    await ctx.reply(T.scopeEmpty, htmlKb(mainMenuKb(user)));
    return;
  }
  const rows = await db.listClientsByAgents(databaseUrl, user.tenant_id, scoped.agentIds);
  const by = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.agent_name ?? r.agent_user_id} (${r.agent_smart_code})`;
    by.set(key, (by.get(key) ?? 0) + 1);
  }
  const lines = [...by.entries()].map(([k, v]) => `🟢 <b>${esc(k)}</b>  ·  <code>${v}</code>`);
  await ctx.reply(
    `🟣 <b>Scope statistikasi</b> · <i>${esc(user.role)}</i>\n━━━━━━━━━━━━━━\n📦 Jami: <b>${rows.length}</b> · agent: <b>${scoped.agentIds.length}</b>\n\n${lines.join("\n") || "<i>Hali yo‘q.</i>"}`,
    htmlKb(mainMenuKb(user))
  );
}

export async function handleViewerExcel(
  ctx: Ctx,
  user: BotUser,
  databaseUrl: string,
  api: ApiCfg
) {
  if (!botCanDownload(user)) {
    await ctx.reply(T.excelAgentDenied, HTML);
    return;
  }
  const scoped = await scopedAgentIds(ctx, user, api);
  if (!scoped.ok) {
    await ctx.reply(`🔴 ${scoped.message}`, htmlKb(mainMenuKb(user)));
    return;
  }
  if (scoped.agentIds.length === 0) {
    await ctx.reply(T.scopeEmpty, htmlKb(mainMenuKb(user)));
    return;
  }
  const rows = await db.listClientsByAgents(databaseUrl, user.tenant_id, scoped.agentIds);
  if (rows.length < EXCEL_MIN_CLIENTS) {
    await ctx.reply(T.excelNeed5(rows.length, EXCEL_MIN_CLIENTS), htmlKb(mainMenuKb(user)));
    return;
  }
  const buf = await buildIntakeExcelBuffer(rows);
  await ctx.replyWithDocument?.(
    new InputFile(buf, `mijozlar_import_${new Date().toISOString().slice(0, 10)}.xlsx`),
    { caption: T.excelCleared(rows.length), parse_mode: "HTML" }
  );
  await db.deleteClientsByIds(
    databaseUrl,
    rows.map((r) => r.id)
  );
}

/** @deprecated alias */
export const handleSvrStats = handleViewerStats;
/** @deprecated alias */
export const handleSvrExcel = handleViewerExcel;

export async function handleConfirmSave(
  ctx: Ctx,
  sess: SessionData,
  user: BotUser,
  databaseUrl: string
) {
  const draft = asDraft(sess.draft);
  const miss = missingRequiredFields(draft);
  if (miss.length) {
    sess.step = "confirm";
    sess.wizardError = `Majburiy maydonlar to‘liq emas: ${miss.join(", ")}.`;
    await showWizard(ctx, sess, wizardScreen(sess.draft, "confirm", "", sess.wizardError), {
      inline: confirmInlineKb(),
      kbKind: "wizard"
    });
    return;
  }
  const extra = (await db.listClientsForTenant(databaseUrl, user.tenant_id)).map((r) => ({
    name: r.payload.name,
    phoneDigits: r.payload.phone,
    inn: r.payload.inn,
    pinfl: r.payload.pinfl,
    lat: r.payload.lat,
    lon: r.payload.lon
  }));
  const qErr = await checkDraftAgainstSalec(databaseUrl, user.tenant_id, draft, extra);
  if (qErr) {
    sess.step = "confirm";
    sess.wizardError = esc(qErr);
    await showWizard(ctx, sess, wizardScreen(sess.draft, "confirm", "", sess.wizardError), {
      inline: confirmInlineKb(),
      kbKind: "wizard"
    });
    return;
  }
  if (!botCanAdd(user)) {
    await dropWizardCard(ctx, sess);
    Object.assign(sess, EMPTY_SESSION());
    await ctx.reply(T.addAgentOnly, htmlKb(mainMenuKb(user)));
    return;
  }
  await db.insertClient(databaseUrl, {
    tenant_id: user.tenant_id,
    agent_user_id: user.salec_user_id,
    agent_telegram_id: user.telegram_id,
    agent_smart_code: user.smart_code,
    agent_code: user.agent_code,
    agent_name: user.display_name,
    payload: draft
  });
  await dropWizardCard(ctx, sess);
  Object.assign(sess, EMPTY_SESSION());
  await ctx.reply(T.saved, htmlKb(mainMenuKb(user)));
}
