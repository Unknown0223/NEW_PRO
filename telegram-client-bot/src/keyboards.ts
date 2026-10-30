import { InlineKeyboard, Keyboard } from "grammy";
import { PAGE_SIZE } from "./config.js";
import { FIELD_BTN } from "./texts.js";
import type { BotUser, RefOption, WizardField } from "./types.js";
import { OPTIONAL_FIELDS, WIZARD_ORDER, botCanAdd, botCanDownload } from "./types.js";

const DOTS = ["🟢", "🔵", "🟣", "🟠", "🟡", "🔴"] as const;

export const BTN = {
  add: "🟢 Yangi klient",
  my: "📋 Ro‘yxatim",
  out: "🚪 Chiqish",
  stats: "📊 Statistika",
  excel: "📥 Excel",
  cancel: "❌ Bekor",
  skip: "⏭ O‘tkazish",
  confirm: "✅ Tasdiqlash",
  edit: "✏️ Tahrirlash",
  loc: "📍 Lokatsiya",
  retry: "🔄 Qayta yuborish"
} as const;

export function compactText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function isCancelText(s: string): boolean {
  const t = compactText(s).toLowerCase();
  return t === compactText(BTN.cancel).toLowerCase() || t === "bekor" || t === "❌ bekor";
}

export function isSkipText(s: string): boolean {
  return compactText(s).toLowerCase() === compactText(BTN.skip).toLowerCase();
}

export type MenuAction = "add" | "my" | "out" | "stats" | "excel" | "confirm" | "edit" | "retry";

export function matchBottomAction(text: string): MenuAction | null {
  const t = compactText(text);
  const map: Array<[string, MenuAction]> = [
    [BTN.add, "add"],
    [BTN.my, "my"],
    [BTN.out, "out"],
    [BTN.stats, "stats"],
    [BTN.excel, "excel"],
    [BTN.confirm, "confirm"],
    [BTN.edit, "edit"],
    [BTN.retry, "retry"]
  ];
  for (const [label, action] of map) {
    if (compactText(label) === t) return action;
  }
  return null;
}

export function mainMenuKb(
  user: Pick<BotUser, "role" | "can_add_clients" | "can_download_intake">
): Keyboard {
  const kb = new Keyboard();
  if (botCanAdd(user)) {
    kb.text(BTN.add).text(BTN.my).row();
  } else if (botCanDownload(user)) {
    kb.text(BTN.stats).text(BTN.excel).row();
  }
  return kb.text(BTN.out).resized();
}

export function wizardKb(field?: WizardField): Keyboard {
  const kb = new Keyboard();
  if (field && OPTIONAL_FIELDS.has(field)) kb.text(BTN.skip);
  return kb.text(BTN.cancel).resized();
}

export function locationKb(): Keyboard {
  return new Keyboard().requestLocation(BTN.loc).text(BTN.cancel).resized();
}

export function confirmKb(): Keyboard {
  return new Keyboard().text(BTN.confirm).text(BTN.edit).row().text(BTN.cancel).resized();
}

export function confirmInlineKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN.confirm, "c:ok")
    .text(BTN.edit, "c:ed")
    .row()
    .text(BTN.cancel, "k:cancel");
}

export function retryKb(field?: WizardField): Keyboard {
  const kb = new Keyboard().text(BTN.retry);
  if (!field) kb.text(BTN.edit);
  if (field && OPTIONAL_FIELDS.has(field)) kb.text(BTN.skip);
  return kb.text(BTN.cancel).resized();
}

/** Eski inline menyu — chatdagi eski xabarlar uchun. */
export function agentMenuKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN.add, "m:add")
    .text(BTN.my, "m:my")
    .row()
    .text(BTN.out, "m:out");
}

export function svrMenuKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN.stats, "m:st")
    .text(BTN.excel, "m:xl")
    .row()
    .text(BTN.out, "m:out");
}

export function skipKb(): InlineKeyboard {
  return new InlineKeyboard().text(BTN.skip, "k:skip").text(BTN.cancel, "k:cancel");
}

export function cancelInlineKb(): InlineKeyboard {
  return new InlineKeyboard().text(BTN.cancel, "k:cancel");
}

/** flow.ts / promptField — cancelInlineKb alias */
export function cancelKb(): InlineKeyboard {
  return cancelInlineKb();
}

export function editFieldsKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  WIZARD_ORDER.forEach((f, i) => {
    kb.text(FIELD_BTN[f], `e:${f}`);
    if (i % 2 === 1) kb.row();
  });
  if (WIZARD_ORDER.length % 2 === 1) kb.row();
  kb.text("⬅️  Orqaga", "c:back");
  return pruneInlineRows(kb);
}

export function daysKb(selected: number[]): InlineKeyboard {
  const on = new Set(selected);
  const mark = (d: number, lab: string, off: string) =>
    on.has(d) ? `🟢 ${lab}` : `${off} ${lab}`;
  return new InlineKeyboard()
    .text(mark(1, "Du", "⚪"), "w:1")
    .text(mark(2, "Se", "⚪"), "w:2")
    .text(mark(3, "Cho", "⚪"), "w:3")
    .text(mark(4, "Pay", "⚪"), "w:4")
    .row()
    .text(mark(5, "Ju", "🟡"), "w:5")
    .text(mark(6, "Sha", "🟣"), "w:6")
    .text(mark(7, "Yak", "🔴"), "w:7")
    .row()
    .text("✅  Tayyor", "w:done")
    .text(BTN.cancel, "k:cancel");
}

export function pruneInlineRows(kb: InlineKeyboard): InlineKeyboard {
  const rows = kb.inline_keyboard;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i]?.length) rows.splice(i, 1);
  }
  if (rows.length === 0) rows.push([]);
  return kb;
}

export function inlineMarkup(kb: unknown): { inline_keyboard: unknown[][] } {
  if (kb && typeof kb === "object" && "inline_keyboard" in kb) {
    const rows = (kb as InlineKeyboard).inline_keyboard.filter((row) => row.length > 0);
    return { inline_keyboard: rows };
  }
  return { inline_keyboard: [] };
}

export function selectKb(opts: RefOption[], page: number, field: WizardField): InlineKeyboard {
  const total = Math.max(1, Math.ceil(opts.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), total - 1);
  const slice = opts.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  const kb = new InlineKeyboard();
  slice.forEach((o, i) => {
    const abs = p * PAGE_SIZE + i;
    const dot = DOTS[abs % DOTS.length];
    kb.text(`${dot} ${o.label.slice(0, 28)}`, `s:${abs}`);
    if (i % 2 === 1) kb.row();
  });
  if (slice.length % 2 === 1) kb.row();
  if (total > 1) {
    if (p > 0) kb.text("◀️", "p:prev");
    kb.text(`${p + 1}/${total}`, "p:noop");
    if (p < total - 1) kb.text("▶️", "p:next");
    kb.row();
  }
  if (OPTIONAL_FIELDS.has(field)) kb.text(BTN.skip, "k:skip");
  kb.text(BTN.cancel, "k:cancel");
  return pruneInlineRows(kb);
}

export { OPTIONAL_FIELDS };
