import {
  cancelInlineKb,
  confirmInlineKb,
  daysKb,
  editFieldsKb,
  inlineMarkup,
  locationKb,
  mainMenuKb,
  selectKb,
  skipKb
} from "./keyboards.js";
import * as db from "./db.js";
import { applySelectToDraft, selectOptionsFor } from "./salec-refs.js";
import { wizardScreen, T } from "./texts.js";
import type { BotUser, ClientDraft, RefOption, SessionData, WizardField, WizardKbKind } from "./types.js";
import { SELECT_FIELDS, OPTIONAL_FIELDS, WIZARD_ORDER, botCanDownload } from "./types.js";
import type { Ctx } from "./ctx.js";
import { htmlKb } from "./ui.js";

export function nextField(cur: WizardField): WizardField | "confirm" {
  const i = WIZARD_ORDER.indexOf(cur);
  if (i < 0 || i >= WIZARD_ORDER.length - 1) return "confirm";
  return WIZARD_ORDER[i + 1]!;
}

export function asDraft(p: Partial<ClientDraft>): ClientDraft {
  return {
    name: p.name ?? "",
    legal_name: p.legal_name ?? "",
    address: p.address ?? "",
    phone: p.phone ?? "",
    responsible_person: p.responsible_person ?? "",
    landmark: p.landmark ?? "",
    inn: p.inn ?? "",
    pinfl: p.pinfl ?? "",
    sales_channel: p.sales_channel ?? "",
    sales_channel_label: p.sales_channel_label ?? "",
    category: p.category ?? "",
    category_label: p.category_label ?? "",
    client_type: p.client_type ?? "",
    client_type_label: p.client_type_label ?? "",
    client_format: p.client_format ?? "",
    client_format_label: p.client_format_label ?? "",
    city: p.city ?? "",
    city_label: p.city_label ?? "",
    region: p.region ?? "",
    region_label: p.region_label ?? "",
    zone: p.zone ?? "",
    lat: p.lat ?? null,
    lon: p.lon ?? null,
    visit_weekdays: p.visit_weekdays ?? []
  };
}

export function shouldEditWizard(prevKind: WizardKbKind | "", nextKind: WizardKbKind): boolean {
  return Boolean(prevKind) && prevKind === nextKind;
}

function messageIdOf(res: unknown): number {
  if (!res || typeof res !== "object") return 0;
  const rec = res as { message_id?: unknown; message?: { message_id?: unknown } };
  const id = rec.message_id ?? rec.message?.message_id;
  return typeof id === "number" && id > 0 ? id : 0;
}

async function deleteWizardMsg(ctx: Ctx, sess: SessionData) {
  const chatId = ctx.chat?.id ?? sess.wizardChatId;
  if (!chatId || !sess.wizardMsgId || !ctx.api?.deleteMessage) {
    sess.wizardMsgId = 0;
    return;
  }
  try {
    await ctx.api.deleteMessage(chatId, sess.wizardMsgId);
  } catch {
    /* ignore */
  }
  sess.wizardMsgId = 0;
}

export async function showWizard(
  ctx: Ctx,
  sess: SessionData,
  text: string,
  opts: { inline?: unknown; replyKb?: unknown; kbKind: WizardKbKind }
) {
  const chatId = ctx.chat?.id ?? sess.wizardChatId;
  if (ctx.chat?.id) sess.wizardChatId = ctx.chat.id;

  // ReplyKeyboard bilan yuborilgan xabarni Telegram tahrirlamaydi — GPS alohida.
  if (opts.kbKind === "location") {
    if (sess.wizardMsgId) await deleteWizardMsg(ctx, sess);
    const sent = await ctx.reply(text, htmlKb(opts.replyKb ?? locationKb()));
    const id = messageIdOf(sent);
    if (id) sess.wizardMsgId = id;
    sess.wizardKbKind = "location";
    sess.wizardError = "";
    return;
  }

  const markup = inlineMarkup(opts.inline ?? cancelInlineKb());
  const canEdit =
    sess.wizardKbKind === "wizard" &&
    sess.wizardMsgId > 0 &&
    Boolean(chatId && ctx.api?.editMessageText);

  if (canEdit) {
    try {
      await ctx.api!.editMessageText(chatId!, sess.wizardMsgId, text, {
        parse_mode: "HTML",
        reply_markup: markup
      });
      sess.wizardError = "";
      return;
    } catch (e) {
      console.warn("[client-intake-bot] edit wizard failed", e instanceof Error ? e.message : e);
    }
  }

  if (sess.wizardMsgId) await deleteWizardMsg(ctx, sess);
  const sent = await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  const id = messageIdOf(sent);
  if (id) sess.wizardMsgId = id;
  sess.wizardKbKind = "wizard";
  sess.wizardError = "";
}

export async function dropWizardCard(ctx: Ctx, sess: SessionData) {
  await deleteWizardMsg(ctx, sess);
  sess.wizardKbKind = "";
}

export async function showMenu(ctx: Ctx, user: BotUser) {
  const text = botCanDownload(user) ? T.viewerMenu(user.role) : T.agentMenu;
  await ctx.reply(text, htmlKb(mainMenuKb(user)));
}

export async function listSelectOpts(
  ctx: Ctx,
  sess: SessionData,
  field: WizardField,
  databaseUrl: string,
  tenantSlug: string
): Promise<{ opts: RefOption[]; scoped: boolean }> {
  const user = ctx.from ? await db.getBotUser(databaseUrl, ctx.from.id) : null;
  const packed = await selectOptionsFor(
    databaseUrl,
    tenantSlug,
    field,
    user?.salec_user_id ?? 0,
    sess.draft
  );
  let opts = packed.opts;
  if (sess.selectQ) {
    const q = sess.selectQ.toLowerCase();
    opts = opts.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }
  return { opts, scoped: packed.scoped };
}

export async function promptField(
  ctx: Ctx,
  sess: SessionData,
  field: WizardField,
  databaseUrl: string,
  tenantSlug: string
) {
  sess.step = `w:${field}`;
  const err = sess.wizardError;
  if (SELECT_FIELDS.has(field)) {
    const { opts, scoped } = await listSelectOpts(ctx, sess, field, databaseUrl, tenantSlug);
    if (opts.length === 0 && field === "region" && !sess.selectQ && !sess.editFromConfirm) {
      await afterField(ctx, sess, field, databaseUrl, tenantSlug);
      return;
    }
    const src = scoped ? "hududingiz" : "spravochnik";
    const extra =
      opts.length === 0
        ? "<i>🟠 Ro‘yxat bo‘sh — qidiruvni o‘zgartiring yoki bekor qiling</i>"
        : `<i>🔹 ${opts.length} ta variant</i> · ${src} · tugmani bosing`;
    await showWizard(ctx, sess, wizardScreen(sess.draft, field, extra, err), {
      inline: selectKb(opts, sess.selectPage, field),
      kbKind: "wizard"
    });
    return;
  }
  if (field === "location") {
    await showWizard(ctx, sess, wizardScreen(sess.draft, field, "", err), {
      replyKb: locationKb(),
      kbKind: "location"
    });
    return;
  }
  if (field === "visit_weekdays") {
    await showWizard(ctx, sess, wizardScreen(sess.draft, field, "", err), {
      inline: daysKb(sess.weekdays),
      kbKind: "wizard"
    });
    return;
  }
  await showWizard(ctx, sess, wizardScreen(sess.draft, field, "", err), {
    inline: OPTIONAL_FIELDS.has(field) ? skipKb() : cancelInlineKb(),
    kbKind: "wizard"
  });
}

export async function gotoConfirm(ctx: Ctx, sess: SessionData) {
  sess.step = "confirm";
  await showWizard(ctx, sess, wizardScreen(sess.draft, "confirm", "", sess.wizardError), {
    inline: confirmInlineKb(),
    kbKind: "wizard"
  });
}

export async function gotoEditPick(ctx: Ctx, sess: SessionData) {
  sess.step = "edit_pick";
  await showWizard(ctx, sess, wizardScreen(sess.draft, "edit_pick"), {
    inline: editFieldsKb(),
    kbKind: "wizard"
  });
}

export function applySelect(sess: SessionData, field: WizardField, opt: RefOption): boolean {
  return applySelectToDraft(sess.draft, field, opt);
}

export async function afterField(
  ctx: Ctx,
  sess: SessionData,
  field: WizardField,
  databaseUrl: string,
  tenantSlug: string
) {
  sess.wizardError = "";
  if (sess.editFromConfirm) {
    sess.editFromConfirm = false;
    await gotoConfirm(ctx, sess);
    return;
  }
  const n = nextField(field);
  if (n === "confirm") {
    await gotoConfirm(ctx, sess);
    return;
  }
  sess.selectPage = 0;
  sess.selectQ = "";
  sess.weekdays = sess.draft.visit_weekdays ?? [];
  await promptField(ctx, sess, n, databaseUrl, tenantSlug);
}
