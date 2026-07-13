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

export async function loadImportStaffLookup(tenantId: number): Promise<ImportStaffLookup> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, is_active: true, role: { in: ["agent", "expeditor"] } },
    orderBy: { id: "asc" },
    select: { id: true, role: true, code: true, name: true, phone: true }
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
      phone: row.phone ?? null
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
    const canAgent = assignmentApply == null || assignmentApply.has(`import_agent_${slot}`);
    const canDays = assignmentApply == null || assignmentApply.has(`import_agent_${slot}_days`);
    const canExp = assignmentApply == null || assignmentApply.has(`import_expeditor_${slot}`);
    const agentRaw = canAgent
      ? readArrayCell(row, colIndexByKey[`import_agent_${slot}`])
      : null;
    const daysRaw = canDays
      ? readArrayCell(row, colIndexByKey[`import_agent_${slot}_days`])
      : null;
    const expRaw = canExp ? readArrayCell(row, colIndexByKey[`import_expeditor_${slot}`]) : null;

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

    if (agentRaw != null && !isPlaceholderCell(agentRaw)) {
      touched = true;
      if (isAssignmentClearToken(agentRaw)) {
        next.agent_id = null;
      } else {
        const resolved = resolveStaffByRefForImport(staffLookup, agentRaw, ["agent"]);
        if (resolved.id != null) {
          next.agent_id = resolved.id;
        } else {
          warn(
            `Qator ${rowNumExcel}: «Агент ${slot}» qiymati topilmadi («${agentRaw.trim()}»). Avvalgi qiymat saqlandi.`
          );
        }
      }
    }

    if (expRaw != null && !isPlaceholderCell(expRaw)) {
      touched = true;
      if (isAssignmentClearToken(expRaw)) {
        next.expeditor_user_id = null;
        next.expeditor_phone = null;
      } else {
        const resolved = resolveStaffByRefForImport(staffLookup, expRaw, ["expeditor", "agent"]);
        if (resolved.id != null) {
          next.expeditor_user_id = resolved.id;
          next.expeditor_phone = null;
        } else {
          const tr = expRaw.trim();
          if (/^\+?\d[\d\s\-()]{6,}$/.test(tr)) {
            next.expeditor_user_id = null;
            next.expeditor_phone = tr;
          } else {
            warn(
              `Qator ${rowNumExcel}: «Экспедитор ${slot}» qiymati topilmadi («${tr}»). Avvalgi qiymat saqlandi.`
            );
          }
        }
      }
    }

    if (daysRaw != null && !isPlaceholderCell(daysRaw)) {
      touched = true;
      if (isAssignmentClearToken(daysRaw)) {
        next.visit_weekdays = [];
      } else {
        const parsedDays = parseRussianVisitDaysDetailed(daysRaw);
        if (parsedDays.days.length > 0) {
          next.visit_weekdays = parsedDays.days;
        }
        if (parsedDays.unknownTokens.length > 0) {
          warn(
            `Qator ${rowNumExcel}: «Агент ${slot} день»da noma’lum kunlar (${parsedDays.unknownTokens.join(", ")}).`
          );
        }
      }
    }

    const createPatch: AgentAssignmentPatch = { slot };
    if (next.agent_id != null) createPatch.agent_id = next.agent_id;
    if (next.expeditor_user_id != null) createPatch.expeditor_user_id = next.expeditor_user_id;
    if (next.expeditor_phone != null && next.expeditor_phone !== "") {
      createPatch.expeditor_phone = next.expeditor_phone;
    }
    if (Array.isArray(next.visit_weekdays) && next.visit_weekdays.length > 0) {
      createPatch.visit_weekdays = next.visit_weekdays;
    }

    const hasDataForCreate =
      createPatch.agent_id != null ||
      createPatch.expeditor_user_id != null ||
      (createPatch.expeditor_phone != null && createPatch.expeditor_phone.length > 0) ||
      (createPatch.visit_weekdays?.length ?? 0) > 0;
    if (hasDataForCreate) createPatches.push(createPatch);

    const hasDataForUpdate =
      next.agent_id != null ||
      next.expeditor_user_id != null ||
      (next.expeditor_phone != null && next.expeditor_phone.length > 0) ||
      (next.visit_weekdays?.length ?? 0) > 0;
    if (hasDataForUpdate) {
      updateBySlot.set(slot, {
        slot,
        agent_id: next.agent_id ?? null,
        expeditor_user_id: next.expeditor_user_id ?? null,
        expeditor_phone: next.expeditor_phone ?? null,
        visit_weekdays: parseVisitWeekdaysJson(next.visit_weekdays)
      });
    }
  }
  const updatePatches = [...updateBySlot.values()].sort((a, b) => a.slot - b.slot);
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
