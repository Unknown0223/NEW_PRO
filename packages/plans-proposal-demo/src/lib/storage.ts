import {
  periodKey,
  periodLabel,
  validPeriod,
  validateConfig,
  type DirectionContext,
  type ProposalConfig
} from "@salec/plans-proposal";
import { AUDIT_ACTOR, makeAuditEntries, type AuditEntry } from "./audit";

export const STORAGE_KEY = "salec.plans-proposal.demo.shared.v3";
export const ACTIVE_KEY = "salec.plans-proposal.demo.shared.active.v3";
export const LEGACY_KEY = "salec.plans-proposal.demo.drafts.v2";
export const MAX_DRAFTS = 12;
export const MAX_AUDIT = 500;
const MAX_BYTES = 5_000_000;

/** Davr + yo‘nalish uchun bitta umumiy draft. Shaxsiy nusxalar yo‘q. */
export type SharedDraft = {
  version: 3;
  key: string;
  name: string;
  createdAt: string;
  savedAt: string;
  updatedBy: string;
  context: DirectionContext;
  configs: Record<string, ProposalConfig>;
  visibleKpiIds: number[];
  removed: Array<{ kpiGroupId: number; key: string }>;
  audit: AuditEntry[];
};

export type StorageState = {
  drafts: SharedDraft[];
  activeKey: string | null;
  error: string | null;
};

export function draftKey(context: DirectionContext): string {
  return `${context.tenantId}:${context.directionId}:${periodKey(context.target)}`;
}

export function createSharedDraft(
  context: DirectionContext,
  configs: Record<string, ProposalConfig>,
  visibleKpiIds: number[],
  name?: string
): SharedDraft {
  const at = new Date().toISOString();
  const key = draftKey(context);
  const draft: SharedDraft = {
    version: 3,
    key,
    name: name?.trim() || `Umumiy draft · ${periodLabel(context.target)}`,
    createdAt: at,
    savedAt: at,
    updatedBy: AUDIT_ACTOR,
    context: JSON.parse(JSON.stringify(context)) as DirectionContext,
    configs: JSON.parse(JSON.stringify(configs)) as Record<string, ProposalConfig>,
    visibleKpiIds: [...visibleKpiIds],
    removed: [],
    audit: []
  };
  draft.audit = makeAuditEntries(
    [
      {
        action: "created",
        kpiGroupId: null,
        cellKey: null,
        employeeName: null,
        field: "Umumiy draft",
        before: null,
        after: draft.name,
        summary: `${periodLabel(context.target)} uchun hamma uchun bitta umumiy draft yaratildi`
      }
    ],
    key,
    { at }
  );
  return draft;
}

type LegacyDraft = {
  version: 2;
  id: string;
  name: string;
  savedAt: string;
  input: { context: DirectionContext; configs: Record<string, ProposalConfig> };
  visibleKpiIds?: number[];
};

function toSharedDraft(value: LegacyDraft): SharedDraft | null {
  const c = value?.input?.context;
  if (!c || !validPeriod(c.target) || !validPeriod(c.source) || !value.input.configs) return null;
  const at = Number.isFinite(Date.parse(value.savedAt)) ? value.savedAt : new Date().toISOString();
  const key = draftKey(c);
  const draft: SharedDraft = {
    version: 3,
    key,
    name: value.name || `Umumiy draft · ${periodLabel(c.target)}`,
    createdAt: at,
    savedAt: at,
    updatedBy: AUDIT_ACTOR,
    context: c,
    configs: value.input.configs,
    visibleKpiIds: Array.isArray(value.visibleKpiIds) ? value.visibleKpiIds : [],
    removed: [],
    audit: []
  };
  draft.audit = makeAuditEntries(
    [
      {
        action: "import",
        kpiGroupId: null,
        cellKey: null,
        employeeName: null,
        field: "Migratsiya",
        before: "Eski v2 draftlar ro‘yxati",
        after: "Bitta umumiy draft",
        summary: `«${draft.name}» v2 draftdan v3 umumiy draftga ko‘chirildi`
      }
    ],
    key,
    { at }
  );
  return draft;
}

function isSharedDraft(value: unknown): value is SharedDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as SharedDraft;
  if (
    d.version !== 3 ||
    typeof d.key !== "string" ||
    typeof d.name !== "string" ||
    typeof d.createdAt !== "string" ||
    typeof d.savedAt !== "string" ||
    typeof d.updatedBy !== "string" ||
    !Number.isFinite(Date.parse(d.savedAt))
  )
    return false;
  const c = d.context;
  if (!c || !validPeriod(c.target) || !validPeriod(c.source)) return false;
  if (!d.configs || typeof d.configs !== "object") return false;
  try {
    for (const config of Object.values(d.configs)) {
      if (validateConfig(config)) return false;
    }
  } catch {
    return false;
  }
  return (
    Array.isArray(d.visibleKpiIds) &&
    d.visibleKpiIds.every((id) => Number.isInteger(id)) &&
    Array.isArray(d.removed) &&
    d.removed.every((r) => r && Number.isInteger(r.kpiGroupId) && typeof r.key === "string") &&
    Array.isArray(d.audit) &&
    d.audit.length <= MAX_AUDIT &&
    d.audit.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.at === "string" &&
        typeof e.actor === "string" &&
        typeof e.summary === "string" &&
        typeof e.action === "string"
    )
  );
}

function readLegacy(): SharedDraft[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const drafts: SharedDraft[] = [];
    for (const item of parsed) {
      const draft = toSharedDraft(item as LegacyDraft);
      if (!draft || seen.has(draft.key)) continue;
      seen.add(draft.key);
      drafts.push(draft);
    }
    return drafts.slice(0, MAX_DRAFTS);
  } catch {
    return [];
  }
}

export function readSharedDrafts(): StorageState {
  if (typeof localStorage === "undefined") return { drafts: [], activeKey: null, error: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const migrated = readLegacy();
      if (migrated.length) {
        writeSharedDrafts(migrated, migrated[0]!.key);
        localStorage.removeItem(LEGACY_KEY);
      }
      return { drafts: migrated, activeKey: migrated[0]?.key ?? null, error: null };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isSharedDraft))
      return {
        drafts: [],
        activeKey: null,
        error:
          "Saqlangan umumiy draft ma’lumoti noto‘g‘ri. U avtomatik o‘chirilmadi; yangi o‘zgartirish eski yozuvni almashtiradi."
      };
    const drafts = parsed.slice(0, MAX_DRAFTS);
    const activeKey = localStorage.getItem(ACTIVE_KEY);
    return {
      drafts,
      activeKey:
        activeKey && drafts.some((d) => d.key === activeKey) ? activeKey : (drafts[0]?.key ?? null),
      error: null
    };
  } catch {
    return {
      drafts: [],
      activeKey: null,
      error: "Brauzer xotirasini o‘qib bo‘lmadi. Maxfiy rejim yoki xotira ruxsatini tekshiring."
    };
  }
}

export function writeSharedDrafts(drafts: SharedDraft[], activeKey?: string | null): void {
  if (drafts.length > MAX_DRAFTS)
    throw new Error(`Ko‘pi bilan ${MAX_DRAFTS} ta davr drafti saqlanadi`);
  const json = JSON.stringify(drafts);
  if (json.length > MAX_BYTES) throw new Error("Draft fayli 5 MB dan katta bo‘lmasin");
  localStorage.setItem(STORAGE_KEY, json);
  if (activeKey !== undefined) {
    if (activeKey) localStorage.setItem(ACTIVE_KEY, activeKey);
    else localStorage.removeItem(ACTIVE_KEY);
  }
}

export function parseSharedDraft(text: string): SharedDraft {
  if (text.length > MAX_BYTES) throw new Error("Draft fayli 5 MB dan katta bo‘lmasin");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Fayl haqiqiy JSON emas");
  }
  // Eksport qilingan bitta draft ham, to‘liq storage ro‘yxati ham import qilinadi.
  const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
  if (isSharedDraft(candidate)) return candidate;
  const migrated = toSharedDraft(candidate as LegacyDraft);
  if (migrated && isSharedDraft(migrated)) return migrated;
  throw new Error("Draft formati noto‘g‘ri yoki ma’lumotlari yetarli emas");
}
