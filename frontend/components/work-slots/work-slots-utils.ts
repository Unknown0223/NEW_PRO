import { appTzLocaleOpts } from "@/lib/app-timezone";
import type { WorkSlotType } from "@/lib/work-slots-types";

export const SLOT_TYPE_OPTIONS: { value: WorkSlotType; label: string }[] = [
  { value: "agent", label: "Агент" },
  { value: "collector", label: "Инкассатор" },
  { value: "expeditor", label: "Экспедитор" },
  { value: "skladchik", label: "Складчик" },
  { value: "supervisor", label: "Супервайзер" },
  { value: "auditor", label: "Аудитор" }
];

export type ActiveStatusFilter = "active" | "inactive" | "all";

export const ACTIVE_STATUS_FILTER_ITEMS: { id: string; title: string }[] = [
  { id: "active", title: "Активные" },
  { id: "inactive", title: "Неактивные" }
];

/** Bitta joy — faol / nofaol (tahrir / yaratish) */
export const SLOT_ACTIVE_STATUS_ITEMS: { id: string; title: string }[] = [
  { id: "true", title: "Активное" },
  { id: "false", title: "Неактивное" }
];

/** Bo‘sh yoki ikkalasi tanlangan — barcha holatlar */
export function activeStatusListToQuery(list: string[]): boolean | undefined {
  const hasActive = list.includes("active");
  const hasInactive = list.includes("inactive");
  if (hasActive && !hasInactive) return true;
  if (hasInactive && !hasActive) return false;
  return undefined;
}

/** @deprecated activeStatusListToQuery ishlating */
export function activeStatusToQuery(s: ActiveStatusFilter): boolean | undefined {
  if (s === "active") return true;
  if (s === "inactive") return false;
  return undefined;
}

export function slotTypeLabel(t: string): string {
  return SLOT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export function staffApiPath(slotType: string): string {
  switch (slotType) {
    case "collector":
      return "collectors";
    case "expeditor":
      return "expeditors";
    case "skladchik":
      return "skladchik";
    case "supervisor":
      return "supervisors";
    case "auditor":
      return "auditors";
    default:
      return "agents";
  }
}

/** Joy konfiguratsiyasi tab id — rolga xos. */
export type SlotWorkplaceConfigTabId =
  | "main"
  | "prices"
  | "limits"
  | "mobile"
  | "skladchik"
  | "expeditor";

export type SlotWorkplaceConfigTab = {
  id: SlotWorkplaceConfigTabId;
  label: string;
  icon: "layout" | "tags" | "shield" | "smartphone" | "truck" | "warehouse";
};

/**
 * Har rol o‘ziga xos sozlamalar:
 * - agent: narx, mahsulot cheklovi, mobil ilova
 * - expeditor: yetkazib berish qoidalari + mobil
 * - skladchik: ombor ruxsatlari
 * - boshqalar: asosiy (yo‘nalish / ombor qaytarish)
 */
export function slotWorkplaceConfigTabs(
  slotType: WorkSlotType | string | undefined
): SlotWorkplaceConfigTab[] {
  switch (slotType) {
    case "agent":
      return [
        { id: "main", label: "Основное", icon: "layout" },
        { id: "prices", label: "Типы цен", icon: "tags" },
        { id: "limits", label: "Ограничения", icon: "shield" },
        { id: "mobile", label: "Мобильное", icon: "smartphone" }
      ];
    case "expeditor":
      return [
        { id: "main", label: "Основное", icon: "layout" },
        { id: "expeditor", label: "Экспедитор", icon: "truck" },
        { id: "mobile", label: "Мобильное", icon: "smartphone" }
      ];
    case "skladchik":
      return [
        { id: "main", label: "Основное", icon: "layout" },
        { id: "skladchik", label: "Складчик", icon: "warehouse" }
      ];
    case "collector":
      return [{ id: "main", label: "Основное", icon: "layout" }];
    case "supervisor":
    case "auditor":
      return [
        { id: "main", label: "Основное", icon: "layout" },
        { id: "mobile", label: "Мобильное", icon: "smartphone" }
      ];
    default:
      return [{ id: "main", label: "Основное", icon: "layout" }];
  }
}

/** Guruhli mobil sozlamalar — agent / expeditor / supervisor joylari. */
export function slotSupportsBulkMobileConfig(slotType: string | undefined): boolean {
  return slotType === "agent" || slotType === "expeditor" || slotType === "supervisor";
}

/** Narx turlari + mahsulot bog‘lanishi — faqat agent joyi. */
export function slotSupportsAgentRestrictions(slotType: string | undefined): boolean {
  return slotType === "agent";
}

/** Guruhli «конфигурация» — agent / expeditor / skladchik (maxsus tablar). */
export function slotSupportsRichWorkplaceConfig(slotType: string | undefined): boolean {
  return slotType === "agent" || slotType === "expeditor" || slotType === "skladchik";
}

/** `User.territory` qatori: zona / viloyat / shahar (nomlar, kod emas). */
export function parseUserTerritoryParts(raw: string | null | undefined): {
  zone: string | null;
  oblast: string | null;
  city: string | null;
} {
  const t = raw?.trim();
  if (!t) return { zone: null, oblast: null, city: null };
  const parts = t
    .split(/\s*\/\s*|[,;|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    zone: parts[0] ?? null,
    oblast: parts[1] ?? null,
    city: parts[2] ?? null
  };
}

export function formatSlotDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", appTzLocaleOpts());
  } catch {
    return iso;
  }
}

export type WorkSlotsQueryFilters = {
  branch_codes?: string[];
  slot_type: WorkSlotType;
  is_active?: boolean;
  q?: string;
  direction_ids?: number[];
  territory_zones?: string[];
  territory_oblasts?: string[];
  territory_cities?: string[];
  warehouse_ids?: number[];
  cash_desk_ids?: number[];
  page?: number;
  limit?: number;
};

function appendCsv(p: URLSearchParams, key: string, values: string[]) {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length) p.set(key, clean.join(","));
}

function appendCsvInts(p: URLSearchParams, key: string, values: number[]) {
  const clean = values.filter((n) => Number.isFinite(n) && n > 0);
  if (clean.length) p.set(key, clean.map(String).join(","));
}

export function buildWorkSlotsQuery(filters: WorkSlotsQueryFilters): string {
  const p = new URLSearchParams();
  appendCsv(p, "branch_codes", filters.branch_codes ?? []);
  p.set("slot_types", filters.slot_type);
  if (filters.is_active === true) p.set("is_active", "true");
  if (filters.is_active === false) p.set("is_active", "false");
  if (filters.q?.trim()) p.set("q", filters.q.trim());
  appendCsvInts(p, "direction_ids", filters.direction_ids ?? []);
  appendCsv(p, "territory_zones", filters.territory_zones ?? []);
  appendCsv(p, "territory_oblasts", filters.territory_oblasts ?? []);
  appendCsv(p, "territory_cities", filters.territory_cities ?? []);
  appendCsvInts(p, "warehouse_ids", filters.warehouse_ids ?? []);
  appendCsvInts(p, "cash_desk_ids", filters.cash_desk_ids ?? []);
  p.set("page", String(filters.page ?? 1));
  p.set("limit", String(filters.limit ?? 20));
  return p.toString();
}

export type ViewMode = "grid" | "list";

/** v2: jadval birinchi (Agents/Expeditors kabi); status ustuni. */
export const WORK_SLOTS_TABLE_ID = "work-slots.list.v2";

export const WORK_SLOTS_COLUMN_IDS = [
  "code",
  "label",
  "role",
  "branch",
  "employee",
  "warehouse",
  "territory_zone",
  "territory_oblast",
  "territory_city",
  "cash_desk",
  "status"
] as const;

export type WorkSlotsColumnId = (typeof WORK_SLOTS_COLUMN_IDS)[number];

export const WORK_SLOTS_COLUMNS: { id: WorkSlotsColumnId; label: string }[] = [
  { id: "code", label: "Код" },
  { id: "label", label: "Название" },
  { id: "role", label: "Роль" },
  { id: "branch", label: "Филиал" },
  { id: "employee", label: "Сотрудник" },
  { id: "warehouse", label: "Склад" },
  { id: "territory_zone", label: "Зона" },
  { id: "territory_oblast", label: "Область" },
  { id: "territory_city", label: "Город" },
  { id: "cash_desk", label: "Касса" },
  { id: "status", label: "Статус" }
];

export const WORK_SLOTS_COLUMN_LABEL_BY_ID = new Map<string, string>(
  WORK_SLOTS_COLUMNS.map((c) => [c.id, c.label])
);

/**
 * Rolga mos boshlang‘ich yashirin ustunlar (Agents vs Expeditors farqi kabi).
 * Foydalanuvchi «Столбцы» orqali o‘zgartirishi mumkin.
 */
export function workSlotsDefaultHiddenColumns(slotType: WorkSlotType | string): string[] {
  switch (slotType) {
    case "agent":
      return [];
    case "expeditor":
      return ["cash_desk"];
    case "skladchik":
      return ["cash_desk", "territory_zone", "territory_oblast", "territory_city"];
    case "collector":
      return ["warehouse"];
    case "supervisor":
    case "auditor":
      return ["cash_desk", "warehouse"];
    default:
      return ["cash_desk"];
  }
}

const VIEW_KEY = "savdo.work-slots.view";

/** Jadval — asosiy ko‘rinish (Agents/Expeditors). */
export function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  const v = localStorage.getItem(VIEW_KEY);
  if (v === "grid") return "grid";
  return "list";
}
