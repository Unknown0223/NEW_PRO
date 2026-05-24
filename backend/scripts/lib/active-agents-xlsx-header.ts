/**
 * Excel eksportlari → User: agent | expeditor | supervisor.
 * import-once va alohida skriptlar chaqiradi.
 */

import type { PrismaClient } from "@prisma/client";

export const AGENT_HEADER_ALIASES: Record<string, string[]> = {
  fio: ["ф.и.о", "фио", "пользователь", "имя пользователя"],
  product: ["продукт"],
  agentType: ["тип агента"],
  code: ["код", "код агента", "код пользователя"],
  pinfl: ["пинфл"],
  consignment: ["консигнация"],
  apk: ["версия apk"],
  device: ["название устройства"],
  lastSync: ["последняя синхронизация"],
  phone: ["телефон"],
  authShort: ["авторизоваться"],
  priceType: ["тип цены"],
  warehouse: ["склад"],
  tradeDirection: ["направление торговли"],
  branch: ["филиал"],
  position: ["должность"],
  created: ["дата создания"],
  appAccess: ["доступ к приложение", "доступ к приложению"],
  activeSessions: ["количество активных сессий"],
  maxSessions: ["максимальное количество сессий"]
};

export const EXPEDITOR_HEADER_ALIASES: Record<string, string[]> = {
  fio: ["ф.и.о", "фио", "пользователь", "имя пользователя"],
  authShort: ["авторизоваться"],
  phone: ["телефон"],
  code: ["код", "код экспедитора", "код пользователя"],
  warehouse: ["склад"],
  apk: ["версия apk"],
  pinfl: ["пинфл"],
  territory: ["территория"],
  device: ["название устройства"],
  lastSync: ["последняя синхронизация"],
  branch: ["филиал"],
  position: ["должность"],
  appAccess: ["доступ к приложение", "доступ к приложению"],
  activeSessions: ["количество активных сессий"],
  maxSessions: ["максимальное количество сессий"]
};

export const SUPERVISOR_HEADER_ALIASES: Record<string, string[]> = {
  fio: ["ф.и.о", "фио", "супервайзер", "сотрудник", "фио сотрудника", "полное имя"],
  /** SVR qatori: vergul bilan bir nechta agent FIO yoki kod («тип агента» bilan aralashmasin — substring qat’iy chegarada) */
  agentsCol: [
    "агенты супервайзера",
    "подчиненные агенты",
    "назначенные агенты",
    "список агентов",
    "фио агентов",
    "агент (фио)",
    "агенты",
    "агентов",
    "агент"
  ],
  code: ["код", "код супервайзера", "код пользователя"],
  login: ["логин"],
  pinfl: ["пинфл"],
  branch: ["филиал"],
  position: ["должность"],
  apk: ["версия apk"],
  appAccess: ["доступ к приложение", "доступ к приложению"],
  activeSessions: ["количество активных сессий"],
  maxSessions: ["максимальное количество сессий"]
};

export function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е")
    .replace(/\.+$/g, "");
}

/** So‘zning ichidagi harf (агент ⊂ тип агента) noto‘g‘ri moslashmasin. */
function isWordChar(c: string): boolean {
  return /[0-9a-zа-яёії]/i.test(c);
}

/** Qat’iy tenglik yoki substring faqat «so‘z chegarasi» bilan (тип агента ≠ агент ustuni). */
function headerMatchesField(cellNorm: string, aliasRaw: string): boolean {
  const a = normHeader(aliasRaw);
  if (!cellNorm || !a) return false;
  if (cellNorm === a) return true;
  if (a.length <= 3) return false;
  if (cellNorm.startsWith(`${a} `) || cellNorm.startsWith(`${a}(`) || cellNorm.startsWith(`${a},`)) return true;
  if (cellNorm.includes(` ${a} `) || cellNorm.endsWith(` ${a}`)) return true;
  const idx = cellNorm.indexOf(a);
  if (idx === -1) return false;
  const before = idx === 0 ? " " : cellNorm[idx - 1]!;
  const after = idx + a.length >= cellNorm.length ? " " : cellNorm[idx + a.length]!;
  if (isWordChar(before) || isWordChar(after)) return false;
  return true;
}

export function buildHeaderMap(
  headerRow: unknown[],
  aliases: Record<string, string[]>
): Record<string, number> {
  const map: Record<string, number> = {};
  const cells = headerRow.map((c) => (c == null ? "" : String(c)));
  for (let i = 0; i < cells.length; i++) {
    const cellNorm = normHeader(cells[i]);
    if (!cellNorm) continue;
    for (const [field, als] of Object.entries(aliases)) {
      if (map[field] !== undefined) continue;
      for (const alias of als) {
        if (headerMatchesField(cellNorm, alias)) {
          map[field] = i;
          break;
        }
      }
    }
  }
  return map;
}

export function cell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= row.length) return "";
  const v = row[idx];
  if (v == null) return "";
  return String(v)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

/** FIO / kod taqqoslash: bo‘shliq, registr, yashirin belgilar. */
export function normPersonKey(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Agent / eksportdagi FIO — [...] ichida odam nomi */
export function parseNameFromFio(raw: string): { displayName: string; first_name: string; last_name: string | null } {
  const t = raw.replace(/\u00a0/g, " ").trim();
  const m = t.match(/\[([^\]]+)\]/);
  const core = (m ? m[1] : t).trim();
  const parts = core.split(/\s+/).filter(Boolean);
  const first_name = parts[0] || core;
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { displayName: core || t, first_name, last_name };
}

/** Supervayzer: qavslar va sana kalta qoldiq — ko‘rinish nomi */
export function parseSupervisorDisplayName(raw: string): {
  displayName: string;
  first_name: string;
  last_name: string | null;
} {
  const t = raw.replace(/\u00a0/g, " ").trim();
  const withoutBrackets = t.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const parts = withoutBrackets.split(/\s+/).filter(Boolean);
  const displayName = withoutBrackets || t;
  const first_name = parts[0] || displayName;
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { displayName, first_name, last_name };
}

export function yesRu(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "да" || s === "yes" || s === "true" || s === "1" || s === "ha";
}

function fromExcelSerial(n: unknown): Date | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 20000) return null;
  const whole = Math.floor(n);
  const frac = n - whole;
  const msDay = (whole - 25569) * 86400 * 1000;
  const msFrac = frac * 86400 * 1000;
  const d = new Date(msDay + msFrac);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateCell(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") return fromExcelSerial(v);
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export async function resolveFirstWarehouseId(
  prisma: PrismaClient,
  tenantId: number,
  raw: string
): Promise<{ id: number | null; tried: string[] }> {
  const tried: string[] = [];
  if (!raw.trim()) return { id: null, tried };
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (!name) continue;
    tried.push(name);
    const wh = await prisma.warehouse.findFirst({
      where: { tenant_id: tenantId, name: { equals: name, mode: "insensitive" } }
    });
    if (wh) return { id: wh.id, tried };
  }
  return { id: null, tried };
}

export function pickPriceType(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t.length > 512 ? t.slice(0, 512) : t;
}

export function normPinfl(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  return d.length >= 10 ? d.slice(0, 20) : null;
}
