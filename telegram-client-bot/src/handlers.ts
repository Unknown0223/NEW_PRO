import * as db from "./db.js";
import { isCancelText, isSkipText, matchBottomAction } from "./keyboards.js";
import { T } from "./texts.js";
import type { SessionData, WizardField } from "./types.js";
import { EMPTY_SESSION, OPTIONAL_FIELDS, botCanAdd } from "./types.js";
import { afterField, applySelect, dropWizardCard, gotoConfirm, gotoEditPick, listSelectOpts, promptField, showMenu } from "./flow.js";
import type { Ctx } from "./ctx.js";
import { HTML } from "./ui.js";
import { handleAuthText, handleLogout, handleStart } from "./handlers-auth.js";
import {
  handleViewerExcel,
  handleViewerStats,
  handleAgentMy,
  handleConfirmSave
} from "./handlers-menu.js";
import { handleVisitDayToggle, handleWizardLocation, handleWizardText } from "./handlers-wizard.js";

export function createBotHandlers(opts: {
  databaseUrl: string;
  tenantSlug: string;
  apiUrl: string;
  apiSecret: string;
}) {
  const { databaseUrl, tenantSlug, apiUrl, apiSecret } = opts;
  const api = { apiUrl, apiSecret, tenantSlug };

  async function startWizard(ctx: Ctx, sess: SessionData) {
    await dropWizardCard(ctx, sess);
    sess.draft = {};
    sess.editFromConfirm = false;
    sess.selectPage = 0;
    sess.selectQ = "";
    sess.weekdays = [];
    sess.wizardMsgId = 0;
    sess.wizardChatId = ctx.chat?.id ?? 0;
    sess.wizardKbKind = "";
    sess.wizardError = "";
    await promptField(ctx, sess, "name", databaseUrl, tenantSlug);
  }

  async function cancelToMenu(ctx: Ctx, sess: SessionData) {
    const user = ctx.from ? await db.getBotUser(databaseUrl, ctx.from.id) : null;
    await dropWizardCard(ctx, sess);
    Object.assign(sess, EMPTY_SESSION());
    await ctx.reply(T.cancelled, HTML);
    if (user) await showMenu(ctx, user);
  }

  async function onMenuAction(ctx: Ctx, sess: SessionData, action: string) {
    const user = ctx.from ? await db.getBotUser(databaseUrl, ctx.from.id) : null;
    if (!user && action !== "out") {
      await ctx.reply(T.notAuthed, HTML);
      return;
    }
    if (action === "add" && user) {
      if (!botCanAdd(user)) {
        await ctx.reply(T.addAgentOnly, HTML);
        return;
      }
      return startWizard(ctx, sess);
    }
    if (action === "my" && user) {
      if (!botCanAdd(user)) {
        await ctx.reply(T.addAgentOnly, HTML);
        return;
      }
      return handleAgentMy(ctx, user, databaseUrl);
    }
    if (action === "stats" && user) return handleViewerStats(ctx, user, databaseUrl, api);
    if (action === "excel" && user) return handleViewerExcel(ctx, user, databaseUrl, api);
    if (action === "out") return handleLogout(ctx, sess, databaseUrl);
    if (action === "confirm" && user && (sess.step === "confirm" || sess.step === "idle")) {
      if (sess.step === "confirm") return handleConfirmSave(ctx, sess, user, databaseUrl);
      return;
    }
    if (action === "edit" && sess.step === "confirm") {
      return gotoEditPick(ctx, sess);
    }
    if (action === "retry") {
      if (sess.step === "confirm" && user) return handleConfirmSave(ctx, sess, user, databaseUrl);
      if (sess.step.startsWith("w:")) {
        const field = sess.step.slice(2) as WizardField;
        return promptField(ctx, sess, field, databaseUrl, tenantSlug);
      }
    }
  }

  async function onCallback(ctx: Ctx, sess: SessionData, data: string) {
    await ctx.answerCallbackQuery?.();
    if (data === "p:noop") return;
    const user = ctx.from ? await db.getBotUser(databaseUrl, ctx.from.id) : null;
    if (!user && data !== "k:cancel" && data !== "m:out") {
      await ctx.reply(T.notAuthed, HTML);
      return;
    }
    if (data === "m:add" && user) {
      if (!botCanAdd(user)) {
        await ctx.reply(T.addAgentOnly, HTML);
        return;
      }
      return startWizard(ctx, sess);
    }
    if (data === "m:my" && user) {
      if (!botCanAdd(user)) {
        await ctx.reply(T.addAgentOnly, HTML);
        return;
      }
      return handleAgentMy(ctx, user, databaseUrl);
    }
    if (data === "m:st" && user) return handleViewerStats(ctx, user, databaseUrl, api);
    if (data === "m:xl" && user) return handleViewerExcel(ctx, user, databaseUrl, api);
    if (data === "m:out") return handleLogout(ctx, sess, databaseUrl);
    if (data === "k:cancel") return cancelToMenu(ctx, sess);
    if (data === "k:skip" && sess.step.startsWith("w:")) {
      const field = sess.step.slice(2) as WizardField;
      if (!OPTIONAL_FIELDS.has(field)) return;
      return afterField(ctx, sess, field, databaseUrl, tenantSlug);
    }
    if (data === "c:ok" && user && sess.step === "confirm") {
      return handleConfirmSave(ctx, sess, user, databaseUrl);
    }
    if (data === "c:ed") {
      return gotoEditPick(ctx, sess);
    }
    if (data === "c:back") return gotoConfirm(ctx, sess);
    if (data.startsWith("e:")) {
      const field = data.slice(2) as WizardField;
      sess.editFromConfirm = true;
      sess.selectPage = 0;
      sess.selectQ = "";
      sess.weekdays = sess.draft.visit_weekdays ?? [];
      return promptField(ctx, sess, field, databaseUrl, tenantSlug);
    }
    if (await handleVisitDayToggle(ctx, sess, data, databaseUrl, tenantSlug)) return;
    if ((data === "p:next" || data === "p:prev") && sess.step.startsWith("w:")) {
      sess.selectPage += data === "p:next" ? 1 : -1;
      const field = sess.step.slice(2) as WizardField;
      return promptField(ctx, sess, field, databaseUrl, tenantSlug);
    }
    if (data.startsWith("s:") && sess.step.startsWith("w:")) {
      const field = sess.step.slice(2) as WizardField;
      const idx = Number(data.slice(2));
      const { opts } = await listSelectOpts(ctx, sess, field, databaseUrl, tenantSlug);
      const opt = opts[idx];
      if (!opt) return;
      const cityCleared = applySelect(sess, field, opt);
      if (cityCleared && field === "region") {
        sess.editFromConfirm = false;
        sess.selectPage = 0;
        sess.selectQ = "";
        return promptField(ctx, sess, "city", databaseUrl, tenantSlug);
      }
      await afterField(ctx, sess, field, databaseUrl, tenantSlug);
    }
  }

  return {
    onStart: (ctx: Ctx, sess: SessionData) => handleStart(ctx, sess, databaseUrl, api),

    async onText(ctx: Ctx, sess: SessionData, text: string) {
      if (isCancelText(text)) {
        await cancelToMenu(ctx, sess);
        return;
      }
      if (await handleAuthText(ctx, sess, text, databaseUrl, api)) return;
      const user = ctx.from ? await db.getBotUser(databaseUrl, ctx.from.id) : null;
      if (!user) {
        await ctx.reply(T.notAuthed, HTML);
        return;
      }
      const action = matchBottomAction(text);
      if (action) {
        await onMenuAction(ctx, sess, action);
        return;
      }
      if (isSkipText(text) && sess.step.startsWith("w:")) {
        const field = sess.step.slice(2) as WizardField;
        if (OPTIONAL_FIELDS.has(field)) {
          await afterField(ctx, sess, field, databaseUrl, tenantSlug);
          return;
        }
      }
      await handleWizardText(ctx, sess, text, databaseUrl, tenantSlug);
    },

    onLocation: (ctx: Ctx, sess: SessionData, lat: number, lon: number) =>
      handleWizardLocation(ctx, sess, lat, lon, databaseUrl, tenantSlug),

    onCallback
  };
}
