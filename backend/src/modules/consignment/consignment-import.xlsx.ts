import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { loadActiveWorkSlotsByUserIds } from "../work-slots/work-slots.query";
import { bulkPatchConsignmentAgentRows, type ConsignmentAgentRowPatch } from "./consignment.service";
import { userWhereTradeDirection } from "./consignment-trade-direction";

export const CONSIGNMENT_IMPORT_HEADERS = [
  "Смарт-код",
  "Код агента",
  "Название Т.П.",
  "Консигнация",
  "Установленный лимит",
  "Без долгов прош. мес."
] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  smart_code: ["смарт-код", "смарт код", "smart kod", "smart-kod", "smart code", "slot_code", "slot code"],
  agent_code: ["код агента", "код", "код т.п.", "код пользователя"],
  name: ["название т.п.", "название", "фио", "агент", "т.п."],
  consignment: ["консигнация", "вкл/откл консигнация", "вкл/откл"],
  limit: ["установленный лимит", "лимит", "limit"],
  ignore_debt: ["без долгов прош. мес.", "без долгов прошлых месяцев", "без долг. прош. мес.", "без долгов"]
};

function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е");
}

function headerMatches(cellNorm: string, aliasRaw: string): boolean {
  const a = normHeader(aliasRaw);
  if (!cellNorm || !a) return false;
  if (cellNorm === a) return true;
  return cellNorm.includes(a);
}

function buildHeaderMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  const cells = headerRow.map((c) => (c == null ? "" : String(c)));
  for (let i = 0; i < cells.length; i++) {
    const cellNorm = normHeader(cells[i]!);
    if (!cellNorm) continue;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue;
      for (const alias of aliases) {
        if (headerMatches(cellNorm, alias)) {
          map[field] = i;
          break;
        }
      }
    }
  }
  return map;
}

function cell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined || idx < 0 || idx >= row.length) return "";
  const v = row[idx];
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

function normKey(s: string): string {
  return s.trim().toUpperCase();
}

function yesRu(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "да" || s === "yes" || s === "true" || s === "1" || s === "ha";
}

function parseLimit(raw: string): string | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error("BAD_LIMIT");
  return t;
}

function toFio(u: {
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  name: string;
}): string {
  const parts = [u.last_name, u.first_name, u.middle_name].filter((x) => x && x.trim().length > 0);
  return parts.length > 0 ? parts.join(" ") : u.name;
}

type AgentLookup = {
  bySmartCode: Map<string, number>;
  byAgentCode: Map<string, number>;
};

async function buildAgentLookup(tenantId: number, tradeDirectionId: number): Promise<AgentLookup> {
  const agents = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      AND: [await userWhereTradeDirection(tenantId, tradeDirectionId)]
    },
    select: {
      id: true,
      code: true
    }
  });
  const dirIds = new Set(agents.map((a) => a.id));
  const slotsByUser = await loadActiveWorkSlotsByUserIds(agents.map((a) => a.id));

  const bySmartCode = new Map<string, number>();
  const byAgentCode = new Map<string, number>();

  for (const a of agents) {
    if (a.code?.trim()) byAgentCode.set(normKey(a.code), a.id);
    const slot = slotsByUser.get(a.id);
    if (slot?.slot_code.trim()) bySmartCode.set(normKey(slot.slot_code), a.id);
  }

  const slots = await prisma.workSlot.findMany({
    where: { tenant_id: tenantId, slot_type: "agent" },
    select: {
      slot_code: true,
      user_links: {
        where: { ended_at: null },
        take: 1,
        select: { user_id: true }
      }
    }
  });
  for (const s of slots) {
    const uid = s.user_links[0]?.user_id;
    if (uid != null && dirIds.has(uid)) {
      bySmartCode.set(normKey(s.slot_code), uid);
    }
  }

  return { bySmartCode, byAgentCode };
}

function resolveUserId(
  smartRaw: string,
  codeRaw: string,
  lookup: AgentLookup
): number | null {
  const smart = normKey(smartRaw);
  const code = normKey(codeRaw);
  if (smart && lookup.bySmartCode.has(smart)) return lookup.bySmartCode.get(smart)!;
  if (code && lookup.byAgentCode.has(code)) return lookup.byAgentCode.get(code)!;
  if (smart && lookup.byAgentCode.has(smart)) return lookup.byAgentCode.get(smart)!;
  return null;
}

export async function buildConsignmentImportTemplateBuffer(
  tenantId: number,
  tradeDirectionId: number
): Promise<Buffer> {
  const agents = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      AND: [await userWhereTradeDirection(tenantId, tradeDirectionId)]
    },
    select: {
      id: true,
      code: true,
      name: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      consignment: true,
      consignment_limit_amount: true,
      consignment_ignore_previous_months_debt: true
    },
    orderBy: [{ code: "asc" }, { id: "asc" }]
  });

  const slotsByUser = await loadActiveWorkSlotsByUserIds(agents.map((a) => a.id));

  const dataRows = agents.map((a) => {
    const limit = a.consignment_limit_amount?.toString() ?? "";
    return {
      "Смарт-код": slotsByUser.get(a.id)?.slot_code ?? "",
      "Код агента": a.code ?? "",
      "Название Т.П.": toFio(a),
      Консигнация: a.consignment ? "Да" : "Нет",
      "Установленный лимит": limit,
      "Без долгов прош. мес.": a.consignment_ignore_previous_months_debt ? "Да" : "Нет"
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    dataRows.length
      ? dataRows
      : [
          {
            "Смарт-код": "A-MAIN-001",
            "Код агента": "101",
            "Название Т.П.": "Пример агента",
            Консигнация: "Да",
            "Установленный лимит": "5000000",
            "Без долгов прош. мес.": "Нет"
          }
        ],
    { header: [...CONSIGNMENT_IMPORT_HEADERS] }
  );
  ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Консигнация");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export type ConsignmentImportResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

export async function importConsignmentLimitsFromBuffer(
  tenantId: number,
  tradeDirectionId: number,
  buffer: Buffer,
  actorUserId: number | null
): Promise<ConsignmentImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("EMPTY_FILE");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
    header: 1,
    defval: ""
  }) as unknown[][];
  if (matrix.length < 2) throw new Error("EMPTY_FILE");

  const headerIdx = matrix.findIndex((row) => {
    const map = buildHeaderMap(row);
    return map.smart_code != null || map.agent_code != null;
  });
  if (headerIdx < 0) throw new Error("BAD_HEADERS");

  const headerMap = buildHeaderMap(matrix[headerIdx]!);
  if (headerMap.smart_code == null && headerMap.agent_code == null) {
    throw new Error("BAD_HEADERS");
  }

  const lookup = await buildAgentLookup(tenantId, tradeDirectionId);
  const patches: ConsignmentAgentRowPatch[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const rowNum = i + 1;
    const smartRaw = cell(row, headerMap.smart_code);
    const codeRaw = cell(row, headerMap.agent_code);
    if (!smartRaw && !codeRaw) {
      skipped++;
      continue;
    }

    const userId = resolveUserId(smartRaw, codeRaw, lookup);
    if (userId == null) {
      errors.push(`Строка ${rowNum}: агент не найден (смарт-код «${smartRaw || "—"}», код «${codeRaw || "—"}»)`);
      continue;
    }

    const consRaw = cell(row, headerMap.consignment);
    const limitRaw = cell(row, headerMap.limit);
    const ignoreRaw = cell(row, headerMap.ignore_debt);

    let consignment = false;
    if (consRaw !== "") {
      const low = consRaw.trim().toLowerCase();
      if (yesRu(consRaw)) consignment = true;
      else if (["нет", "no", "false", "0", "yo'q", "йўқ"].includes(low)) consignment = false;
      else {
        errors.push(`Строка ${rowNum}: некорректное значение «Консигнация»`);
        continue;
      }
    }

    let limit: string | null = null;
    try {
      limit = parseLimit(limitRaw);
    } catch {
      errors.push(`Строка ${rowNum}: некорректный лимит`);
      continue;
    }

    const ignoreDebt =
      consignment && limit != null && Number.parseFloat(limit) > 0
        ? ignoreRaw === ""
          ? false
          : yesRu(ignoreRaw)
        : false;
    if (
      ignoreRaw !== "" &&
      !yesRu(ignoreRaw) &&
      !["нет", "no", "false", "0", "yo'q", "йўқ"].includes(ignoreRaw.trim().toLowerCase())
    ) {
      errors.push(`Строка ${rowNum}: некорректное значение «Без долгов прош. мес.»`);
      continue;
    }

    patches.push({
      user_id: userId,
      consignment,
      consignment_limit_amount: limit,
      consignment_ignore_previous_months_debt: ignoreDebt
    });
  }

  if (patches.length === 0 && errors.length === 0) throw new Error("EMPTY_ROWS");
  if (patches.length > 500) throw new Error("TOO_MANY_ROWS");

  let updated = 0;
  if (patches.length > 0) {
    const res = await bulkPatchConsignmentAgentRows(tenantId, patches, actorUserId);
    updated = res.updated;
  }

  return { updated, skipped, errors };
}
