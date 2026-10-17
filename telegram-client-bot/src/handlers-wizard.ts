import { applyInn, applyLatinUpperName, applyPhone, applyPinfl } from "./quality.js";
import { FIELD_LABEL } from "./texts.js";
import type { SessionData, WizardField } from "./types.js";
import { OPTIONAL_FIELDS, SELECT_FIELDS } from "./types.js";
import { afterField, asDraft, promptField } from "./flow.js";
import type { Ctx } from "./ctx.js";
import * as db from "./db.js";
import { checkDraftAgainstSalec } from "./salec.js";

async function deleteUserBubble(ctx: Ctx) {
  try {
    await ctx.deleteMessage?.();
  } catch {
    /* private chat ba'zan o‘chirmaydi */
  }
}

async function rejectAndRetry(
  ctx: Ctx,
  sess: SessionData,
  field: WizardField,
  message: string,
  databaseUrl: string,
  tenantSlug: string
) {
  sess.wizardError = message;
  await promptField(ctx, sess, field, databaseUrl, tenantSlug);
}

async function uniquenessError(
  ctx: Ctx,
  sess: SessionData,
  databaseUrl: string
): Promise<string | null> {
  if (!ctx.from) return null;
  const user = await db.getBotUser(databaseUrl, ctx.from.id);
  if (!user) return null;
  const draft = asDraft(sess.draft);
  const extra = (await db.listClientsForTenant(databaseUrl, user.tenant_id)).map((r) => ({
    name: r.payload.name,
    phoneDigits: r.payload.phone,
    inn: r.payload.inn,
    pinfl: r.payload.pinfl,
    lat: r.payload.lat,
    lon: r.payload.lon
  }));
  try {
    return await checkDraftAgainstSalec(databaseUrl, user.tenant_id, draft, extra);
  } catch (e) {
    console.warn("[client-intake-bot] uniqueness check failed", e);
    return "Unikallikni tekshirib bo‘lmadi. Qayta yuboring.";
  }
}

export async function handleWizardText(
  ctx: Ctx,
  sess: SessionData,
  text: string,
  databaseUrl: string,
  tenantSlug: string
): Promise<boolean> {
  if (!sess.step.startsWith("w:")) return false;
  await deleteUserBubble(ctx);
  const field = sess.step.slice(2) as WizardField;
  const t = text.trim();

  if (SELECT_FIELDS.has(field)) {
    sess.selectQ = t;
    sess.selectPage = 0;
    await promptField(ctx, sess, field, databaseUrl, tenantSlug);
    return true;
  }
  if (
    field === "name" ||
    field === "legal_name" ||
    field === "address" ||
    field === "responsible_person" ||
    field === "landmark"
  ) {
    if (!t && OPTIONAL_FIELDS.has(field)) {
      if (field === "legal_name") sess.draft.legal_name = "";
      else if (field === "responsible_person") sess.draft.responsible_person = "";
      else sess.draft.landmark = "";
      await afterField(ctx, sess, field, databaseUrl, tenantSlug);
      return true;
    }
    const latin = applyLatinUpperName(t, FIELD_LABEL[field]);
    if (!latin.ok) {
      await rejectAndRetry(ctx, sess, field, latin.message, databaseUrl, tenantSlug);
      return true;
    }
    if (field === "name") sess.draft.name = latin.name;
    else if (field === "legal_name") sess.draft.legal_name = latin.name;
    else if (field === "address") sess.draft.address = latin.name;
    else if (field === "responsible_person") sess.draft.responsible_person = latin.name;
    else sess.draft.landmark = latin.name;
    await afterField(ctx, sess, field, databaseUrl, tenantSlug);
    return true;
  }
  if (field === "phone") {
    const phone = applyPhone(t);
    if (!phone.ok) {
      await rejectAndRetry(ctx, sess, field, phone.message, databaseUrl, tenantSlug);
      return true;
    }
    sess.draft.phone = phone.phone;
    const dup = await uniquenessError(ctx, sess, databaseUrl);
    if (dup) {
      sess.draft.phone = "";
      await rejectAndRetry(ctx, sess, field, dup, databaseUrl, tenantSlug);
      return true;
    }
    await afterField(ctx, sess, field, databaseUrl, tenantSlug);
    return true;
  }
  if (field === "inn") {
    const inn = applyInn(t);
    if (!inn.ok) {
      await rejectAndRetry(ctx, sess, field, inn.message, databaseUrl, tenantSlug);
      return true;
    }
    sess.draft.inn = inn.inn;
    if (inn.inn) {
      const dup = await uniquenessError(ctx, sess, databaseUrl);
      if (dup) {
        sess.draft.inn = "";
        await rejectAndRetry(ctx, sess, field, dup, databaseUrl, tenantSlug);
        return true;
      }
    }
    await afterField(ctx, sess, field, databaseUrl, tenantSlug);
    return true;
  }
  if (field === "pinfl") {
    const pinfl = applyPinfl(t);
    if (!pinfl.ok) {
      await rejectAndRetry(ctx, sess, field, pinfl.message, databaseUrl, tenantSlug);
      return true;
    }
    sess.draft.pinfl = pinfl.pinfl;
    if (pinfl.pinfl) {
      const dup = await uniquenessError(ctx, sess, databaseUrl);
      if (dup) {
        sess.draft.pinfl = "";
        await rejectAndRetry(ctx, sess, field, dup, databaseUrl, tenantSlug);
        return true;
      }
    }
    await afterField(ctx, sess, field, databaseUrl, tenantSlug);
    return true;
  }
  if (field === "location" || field === "visit_weekdays") {
    sess.wizardError = field === "location" ? "GPS kerak. Pastdagi 📍 Lokatsiya tugmasini bosing." : "";
    await promptField(ctx, sess, field, databaseUrl, tenantSlug);
    return true;
  }
  await afterField(ctx, sess, field, databaseUrl, tenantSlug);
  return true;
}

export async function handleWizardLocation(
  ctx: Ctx,
  sess: SessionData,
  lat: number,
  lon: number,
  databaseUrl: string,
  tenantSlug: string
) {
  if (sess.step !== "w:location") return;
  await deleteUserBubble(ctx);
  sess.draft.lat = lat;
  sess.draft.lon = lon;
  const dup = await uniquenessError(ctx, sess, databaseUrl);
  if (dup) {
    sess.draft.lat = null;
    sess.draft.lon = null;
    await rejectAndRetry(ctx, sess, "location", dup, databaseUrl, tenantSlug);
    return;
  }
  await afterField(ctx, sess, "location", databaseUrl, tenantSlug);
}

export async function handleVisitDayToggle(
  ctx: Ctx,
  sess: SessionData,
  data: string,
  databaseUrl: string,
  tenantSlug: string
): Promise<boolean> {
  if (sess.step !== "w:visit_weekdays" || !data.startsWith("w:")) return false;
  if (data === "w:done") {
    if (sess.weekdays.length === 0) {
      sess.wizardError = "Kamida <b>bitta kun</b> tanlang.";
      await promptField(ctx, sess, "visit_weekdays", databaseUrl, tenantSlug);
      return true;
    }
    sess.draft.visit_weekdays = [...sess.weekdays].sort((a, b) => a - b);
    await afterField(ctx, sess, "visit_weekdays", databaseUrl, tenantSlug);
    return true;
  }
  const d = Number(data.slice(2));
  if (d >= 1 && d <= 7) {
    sess.weekdays = sess.weekdays.includes(d)
      ? sess.weekdays.filter((x) => x !== d)
      : [...sess.weekdays, d];
    sess.draft.visit_weekdays = [...sess.weekdays].sort((a, b) => a - b);
    await promptField(ctx, sess, "visit_weekdays", databaseUrl, tenantSlug);
  }
  return true;
}
