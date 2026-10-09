import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import {
  classifyFlexibleImportId,
  MAX_CLIENT_CODE_ID_LEN
} from "../clients/clients.import.flexible-id";
import { pickOpeningBalanceAgent } from "./opening-balances.import.agent";
import { excelRegionCardPatch } from "./opening-balances.import.region";
import { isIncompleteOpeningBalanceImportRow } from "./opening-balances.import.row";
import { createOpeningBalance } from "./opening-balances.write";

export const OPENING_BALANCE_IMPORT_HEADERS = [
  "ID клиента",
  "Область",
  "Код агента",
  "Сумма"
] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  client_id: [
    "id клиента",
    "id klient",
    "client_id",
    "id",
    "ид",
    "клиент id",
    "код клиента",
    "client code",
    "client_code"
  ],
  region: ["область", "облисть", "oblast", "region", "вилоят", "регион"],
  agent_code: ["код агента", "kod agent", "agent_code", "код т.п.", "agent code"],
  amount: ["сумма", "summa", "amount", "баланс", "остаток"],
  payment_type: ["способ оплаты", "тип оплаты", "payment_type", "оплата"],
  note: ["комментарий", "примечание", "note", "izoh"]
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
  if (typeof v === "number" && Number.isFinite(v)) {
    // Avoid 1.23e+21 style; keep integer as plain digits.
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  return String(v)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

function parseSignedAmount(
  raw: string
): { amount: number; balance_type: "debt" | "surplus" } | "zero" | "bad" | "empty" {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return "empty";
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return "bad";
  if (n === 0) return "zero";
  if (n > 0) return { amount: n, balance_type: "surplus" };
  return { amount: Math.abs(n), balance_type: "debt" };
}

function findHeaderRow(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const map = buildHeaderMap(matrix[i] ?? []);
    if (map.client_id !== undefined && map.amount !== undefined) return i;
  }
  return -1;
}

type ResolvedClient = {
  id: number;
  name: string;
  client_code: string | null;
  region: string | null;
  zone: string | null;
  agent_id: number | null;
};

type ResolvedExcelAgent = { id: number; code: string | null; login: string };

async function resolveAgentByExcelCode(
  tenantId: number,
  raw: string,
  cache: Map<string, ResolvedExcelAgent | null>
): Promise<ResolvedExcelAgent | null> {
  const key = raw.trim();
  if (!key) return null;
  const cacheKey = key.toUpperCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const select = { id: true, code: true, login: true } as const;
  let user = await prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: "agent",
      code: { equals: key, mode: "insensitive" }
    },
    select
  });
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        role: "agent",
        login: { equals: key, mode: "insensitive" }
      },
      select
    });
  }
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { code: { equals: key, mode: "insensitive" } },
          { login: { equals: key, mode: "insensitive" } }
        ]
      },
      select
    });
  }
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        tenant_id: tenantId,
        role: "agent",
        code: { equals: key, mode: "insensitive" }
      },
      select
    });
  }
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [
          { code: { equals: key, mode: "insensitive" } },
          { login: { equals: key, mode: "insensitive" } }
        ]
      },
      select
    });
  }

  const resolved = user ?? null;
  cache.set(cacheKey, resolved);
  return resolved;
}

async function resolveClientForImport(
  tenantId: number,
  idRaw: string
): Promise<
  | { ok: true; client: ResolvedClient; via: "db_id" | "client_code"; excelRaw: string }
  | { ok: false; detail: string }
> {
  const excelRaw = idRaw.trim();
  const parsed = classifyFlexibleImportId(excelRaw, {
    maxCodeLen: MAX_CLIENT_CODE_ID_LEN,
    label: "ID клиента"
  });

  if (parsed.kind === "absent") {
    return { ok: false, detail: "пустой ID клиента" };
  }
  if (parsed.kind === "invalid") {
    return { ok: false, detail: parsed.detail };
  }

  if (parsed.kind === "ok_db") {
    const client = await prisma.client.findFirst({
      where: { id: parsed.id, tenant_id: tenantId, merged_into_client_id: null },
      select: {
        id: true,
        name: true,
        client_code: true,
        region: true,
        zone: true,
        agent_id: true
      }
    });
    if (!client) {
      return {
        ok: false,
        detail: `клиент с DB id=${parsed.id} (из Excel «${excelRaw}») не найден в этом тенанте`
      };
    }
    return {
      ok: true,
      via: "db_id",
      excelRaw,
      client: {
        id: client.id,
        name: client.name,
        client_code: client.client_code,
        region: client.region,
        zone: client.zone,
        agent_id: client.agent_id
      }
    };
  }

  // ok_code — masalan a0_126 (raqamlarni ajratib olish TAQIQLANADI)
  const code = parsed.code.trim();
  const client = await prisma.client.findFirst({
    where: {
      tenant_id: tenantId,
      merged_into_client_id: null,
      client_code: { equals: code, mode: "insensitive" }
    },
    select: {
      id: true,
      name: true,
      client_code: true,
      region: true,
      zone: true,
      agent_id: true
    }
  });
  if (!client) {
    return {
      ok: false,
      detail: `клиент с кодом «${code}» не найден (Excel: «${excelRaw}»). Нужен client_code или числовой DB id — цифры из кода не вырезаются`
    };
  }
  return {
    ok: true,
    via: "client_code",
    excelRaw,
    client: {
      id: client.id,
      name: client.name,
      client_code: client.client_code,
      region: client.region,
      zone: client.zone,
      agent_id: client.agent_id
    }
  };
}

export function buildOpeningBalanceImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const example = ["a0_126", "Samarqand", "PMSM002", "-52500"];
  const note = [
    "ID клиента: числовой DB id ИЛИ код клиента (a0_126, ks_1652…) — как в карточке.",
    "Нельзя вырезать цифры из кода: a0_126 ≠ 126.",
    "Сумма > 0 → предоплата (оплата). Сумма < 0 → задолженность (расход). 0 — пропуск.",
    "Если в строке нет ID, области, кода агента или суммы — строка пропускается.",
    "Код агента из Excel используется для баланса, если найден. Иначе — агент из карточки.",
    "Клиент без агента (и Excel-код не найден) — не принимается. Дата = момент импорта."
  ];
  const ws = XLSX.utils.aoa_to_sheet([[...OPENING_BALANCE_IMPORT_HEADERS], example, [], note]);
  ws["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Нач. балансы");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export type OpeningBalanceImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

export async function importOpeningBalancesFromBuffer(
  tenantId: number,
  buffer: Buffer,
  actorUserId: number | null,
  defaultPaymentType = "Наличные"
): Promise<OpeningBalanceImportResult> {
  if (!buffer.length) throw new Error("EMPTY_FILE");
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("EMPTY_FILE");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
    header: 1,
    defval: ""
  });
  if (!matrix.length) throw new Error("EMPTY_FILE");

  const headerIdx = findHeaderRow(matrix);
  if (headerIdx < 0) throw new Error("BAD_HEADERS");
  const headerMap = buildHeaderMap(matrix[headerIdx] ?? []);
  if (headerMap.client_id === undefined || headerMap.amount === undefined) {
    throw new Error("BAD_HEADERS");
  }

  const importedAtIso = new Date().toISOString();
  const agentByCode = new Map<string, ResolvedExcelAgent | null>();

  const errors: string[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let created = 0;
  const maxRows = 2000;
  let dataRows = 0;

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const rowNum = i + 1;
    const idRaw = cell(row, headerMap.client_id);
    const amountRaw = cell(row, headerMap.amount);
    const regionRaw = cell(row, headerMap.region);
    const agentCodeRaw = cell(row, headerMap.agent_code);
    const payRaw = cell(row, headerMap.payment_type);
    const noteRaw = cell(row, headerMap.note);

    if (
      isIncompleteOpeningBalanceImportRow({
        clientId: idRaw,
        region: regionRaw,
        agentCode: agentCodeRaw,
        amount: amountRaw
      })
    ) {
      skipped++;
      continue;
    }

    dataRows++;
    if (dataRows > maxRows) throw new Error("TOO_MANY_ROWS");

    const signed = parseSignedAmount(amountRaw);
    if (signed === "empty" || signed === "zero") {
      skipped++;
      continue;
    }
    if (signed === "bad") {
      errors.push(`Строка ${rowNum}: некорректная сумма «${amountRaw}» (Excel ID «${idRaw || "—"}»)`);
      continue;
    }

    const resolved = await resolveClientForImport(tenantId, idRaw);
    if (!resolved.ok) {
      errors.push(`Строка ${rowNum}: ${resolved.detail}`);
      continue;
    }
    const { client, via, excelRaw } = resolved;

    const excelAgent = agentCodeRaw
      ? await resolveAgentByExcelCode(tenantId, agentCodeRaw, agentByCode)
      : null;
    const picked = pickOpeningBalanceAgent({
      excelAgentId: excelAgent?.id ?? null,
      cardAgentId: client.agent_id,
      excelCode: agentCodeRaw
    });
    if (!picked.ok) {
      errors.push(
        `Строка ${rowNum}: у клиента «${client.name}» (код «${client.client_code ?? "—"}», DB #${client.id}, Excel «${excelRaw}») нет агента в карточке и код агента Excel не найден — строка отклонена`
      );
      continue;
    }
    if (picked.warning) {
      warnings.push(
        `Строка ${rowNum}: ${picked.warning} (клиент «${client.client_code ?? client.id}», DB #${client.id})`
      );
    }

    const regionPatch = regionRaw ? excelRegionCardPatch({
      cardRegion: client.region,
      cardZone: client.zone,
      excelRegion: regionRaw
    }) : { patch: null, mismatch: false };
    if (regionPatch.mismatch) {
      warnings.push(
        `Строка ${rowNum}: область Excel «${regionRaw}» ≠ карточка «${client.region}» (клиент «${client.client_code ?? client.id}») — импорт продолжен`
      );
    }

    const payment_type = (payRaw || defaultPaymentType).trim() || defaultPaymentType;
    try {
      await createOpeningBalance(
        tenantId,
        {
          client_id: client.id,
          balance_type: signed.balance_type,
          amount: signed.amount,
          payment_type,
          paid_at: importedAtIso,
          ledger_agent_id: picked.agentId,
          note:
            noteRaw ||
            `Импорт Excel · ${signed.balance_type === "debt" ? "задолженность" : "предоплата"} · ${excelRaw} → #${client.id} (${via})`
        },
        actorUserId
      );
      if (regionPatch.patch) {
        await prisma.client.update({
          where: { id: client.id },
          data: {
            region: regionPatch.patch.region,
            ...(regionPatch.patch.zone ? { zone: regionPatch.patch.zone } : {})
          }
        });
      }
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ERR";
      const human =
        msg === "BAD_CLIENT_AGENT"
          ? "у клиента не привязан агент"
          : msg === "BAD_LEDGER_AGENT"
            ? "агент Excel не найден или неактивен"
            : msg === "BAD_CLIENT"
            ? "клиент не найден"
            : msg === "BAD_AMOUNT"
              ? "некорректная сумма"
              : msg === "BAD_CASH_DESK"
                ? "касса не найдена / не принимает"
                : msg === "CASH_DESK_NO_CLIENT_PAYMENTS"
                  ? "касса не принимает оплаты клиентов"
                  : msg;
      errors.push(
        `Строка ${rowNum}: ${human} (Excel «${excelRaw}» → DB #${client.id} «${client.name}», сумма ${signed.balance_type === "debt" ? "-" : "+"}${signed.amount})`
      );
    }
  }

  if (created === 0 && errors.length === 0) throw new Error("EMPTY_ROWS");
  return { created, skipped, errors, warnings };
}
