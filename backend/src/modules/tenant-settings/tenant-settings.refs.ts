import { prisma } from "../../config/database";
import { asRecord } from "./tenant-settings.shared";
import type {
  BranchDto,
  ClientRefEntryDto,
  TerritoryNodeDto,
  UnitMeasureDto
} from "./tenant-settings.types";
import { branchCashDeskIds } from "./tenant-settings.types";

export function stringArrayFromUnknown(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim());
}

export function territoryTreeFromUnknown(v: unknown): { zone: string; region: string; cities: string[] }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const zone = typeof row.zone === "string" ? row.zone.trim() : "";
      const region = typeof row.region === "string" ? row.region.trim() : "";
      const cities = stringArrayFromUnknown(row.cities);
      if (!zone || !region) return null;
      return { zone, region, cities };
    })
    .filter((x): x is { zone: string; region: string; cities: string[] } => x != null);
}

function parseTerritoryNode(item: unknown): TerritoryNodeDto | null {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;
  const codeRaw = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
  const code = codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : null;
  const comment = typeof row.comment === "string" ? row.comment.trim() : "";
  const sort_order =
    typeof row.sort_order === "number" && Number.isInteger(row.sort_order) ? row.sort_order : null;
  const active = typeof row.active === "boolean" ? row.active : true;
  const rawChildren = row.children;
  const children = Array.isArray(rawChildren)
    ? rawChildren.map(parseTerritoryNode).filter((x): x is TerritoryNodeDto => x != null)
    : [];
  return { id, name, code, comment: comment || null, sort_order, active, children };
}

export function territoryNodesFromUnknown(v: unknown): TerritoryNodeDto[] {
  if (!Array.isArray(v)) return [];
  return v.map(parseTerritoryNode).filter((x): x is TerritoryNodeDto => x != null);
}

function parseUnitMeasure(item: unknown): UnitMeasureDto | null {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const codeRaw = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
  const code = codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : null;
  const sort_order =
    typeof row.sort_order === "number" && Number.isInteger(row.sort_order) ? row.sort_order : null;
  const comment = typeof row.comment === "string" ? row.comment.trim() : "";
  const active = typeof row.active === "boolean" ? row.active : true;
  return { id, name, title: title || null, code, sort_order, comment: comment || null, active };
}

export function unitMeasuresFromUnknown(v: unknown): UnitMeasureDto[] {
  if (!Array.isArray(v)) return [];
  return v.map(parseUnitMeasure).filter((x): x is UnitMeasureDto => x != null);
}

function simpleHash36(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function parseClientRefEntry(item: unknown): ClientRefEntryDto | null {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;
  const codeRaw = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
  const code = codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : null;
  const sort_order =
    typeof row.sort_order === "number" && Number.isInteger(row.sort_order) ? row.sort_order : null;
  const comment = typeof row.comment === "string" ? row.comment.trim() : "";
  const active = typeof row.active === "boolean" ? row.active : true;
  const colorRaw = typeof row.color === "string" ? row.color.trim() : "";
  const color = colorRaw ? colorRaw.slice(0, 32) : null;
  return { id, name, code, sort_order, comment: comment || null, active, color };
}

export function clientRefEntriesFromUnknown(v: unknown): ClientRefEntryDto[] {
  if (!Array.isArray(v)) return [];
  return v.map(parseClientRefEntry).filter((x): x is ClientRefEntryDto => x != null);
}

function legacyStringsToClientRefEntries(strings: string[], prefix: string): ClientRefEntryDto[] {
  return strings.map((s, i) => ({
    id: `legacy-${prefix}-${i}-${simpleHash36(s)}`,
    name: s,
    code: null,
    sort_order: null,
    comment: null,
    active: true,
    color: null
  }));
}

export function resolveClientRefEntries(
  ref: Record<string, unknown>,
  key: "client_format_entries" | "client_type_entries" | "client_category_entries",
  legacyStrings: string[],
  legacyPrefix: string
): ClientRefEntryDto[] {
  const parsed = clientRefEntriesFromUnknown(ref[key]);
  if (parsed.length > 0) return parsed;
  return legacyStringsToClientRefEntries(legacyStrings, legacyPrefix);
}

/** `return_reasons` qatorlari → `refusal_reason_entries` ga mos keladigan struktura. */
export function resolveRefusalReasonEntries(ref: Record<string, unknown>): ClientRefEntryDto[] {
  const parsed = clientRefEntriesFromUnknown(ref.refusal_reason_entries);
  if (parsed.length > 0) return parsed;
  return legacyStringsToClientRefEntries(stringArrayFromUnknown(ref.return_reasons), "refusal");
}

type ClientRefEntryPatch = {
  id: string;
  name: string;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
  color?: string | null;
};

type CurrencyEntryPatch = {
  id: string;
  name: string;
  code: string;
  sort_order?: number | null;
  active?: boolean;
  is_default?: boolean;
};

type PaymentMethodEntryPatch = {
  id: string;
  name: string;
  code?: string | null;
  currency_code: string;
  sort_order?: number | null;
  comment?: string | null;
  color?: string | null;
  active?: boolean;
};

type PriceTypeEntryPatch = {
  id: string;
  name: string;
  code?: string | null;
  payment_method_id: string;
  kind?: "sale" | "purchase";
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
  manual?: boolean;
  attached_clients_only?: boolean;
};

export function toClientRefEntryDto(e: ClientRefEntryPatch): ClientRefEntryDto {
  return {
    id: e.id.trim(),
    name: e.name.trim(),
    code: e.code ?? null,
    sort_order: e.sort_order ?? null,
    comment: e.comment ?? null,
    active: e.active ?? true,
    color: e.color ?? null
  };
}

export function activeValuesFromClientRefEntries(entries: ClientRefEntryDto[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.active === false) continue;
    const v = (e.code && e.code.trim() !== "" ? e.code.trim() : e.name.trim()) || "";
    if (v) out.push(v);
  }
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b, "uz"));
}

function dedupeStringsOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function dedupePositiveIntsOrdered(nums: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of nums) {
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function parseBranch(item: unknown): BranchDto | null {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;
  const codeRaw = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
  const code = codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : null;
  const sort_order =
    typeof row.sort_order === "number" && Number.isInteger(row.sort_order) ? row.sort_order : null;
  const comment = typeof row.comment === "string" ? row.comment.trim() : "";
  const active = typeof row.active === "boolean" ? row.active : true;
  const territoryLegacy = typeof row.territory === "string" ? row.territory.trim() : "";
  const cityLegacy = typeof row.city === "string" ? row.city.trim() : "";
  const territories = dedupeStringsOrdered([
    ...stringArrayFromUnknown(row.territories),
    ...(territoryLegacy ? [territoryLegacy] : [])
  ]);
  const cities = dedupeStringsOrdered([...stringArrayFromUnknown(row.cities), ...(cityLegacy ? [cityLegacy] : [])]);
  const cashbox = typeof row.cashbox === "string" ? row.cashbox.trim() : "";
  const deskFromArray: number[] = [];
  if (Array.isArray(row.cash_desk_ids)) {
    for (const x of row.cash_desk_ids) {
      if (typeof x === "number" && Number.isInteger(x) && x > 0) deskFromArray.push(x);
      else if (typeof x === "string" && /^\d+$/.test(x.trim())) {
        const n = Number.parseInt(x.trim(), 10);
        if (n > 0) deskFromArray.push(n);
      }
    }
  }
  let cash_desk_id: number | null = null;
  const rawDesk = row.cash_desk_id;
  if (typeof rawDesk === "number" && Number.isInteger(rawDesk) && rawDesk > 0) {
    cash_desk_id = rawDesk;
  } else if (typeof rawDesk === "string" && /^\d+$/.test(rawDesk.trim())) {
    const n = Number.parseInt(rawDesk.trim(), 10);
    if (n > 0) cash_desk_id = n;
  }
  const cash_desk_ids = dedupePositiveIntsOrdered([
    ...(cash_desk_id != null && cash_desk_id > 0 ? [cash_desk_id] : []),
    ...deskFromArray
  ]);
  const primaryDesk = cash_desk_ids[0] ?? null;
  const user_links = Array.isArray(row.user_links)
    ? row.user_links
        .map((x) => {
          if (x == null || typeof x !== "object" || Array.isArray(x)) return null;
          const r = x as Record<string, unknown>;
          const role = typeof r.role === "string" ? r.role.trim() : "";
          if (!role) return null;
          const user_ids = Array.isArray(r.user_ids)
            ? r.user_ids.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0)
            : [];
          return { role, user_ids: Array.from(new Set(user_ids)) };
        })
        .filter((x): x is { role: string; user_ids: number[] } => x != null)
    : [];
  return {
    id,
    name,
    code,
    sort_order,
    comment: comment || null,
    active,
    ...(territories.length ? { territories } : {}),
    ...(cities.length ? { cities } : {}),
    ...(cash_desk_ids.length ? { cash_desk_ids } : {}),
    territory: territories[0] ?? null,
    city: cities[0] ?? null,
    cashbox: cashbox || null,
    cash_desk_id: primaryDesk,
    user_links
  };
}

export function branchesFromUnknown(v: unknown): BranchDto[] {
  if (!Array.isArray(v)) return [];
  return v.map(parseBranch).filter((x): x is BranchDto => x != null);
}

export async function assertBranchCashDeskAssignments(
  tenantId: number,
  branches: Pick<BranchDto, "cash_desk_id" | "cash_desk_ids">[]
): Promise<void> {
  const ids: number[] = [];
  for (const b of branches) {
    ids.push(...branchCashDeskIds(b));
  }
  if (!ids.length) return;
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) throw new Error("DUPLICATE_BRANCH_CASH_DESK");
  const n = await prisma.cashDesk.count({
    where: { tenant_id: tenantId, id: { in: [...uniq] } }
  });
  if (n !== uniq.size) throw new Error("INVALID_BRANCH_CASH_DESK");
}

/** Kassa qatorida filial nomini ko‘rsatish (profil JSON bo‘yicha). */
export async function mapCashDeskIdToBranchName(tenantId: number): Promise<Map<number, string>> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const branches = branchesFromUnknown((asRecord(row?.settings) as any).references?.branches);
  const m = new Map<number, string>();
  for (const b of branches) {
    for (const cid of branchCashDeskIds(b)) {
      if (cid > 0 && !m.has(cid)) m.set(cid, b.name);
    }
  }
  return m;
}
