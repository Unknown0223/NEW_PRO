import type { ClientDraft, WizardField } from "./types.js";
import { OPTIONAL_FIELDS, WIZARD_ORDER } from "./types.js";
import { esc, progressBar } from "./ui.js";

export const FIELD_EMOJI: Record<WizardField, string> = {
  name: "🟢",
  legal_name: "🔵",
  address: "🟡",
  phone: "📱",
  responsible_person: "👤",
  landmark: "📍",
  inn: "🧾",
  pinfl: "🆔",
  sales_channel: "🟣",
  category: "🟠",
  client_type: "💠",
  client_format: "🏪",
  region: "🗺️",
  city: "🏙️",
  location: "📌",
  visit_weekdays: "📅"
};

export const FIELD_LABEL: Record<WizardField, string> = {
  name: "Nomi",
  legal_name: "Yuridik nom",
  address: "Manzil",
  phone: "Telefon",
  responsible_person: "Kontakt",
  landmark: "Mo‘ljal",
  inn: "INN",
  pinfl: "PINFL",
  sales_channel: "Savdo kanali",
  category: "Kategoriya",
  client_type: "Tur",
  client_format: "Format",
  region: "Hudud / viloyat",
  city: "Shahar",
  location: "GPS",
  visit_weekdays: "Tashrif kunlari"
};

export const FIELD_BTN: Record<WizardField, string> = {
  name: "🟢 Nomi",
  legal_name: "🔵 Yuridik",
  address: "🟡 Manzil",
  phone: "📱 Telefon",
  responsible_person: "👤 Kontakt",
  landmark: "📍 Mo‘ljal",
  inn: "🧾 INN",
  pinfl: "🆔 PINFL",
  sales_channel: "🟣 Kanal",
  category: "🟠 Kategoriya",
  client_type: "💠 Tur",
  client_format: "🏪 Format",
  region: "🗺️ Hudud",
  city: "🏙️ Shahar",
  location: "📌 GPS",
  visit_weekdays: "📅 Kunlar"
};

const FIELD_HINT: Record<WizardField, string> = {
  name: "Lotin harf. Kichik avtomatik <b>KATTA</b> qilinadi. Kiril qabul qilinmaydi.",
  legal_name: "Yuridik nom — lotin (kichik → katta). Ixtiyoriy.",
  address: "Manzil — lotin (kichik → katta). Kiril qabul qilinmaydi.",
  phone: "Masalan <code>+998901112233</code> (9–15 raqam).",
  responsible_person: "Kontakt F.I.Sh. — lotin (kichik → katta). Ixtiyoriy.",
  landmark: "Mo‘ljal — lotin (kichik → katta). Ixtiyoriy.",
  inn: "STIR / INN. Bo‘lsa — unikal. Ixtiyoriy.",
  pinfl: "JSHSHIR — 14 raqam. Ixtiyoriy.",
  sales_channel: "Pastdagi tugmalardan tanlang (2 ustun).",
  category: "Kategoriyani tugmadan tanlang.",
  client_type: "Klient turini tugmadan tanlang.",
  client_format: "Formatni tugmadan tanlang.",
  region: "Viloyat / hudud — tugmadan tanlang (ishchi o‘rin hududingiz).",
  city: "Shaharni tugmadan tanlang — 2 ustun, spravochnik + hududingiz.",
  location: "Pastdagi <b>📍 Lokatsiya</b> tugmasini bosing.",
  visit_weekdays: "Kunlarni belgilang, so‘ng <b>✅ Tayyor</b>."
};

export function fieldCard(field: WizardField, extra = ""): string {
  const i = WIZARD_ORDER.indexOf(field) + 1;
  const total = WIZARD_ORDER.length;
  const opt = OPTIONAL_FIELDS.has(field)
    ? "\n<i>⏭ Ixtiyoriy — o‘tkazib yuborish mumkin</i>"
    : "";
  return `${progressBar(i, total)}\n${FIELD_EMOJI[field]} <b>${i}/${total}. ${FIELD_LABEL[field]}</b>\n${FIELD_HINT[field]}${opt}${extra ? `\n\n${extra}` : ""}`;
}

export type WizardScreenMode = WizardField | "confirm" | "edit_pick";

export function draftFieldDisplay(d: Partial<ClientDraft>, field: WizardField): string {
  switch (field) {
    case "name":
      return (d.name ?? "").trim();
    case "legal_name":
      return (d.legal_name ?? "").trim();
    case "address":
      return (d.address ?? "").trim();
    case "phone":
      return (d.phone ?? "").trim();
    case "responsible_person":
      return (d.responsible_person ?? "").trim();
    case "landmark":
      return (d.landmark ?? "").trim();
    case "inn":
      return (d.inn ?? "").trim();
    case "pinfl":
      return (d.pinfl ?? "").trim();
    case "sales_channel":
      return (d.sales_channel_label || d.sales_channel || "").trim();
    case "category":
      return (d.category_label || d.category || "").trim();
    case "client_type":
      return (d.client_type_label || d.client_type || "").trim();
    case "client_format":
      return (d.client_format_label || d.client_format || "").trim();
    case "region":
      return (d.region_label || d.region || "").trim();
    case "city":
      return (d.city_label || d.city || "").trim();
    case "location":
      return d.lat != null && d.lon != null ? `${d.lat.toFixed(6)}, ${d.lon.toFixed(6)}` : "";
    case "visit_weekdays":
      return formatDays(d.visit_weekdays ?? []);
    default:
      return "";
  }
}

export function hasDraftValue(d: Partial<ClientDraft>, field: WizardField): boolean {
  return Boolean(draftFieldDisplay(d, field));
}

/** Bitta xabar: Klient nomi + barcha bosqichlar + hozirgi savol. */
export function wizardScreen(
  d: Partial<ClientDraft>,
  mode: WizardScreenMode,
  extra = "",
  error = ""
): string {
  const name = (d.name ?? "").trim();
  const header = name
    ? `👤 <b>Klient:</b> <code>${esc(name)}</code>`
    : "👤 <b>Klient:</b> —";
  const current: WizardField | null = mode === "confirm" || mode === "edit_pick" ? null : mode;
  const curIdx = current ? WIZARD_ORDER.indexOf(current) : WIZARD_ORDER.length;
  const lines = WIZARD_ORDER.map((f, i) => {
    const val = draftFieldDisplay(d, f);
    const filled = Boolean(val);
    if (current === f) {
      return filled
        ? `⏳ ${FIELD_EMOJI[f]} <b>${FIELD_LABEL[f]}</b> · <code>${esc(val)}</code>`
        : `⏳ ${FIELD_EMOJI[f]} <b>${FIELD_LABEL[f]}</b> — hozir`;
    }
    if (filled) return `✅ ${FIELD_EMOJI[f]} ${FIELD_LABEL[f]} · <code>${esc(val)}</code>`;
    if (current && i < curIdx) return `⏭ ${FIELD_EMOJI[f]} ${FIELD_LABEL[f]} · <i>o‘tkazildi</i>`;
    return `▫️ ${FIELD_EMOJI[f]} ${FIELD_LABEL[f]}`;
  });
  let prompt = "";
  if (mode === "confirm") {
    prompt = `\n━━━━━━━━━━━━━━\n✅ <b>Tekshiring</b> — tasdiqlang yoki tahrirlang`;
  } else if (mode === "edit_pick") {
    prompt = `\n━━━━━━━━━━━━━━\n✏️ <b>Qaysi bo‘limni tahrirlaysiz?</b>`;
  } else {
    prompt = `\n━━━━━━━━━━━━━━\n${fieldCard(mode, extra)}`;
  }
  if (!name && current === "name") {
    prompt +=
      "\n\n<i>Lotin BOSH HARF · telefon/INN/PINFL unikal · GPS 100 m</i>";
  }
  if (error.trim()) prompt += `\n\n🔴 ${error.trim()}`;
  return `${header}\n━━━━━━━━━━━━━━\n${lines.join("\n")}${prompt}`;
}

export const T = {
  startGuest:
    "🟢 <b>SALEC</b>  ·  yangi klient boti\n━━━━━━━━━━━━━━\n<b>Agent</b> — klient qo‘shadi.\n<b>SVR / operator / boshqa platforma hodimi</b> — faqat o‘z hududi va belgilangan agentlar bo‘yicha Excel.\nHar bir hodimga <b>bitta Telegram</b> birikadi.",
  askLogin:
    "1️⃣  <b>Login</b>\nSALEC panelidagi <b>login</b> yoki hodim <b>kodi</b>ni yuboring.",
  askPassword: "2️⃣  <b>Parol</b>\nParolni yuboring — xabar o‘chiriladi 🔒",
  askSmart:
    "3️⃣  <b>Smart kod</b>\nIshchi o‘rin kodi: masalan <code>A-ANDIJON-001</code> yoki <code>N-ANDIJON-001</code>",
  badCreds: "🔴 Parol noto‘g‘ri.",
  notFound: (login: string) =>
    `🟠 Hodim topilmadi: <code>${esc(login)}</code>\nBu login/kod lokal SALEC bazasida yo‘q. Panel → Hodimlar dagi login yoki kodni yuboring.`,
  emptyPassword: "🟠 Parol saqlanmadi. Qaytadan login va parolni yuboring.",
  badSmart: "🟠 Smart kod topilmadi yoki bu loginning o‘rniga mos emas.",
  badSmartHint: (codes: string) =>
    `🟠 Smart kod mos emas.\nBu hodimning ishchi o‘rni: <code>${esc(codes)}</code>`,
  inactive: "🔴 Hisobingiz faol emas. Administratorga murojaat qiling.",
  badRole:
    "🟠 Bu rol uchun bot ochilmagan. Agent (qo‘shish) yoki platforma hodimi (Excel) bo‘lishingiz kerak.",
  registered: (name: string, role: string, code: string) =>
    `✅ <b>Xush kelibsiz, ${esc(name)}!</b>\n\n👤 Rol: <b>${esc(role)}</b>\n🔑 Smart: <code>${esc(code)}</code>`,
  agentMenu:
    "🟢 <b>Agent menyusi</b>\n━━━━━━━━━━━━━━\nPastdagi tugmalar: <b>Yangi klient</b> · <b>Ro‘yxatim</b>",
  svrMenu:
    "🟣 <b>Yuklab olish menyusi</b>\n━━━━━━━━━━━━━━\nKlient qo‘shish <b>faqat agent</b> uchun.\nPastdagi tugmalar: <b>Statistika</b> · <b>Excel</b> (platforma scope)",
  viewerMenu: (role: string) =>
    `🟣 <b>Yuklab olish</b> · <i>${esc(role)}</i>\n━━━━━━━━━━━━━━\nFaqat <b>Dostup / ish o‘rni</b>dagi hudud va agentlar.\nPastdagi tugmalar: <b>Statistika</b> · <b>Excel</b>`,
  addAgentOnly:
    "🔴 Yangi klient qo‘shish <b>faqat agent</b> uchun.\nBoshqalar platforma scope bo‘yicha <b>Excel</b> yuklab oladi.",
  scopeEmpty:
    "🟠 Platformada sizga biriktirilgan agent / hudud yo‘q.\nPanel → Dostup yoki ish o‘rinini tekshiring.",
  rules:
    "📋 <b>Yangi klient shartlari</b>\n━━━━━━━━━━━━━━\n• Nom / manzil / kontakt — lotin (kichik avtomatik katta)\n• Kiril qabul qilinmaydi\n• Telefon — 9–15 raqam, <b>unikal</b>\n• INN / PINFL — bo‘lsa <b>unikal</b>\n• GPS — 100 m ichida o‘xshash nom <b>taqiqlanadi</b>\n• Hudud / shahar / kategoriya — inline tugmadan tanlang\n\nShart buzilsa xabar chiqadi. <b>Qayta yuboring</b> yoki tahrirlang.",
  retryHint: "🔄 Qayta yuboring — shu qadamda qolasiz.",
  notAuthed: "🟠 Avval <b>/start</b> — login, parol, smart kod.",
  locationAsk: "📍 Pastdagi tugmadan lokatsiya yuboring.",
  needLocation: "🟠 GPS kerak. <b>📍 Lokatsiya</b> tugmasini bosing.",
  daysAsk: "📅 Kunlarni belgilang  ·  🟢 tanlangan",
  needDays: "🟠 Kamida <b>bitta kun</b> tanlang.",
  saved: "✅ <b>Klient tasdiqlandi</b>\nBarcha shartlar bajarildi, bot bazasiga yozildi.",
  saveFailed: (err: string) =>
    `🔴 <b>Shart buzildi</b>\n${err}\n\n🔄 Qayta yuboring yoki tahrirlang.`,
  cancelled: "⚪ Bekor qilindi.",
  excelAgentDenied: "🔴 Excel yuklab olish agentdan boshqa platforma rollari uchun.",
  excelNeed5: (n: number, min: number) =>
    `🟠 Excel uchun kamida <b>${min}</b> ta klient kerak.\nHozir: <b>${n}</b> ta.`,
  excelCleared: (n: number) =>
    `📥 <b>${n}</b> ta klient Excelga yozildi.\n🗑 Dublikat bo‘lmasin deb bot bazasidan o‘chirildi.`,
  pickEdit: "✏️ <b>Qaysi bo‘limni tahrirlaysiz?</b>\nRangli tugmalardan tanlang.",
  confirmTitle: "✅ <b>Tekshiring</b> — tasdiqlang yoki tahrirlang",
  myCount: (n: number) => `📋 Tasdiqlangan klientlaringiz: <b>${n}</b> ta.`,
  loggedOut:
    "⚪ Chiqildi. Hodimning Telegram ID si platformada saqlanadi — boshqa Telegramdan o‘ta olmaysiz.",
  locOk: "📌 Lokatsiya qabul qilindi."
};

const DAY_UZ = ["", "Du", "Se", "Cho", "Pay", "Ju", "Sha", "Yak"];

export function formatMyList(
  rows: Array<{ payload?: { name?: string; phone?: string } | null }>
): string {
  if (rows.length === 0) return "📋 Tasdiqlangan klientlaringiz yo‘q.";
  const lines = rows.map((r, i) => {
    const name = String(r.payload?.name ?? "").trim() || "—";
    const phone = String(r.payload?.phone ?? "").trim();
    return phone
      ? `${i + 1}. 🟢 <b>${esc(name)}</b>  ·  <code>${esc(phone)}</code>`
      : `${i + 1}. 🟢 <b>${esc(name)}</b>`;
  });
  return `📋 Tasdiqlangan klientlar: <b>${rows.length}</b> ta\n━━━━━━━━━━━━━━\n${lines.join("\n")}`;
}

export function formatDays(days: number[]): string {
  return days.map((d) => DAY_UZ[d] ?? String(d)).join(", ");
}

export function formatDraft(d: Partial<ClientDraft>): string {
  const gps =
    d.lat != null && d.lon != null ? `${d.lat.toFixed(6)}, ${d.lon.toFixed(6)}` : "—";
  const rows: Array<[WizardField, string]> = [
    ["name", d.name ?? "—"],
    ["legal_name", d.legal_name || "—"],
    ["address", d.address ?? "—"],
    ["phone", d.phone ?? "—"],
    ["responsible_person", d.responsible_person || "—"],
    ["landmark", d.landmark || "—"],
    ["inn", d.inn || "—"],
    ["pinfl", d.pinfl || "—"],
    ["sales_channel", d.sales_channel_label || d.sales_channel || "—"],
    ["category", d.category_label || d.category || "—"],
    ["client_type", d.client_type_label || d.client_type || "—"],
    ["client_format", d.client_format_label || d.client_format || "—"],
    ["region", d.region_label || d.region || "—"],
    ["city", d.city_label || d.city || "—"],
    ["location", gps],
    ["visit_weekdays", formatDays(d.visit_weekdays ?? []) || "—"]
  ];
  return rows
    .map(([f, v]) => `${FIELD_EMOJI[f]} <b>${FIELD_LABEL[f]}</b>\n<code>${esc(v)}</code>`)
    .join("\n");
}

/** eski nom — fieldCard ishlating */
export const FIELD_PROMPT: Record<WizardField, string> = {
  name: FIELD_HINT.name,
  legal_name: FIELD_HINT.legal_name,
  address: FIELD_HINT.address,
  phone: FIELD_HINT.phone,
  responsible_person: FIELD_HINT.responsible_person,
  landmark: FIELD_HINT.landmark,
  inn: FIELD_HINT.inn,
  pinfl: FIELD_HINT.pinfl,
  sales_channel: FIELD_HINT.sales_channel,
  category: FIELD_HINT.category,
  client_type: FIELD_HINT.client_type,
  client_format: FIELD_HINT.client_format,
  region: FIELD_HINT.region,
  city: FIELD_HINT.city,
  location: FIELD_HINT.location,
  visit_weekdays: FIELD_HINT.visit_weekdays
};
