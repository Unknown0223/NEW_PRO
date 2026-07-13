import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { AgentAssignmentPatch } from "./clients.types";
import { normalizePhoneDigits, parseVisitWeekdaysJson } from "./clients.types";
import { CONTACT_SLOTS } from "./clients.helpers";
import { VALID_IMPORT_KEYS } from "./clients.import.keys";
import { isPlaceholderCell, readArrayCell } from "./clients.import.parse";
import type { ImportWarningCollector } from "./clients.import.runtime";

export function buildManualColumnMap(raw: Record<string, number> | undefined): Record<string, number> | null {
  if (raw == null) return null;
  const colIndexByKey: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!VALID_IMPORT_KEYS.has(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) continue;
    colIndexByKey[k] = v;
  }
  const hasName = Object.prototype.hasOwnProperty.call(colIndexByKey, "name");
  const hasDbId = Object.prototype.hasOwnProperty.call(colIndexByKey, "client_db_id");
  return hasName || hasDbId ? colIndexByKey : null;
}

const IMPORT_ASSIGNMENT_CLEAR_TOKENS = new Set(["clear", "очистить", "tozalash", "remove", "delete"]);

function isAssignmentClearToken(raw: string | null): boolean {
  if (raw == null) return false;
  const t = raw.trim().toLocaleLowerCase("ru-RU");
  return t !== "" && IMPORT_ASSIGNMENT_CLEAR_TOKENS.has(t);
}

/** «Пн», «Вт» … yoki raqam 1..7 (1=Du … 7=Ya); «1,2;3» vergul/bo‘shliq bilan. */
function parseRussianVisitDaysDetailed(raw: string | null): { days: number[]; unknownTokens: string[] } {
  if (raw == null || isPlaceholderCell(raw)) return { days: [], unknownTokens: [] };
  const tokenMap: Record<string, number> = {
    пн: 1,
    понедельник: 1,
    вт: 2,
    вторник: 2,
    ср: 3,
    среда: 3,
    чт: 4,
    четверг: 4,
    четвер: 4,
    пт: 5,
    пятница: 5,
    сб: 6,
    суббота: 6,
    вс: 7,
    воскресенье: 7,
    вск: 7
  };
  let normalized = String(raw).trim().replace(/\u00a0/g, " ").replace(/;+/g, ",");
  const compact = normalized.replace(/\s/g, "");
  /** Excel: `1.2` matn sifatida ikki kun (1 va 2); `12` yoki `1.25` bundan mustasno. */
  const dotPair = /^([1-7])\.([1-7])$/.exec(compact);
  if (dotPair) {
    normalized = `${dotPair[1]},${dotPair[2]}`;
  }
  const parts = normalized
    .split(/[,|/]+|\s+/)
    .map((x) => x.trim().toLowerCase().replace(/\./g, ""))
    .filter(Boolean);
  const out: number[] = [];
  const unknownTokens: string[] = [];
  for (const p of parts) {
    if (/^\d{1,2}$/.test(p)) {
      const num = Number.parseInt(p, 10);
      if (num >= 1 && num <= 7) {
        out.push(num);
        continue;
      }
    }
    const n = tokenMap[p];
    if (n != null && n >= 1 && n <= 7) out.push(n);
    else unknownTokens.push(p);
  }
  return {
    days: [...new Set(out)].sort((a, b) => a - b),
    unknownTokens: [...new Set(unknownTokens)]
  };
}

type ImportStaffRole = "agent" | "expeditor";

export type ImportStaffLookupUser = {
  id: number;
  role: ImportStaffRole;
  code: string | null;
  name: string | null;
  phone: string | null;
  is_active: boolean;
};

export type ImportStaffLookupOptions = {
  /** Excel yangilash: arxiv/faol emas agent kodlari ham moslanadi. */
  includeInactive?: boolean;
};

export type ImportStaffLookup = {
  byId: Map<number, ImportStaffLookupUser>;
  byCode: Map<string, ImportStaffLookupUser[]>;
  byName: Map<string, ImportStaffLookupUser[]>;
  byPhone: Map<string, ImportStaffLookupUser[]>;
};

function indexImportStaffLookup(
  map: Map<string, ImportStaffLookupUser[]>,
  key: string | null,
  user: ImportStaffLookupUser
) {
  if (!key) return;
  const normalized = key.trim().toLocaleLowerCase("ru-RU");
  if (!normalized) return;
  const list = map.get(normalized) ?? [];
  list.push(user);
  map.set(normalized, list);
}

export async function loadImportStaffLookup(
  tenantId: number,
  opts?: ImportStaffLookupOptions
): Promise<ImportStaffLookup> {
  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: { in: ["agent", "expeditor"] },
      ...(opts?.includeInactive ? {} : { is_active: true })
    },
    orderBy: { id: "asc" },
    select: { id: true, role: true, code: true, name: true, phone: true, is_active: true }
  });
  const byId = new Map<number, ImportStaffLookupUser>();
  const byCode = new Map<string, ImportStaffLookupUser[]>();
  const byName = new Map<string, ImportStaffLookupUser[]>();
  const byPhone = new Map<string, ImportStaffLookupUser[]>();
  for (const row of rows) {
    const role = row.role as ImportStaffRole;
    if (role !== "agent" && role !== "expeditor") continue;
    const user: ImportStaffLookupUser = {
      id: row.id,
      role,
      code: row.code ?? null,
      name: row.name ?? null,
      phone: row.phone ?? null,
      is_active: row.is_active
    };
    byId.set(user.id, user);
    indexImportStaffLookup(byCode, user.code, user);
    indexImportStaffLookup(byName, user.name, user);
    const phoneDigits = normalizePhoneDigits(user.phone);
    if (phoneDigits) indexImportStaffLookup(byPhone, phoneDigits, user);
  }
  return { byId, byCode, byName, byPhone };
}

function pickImportStaffByAllowedRoles(
  users: ImportStaffLookupUser[] | undefined,
  roles: ImportStaffRole[]
): ImportStaffLookupUser | null {
  if (!users || users.length === 0) return null;
  for (const user of users) {
    if (roles.includes(user.role)) return user;
  }
  return null;
}

type StaffResolveMatch = "code" | "id" | "name" | "phone" | "none";

type StaffResolveResult = {
  id: number | null;
  matchedBy: StaffResolveMatch;
};

function resolveStaffByRefForImport(
  lookup: ImportStaffLookup,
  raw: string | null,
  roles: ImportStaffRole[]
): StaffResolveResult {
  if (raw == null || isPlaceholderCell(raw)) return { id: null, matchedBy: "none" };
  const t = raw.trim();
  if (!t) return { id: null, matchedBy: "none" };

  const byCode = pickImportStaffByAllowedRoles(
    lookup.byCode.get(t.toLocaleLowerCase("ru-RU")),
    roles
  );
  if (byCode) return { id: byCode.id, matchedBy: "code" };

  if (/^\d+$/.test(t)) {
    const id = Number.parseInt(t, 10);
    const byId = lookup.byId.get(id);
    if (byId && roles.includes(byId.role)) return { id: byId.id, matchedBy: "id" };
  }

  const byName = pickImportStaffByAllowedRoles(
    lookup.byName.get(t.toLocaleLowerCase("ru-RU")),
    roles
  );
  if (byName) return { id: byName.id, matchedBy: "name" };

  const normPhone = normalizePhoneDigits(t);
  if (normPhone && normPhone.length >= 9) {
    const byPhone = pickImportStaffByAllowedRoles(lookup.byPhone.get(normPhone), roles);
    if (byPhone) return { id: byPhone.id, matchedBy: "phone" };
  }

  return { id: null, matchedBy: "none" };
}

export function colMapHasAgentSlots(colIndexByKey: Record<string, number>): boolean {
  for (const k of Object.keys(colIndexByKey)) {
    if (k.startsWith("import_agent_") || k.startsWith("import_expeditor_")) return true;
  }
  return false;
}

type ImportAssignmentRowOutcome = {
  createPatches: AgentAssignmentPatch[];
  updatePatches: AgentAssignmentPatch[];
  touched: boolean;
};

function staffUserById(lookup: ImportStaffLookup, id: number): ImportStaffLookupUser | null {
  return lookup.byId.get(id) ?? null;
}

function isImportAssignmentColumnMapped(
  colIndexByKey: Record<string, number>,
  key: string,
  assignmentApply?: Set<string> | null
): boolean {
  if (!Object.prototype.hasOwnProperty.call(colIndexByKey, key)) return false;
  return assignmentApply == null || assignmentApply.has(key);
}

function slotPatchHasData(p: AgentAssignmentPatch): boolean {
  return (
    p.agent_id != null ||
    p.expeditor_user_id != null ||
    (p.expeditor_phone != null && p.expeditor_phone !== "") ||
    (p.visit_weekdays?.length ?? 0) > 0
  );
}

function assignmentRowHasData(row: {
  agent_id: number | null;
  expeditor_user_id: number | null;
  expeditor_phone: string | null;
  visit_weekdays: number[];
}): boolean {
  return (
    row.agent_id != null ||
    row.expeditor_user_id != null ||
    (row.expeditor_phone != null && row.expeditor_phone !== "") ||
    row.visit_weekdays.length > 0
  );
}

function mergeAssignmentPatchesForImportReplace(
  touchedBySlot: Map<number, AgentAssignmentPatch>,
  currentAssignments: Array<{
    slot: number;
    agent_id: number | null;
    expeditor_user_id: number | null;
    expeditor_phone: string | null;
    visit_weekdays: number[];
  }>
): AgentAssignmentPatch[] {
  const currentBySlot = new Map(currentAssignments.map((x) => [x.slot, x]));
  const out: AgentAssignmentPatch[] = [];
  for (let slot = 1; slot <= CONTACT_SLOTS; slot++) {
    if (touchedBySlot.has(slot)) {
      const p = touchedBySlot.get(slot)!;
      const hadPrev = assignmentRowHasData({
        agent_id: currentBySlot.get(slot)?.agent_id ?? null,
        expeditor_user_id: currentBySlot.get(slot)?.expeditor_user_id ?? null,
        expeditor_phone: currentBySlot.get(slot)?.expeditor_phone ?? null,
        visit_weekdays: parseVisitWeekdaysJson(currentBySlot.get(slot)?.visit_weekdays)
      });
      if (slotPatchHasData(p) || hadPrev) {
        out.push({
          slot,
          agent_id: p.agent_id ?? null,
          expeditor_user_id: p.expeditor_user_id ?? null,
          expeditor_phone: p.expeditor_phone ?? null,
          visit_weekdays: parseVisitWeekdaysJson(p.visit_weekdays)
        });
      }
      continue;
    }
    const cur = currentBySlot.get(slot);
    if (cur && assignmentRowHasData(cur)) {
      out.push({
        slot,
        agent_id: cur.agent_id ?? null,
        expeditor_user_id: cur.expeditor_user_id ?? null,
        expeditor_phone: cur.expeditor_phone ?? null,
        visit_weekdays: parseVisitWeekdaysJson(cur.visit_weekdays)
      });
    }
  }
  return out.sort((a, b) => a.slot - b.slot);
}

export function buildAgentAssignmentPatchesFromImportRow(
  row: unknown[],
  colIndexByKey: Record<string, number>,
  staffLookup: ImportStaffLookup,
  rowNumExcel: number,
  warn: (message: string) => void,
  currentAssignments?: Array<{
    slot: number;
    agent_id: number | null;
    expeditor_user_id: number | null;
    expeditor_phone: string | null;
    visit_weekdays: number[];
  }>,
  /** `null` — barcha slot maydonlari Exceldan olinadi (yangi klient yoki to‘liq yangilash). */
  assignmentApply?: Set<string> | null
): ImportAssignmentRowOutcome {
  const createPatches: AgentAssignmentPatch[] = [];
  const currentBySlot = new Map(
    (currentAssignments ?? []).map((x) => [
      x.slot,
      {
        slot: x.slot,
        agent_id: x.agent_id,
        expeditor_user_id: x.expeditor_user_id,
        expeditor_phone: x.expeditor_phone,
        visit_weekdays: parseVisitWeekdaysJson(x.visit_weekdays)
      }
    ])
  );
  const updateBySlot = new Map<number, AgentAssignmentPatch>();
  let touched = false;
  for (let slot = 1; slot <= CONTACT_SLOTS; slot++) {
    const agentKey = `import_agent_${slot}`;
    const daysKey = `import_agent_${slot}_days`;
    const expKey = `import_expeditor_${slot}`;
    const agentMapped = isImportAssignmentColumnMapped(colIndexByKey, agentKey, assignmentApply);
    const daysMapped = isImportAssignmentColumnMapped(colIndexByKey, daysKey, assignmentApply);
    const expMapped = isImportAssignmentColumnMapped(colIndexByKey, expKey, assignmentApply);

    const prev = currentBySlot.get(slot) ?? {
      slot,
      agent_id: null,
      expeditor_user_id: null,
      expeditor_phone: null,
      visit_weekdays: []
    };
    const next: AgentAssignmentPatch = {
      slot,
      agent_id: prev.agent_id,
      expeditor_user_id: prev.expeditor_user_id,
      expeditor_phone: prev.expeditor_phone,
      visit_weekdays: prev.visit_weekdays
    };
    let slotTouched = false;

    if (agentMapped) {
      slotTouched = true;
      const agentRaw = readArrayCell(row, colIndexByKey[agentKey]);
      if (
        agentRaw == null ||
        isPlaceholderCell(String(agentRaw)) ||
        isAssignmentClearToken(agentRaw)
      ) {
        next.agent_id = null;
      } else {
        const resolved = resolveStaffByRefForImport(staffLookup, agentRaw, ["agent"]);
        if (resolved.id != null) {
          next.agent_id = resolved.id;
          if (resolved.id !== prev.agent_id) {
            const staff = staffUserById(staffLookup, resolved.id);
            if (staff && !staff.is_active) {
              warn(
                `Qator ${rowNumExcel}: «Агент ${slot}» («${agentRaw.trim()}») faol emas — tayinlandi.`
              );
            }
          }
        } else {
          next.agent_id = null;
          warn(
            `Qator ${rowNumExcel}: «Агент ${slot}» qiymati topilmadi («${agentRaw.trim()}») — agent olib tashlandi.`
          );
        }
      }
    }

    if (expMapped) {
      slotTouched = true;
      const expRaw = readArrayCell(row, colIndexByKey[expKey]);
      if (expRaw == null || isPlaceholderCell(String(expRaw)) || isAssignmentClearToken(expRaw)) {
        next.expeditor_user_id = null;
        next.expeditor_phone = null;
      } else {
        const expLabel = expRaw.trim();
        const resolved = resolveStaffByRefForImport(staffLookup, expRaw, ["expeditor", "agent"]);
        if (resolved.id != null) {
          next.expeditor_user_id = resolved.id;
          next.expeditor_phone = null;
          if (resolved.id !== prev.expeditor_user_id) {
            const staff = staffUserById(staffLookup, resolved.id);
            if (staff && !staff.is_active) {
              warn(
                `Qator ${rowNumExcel}: «Экспедитор ${slot}» («${expLabel}») faol emas — tayinlandi.`
              );
            }
          }
        } else if (/^\+?\d[\d\s\-()]{6,}$/.test(expLabel)) {
          next.expeditor_user_id = null;
          next.expeditor_phone = expLabel;
        } else {
          next.expeditor_user_id = null;
          next.expeditor_phone = null;
          warn(
            `Qator ${rowNumExcel}: «Экспедитор ${slot}» qiymati topilmadi («${expLabel}») — ekspeditor olib tashlandi.`
          );
        }
      }
    }

    if (daysMapped) {
      slotTouched = true;
      const daysRaw = readArrayCell(row, colIndexByKey[daysKey]);
      if (daysRaw == null || isPlaceholderCell(String(daysRaw)) || isAssignmentClearToken(daysRaw)) {
        next.visit_weekdays = [];
      } else {
        const parsedDays = parseRussianVisitDaysDetailed(daysRaw);
        next.visit_weekdays = parsedDays.days;
        if (parsedDays.unknownTokens.length > 0) {
          warn(
            `Qator ${rowNumExcel}: «Агент ${slot} день»da noma’lum kunlar (${parsedDays.unknownTokens.join(", ")}).`
          );
        }
      }
    }

    if (slotTouched) touched = true;

    const createPatch: AgentAssignmentPatch = { slot };
    if (next.agent_id != null) createPatch.agent_id = next.agent_id;
    if (next.expeditor_user_id != null) createPatch.expeditor_user_id = next.expeditor_user_id;
    if (next.expeditor_phone != null && next.expeditor_phone !== "") {
      createPatch.expeditor_phone = next.expeditor_phone;
    }
    if (Array.isArray(next.visit_weekdays) && next.visit_weekdays.length > 0) {
      createPatch.visit_weekdays = next.visit_weekdays;
    }

    if (slotPatchHasData(createPatch)) createPatches.push(createPatch);

    const slotChanged =
      next.agent_id !== prev.agent_id ||
      next.expeditor_user_id !== prev.expeditor_user_id ||
      (next.expeditor_phone ?? null) !== (prev.expeditor_phone ?? null) ||
      JSON.stringify(parseVisitWeekdaysJson(next.visit_weekdays)) !==
        JSON.stringify(parseVisitWeekdaysJson(prev.visit_weekdays));

    if (slotTouched && slotChanged) {
      updateBySlot.set(slot, {
        slot,
        agent_id: next.agent_id ?? null,
        expeditor_user_id: next.expeditor_user_id ?? null,
        expeditor_phone: next.expeditor_phone ?? null,
        visit_weekdays: parseVisitWeekdaysJson(next.visit_weekdays)
      });
    }
  }
  const updatePatches =
    currentAssignments != null
      ? mergeAssignmentPatchesForImportReplace(updateBySlot, currentAssignments)
      : [...updateBySlot.values()].sort((a, b) => a.slot - b.slot);
  return { createPatches, updatePatches, touched };
}

export function parseClientDbIdFromCell(raw: string | null): number | null {
  if (raw == null || isPlaceholderCell(raw)) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}
