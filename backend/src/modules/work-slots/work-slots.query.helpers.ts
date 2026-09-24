import { toFio } from "../staff/staff.shared.helpers";
import type { WorkSlotRow } from "./work-slots.types";
import {
  effectiveCashDeskIds,
  effectiveTerritories,
  effectiveWarehouseIds,
  effectiveBranchCodes,
  summarizeTerritoriesForDisplay
} from "./work-slots.multi-bindings";

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

export type SlotNameLookups = {
  warehouseNames: Map<number, string>;
  cashDeskNames: Map<number, string>;
  /** Tenant territory_nodes — list ustunlarini to‘g‘ri klassifikatsiya qilish */
  territoryNodes?: Array<{ name?: string; active?: boolean; children?: unknown[] }> | null;
};

export type SlotRowSource = {
  id: number;
  slot_code: string;
  label: string | null;
  branch_code: string | null;
  branch_codes?: string[] | null;
  direction_id: number | null;
  slot_type: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  territory: string | null;
  territories?: string[] | null;
  warehouse_id: number | null;
  warehouse_ids?: number[] | null;
  return_warehouse_id: number | null;
  cash_desk_id: number | null;
  cash_desk_ids?: number[] | null;
  price_type: string | null;
  price_types: unknown;
  entitlements: unknown;
  consignment: boolean;
  consignment_limit_amount: { toString(): string } | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_close_day: number;
  consignment_close_hour: number;
  consignment_close_minute: number;
  warehouse_staff_entitlements: unknown;
  expeditor_assignment_rules: unknown;
  supervisee_agent_slot_ids?: number[] | null;
  warehouse: { id: number; name: string } | null;
  return_warehouse: { id: number; name: string } | null;
  cash_desk: { id: number; name: string } | null;
  direction: { name: string } | null;
  user_links: Array<{
    started_at: Date;
    user: {
      id: number;
      name: string;
      first_name: string | null;
      last_name: string | null;
      middle_name: string | null;
      territory: string | null;
      position: string | null;
      app_access: boolean;
      max_sessions: number;
      warehouse: { id: number; name: string } | null;
      warehouse_links: Array<{ warehouse: { id: number; name: string } }>;
      cash_desk_links: Array<{ cash_desk: { id: number; name: string } }>;
    };
  }>;
};

export function mapSlotRow(s: SlotRowSource, lookups?: SlotNameLookups): WorkSlotRow {
  const active = s.user_links[0];
  const u = active?.user;

  const slotTerritories = effectiveTerritories(s);
  const userTerritory = u?.territory?.trim() || null;
  const territories =
    slotTerritories.length > 0 ? slotTerritories : userTerritory ? [userTerritory] : [];
  const territory = territories[0] ?? null;

  const warehouseIds = effectiveWarehouseIds(s);
  const userWhId = u?.warehouse?.id ?? u?.warehouse_links?.[0]?.warehouse?.id ?? null;
  const activeWarehouseIds =
    warehouseIds.length > 0 ? warehouseIds : userWhId != null ? [userWhId] : [];
  const primaryWarehouseId = activeWarehouseIds[0] ?? null;

  const whNames = new Set<string>();
  for (const id of activeWarehouseIds) {
    const fromLookup = lookups?.warehouseNames?.get(id);
    if (fromLookup) whNames.add(fromLookup);
  }
  if (s.warehouse?.name) whNames.add(s.warehouse.name);
  if (u?.warehouse?.name) whNames.add(u.warehouse.name);
  for (const l of u?.warehouse_links ?? []) {
    if (l.warehouse?.name) whNames.add(l.warehouse.name);
  }

  const cashDeskIds = effectiveCashDeskIds(s);
  const cashLinks = u?.cash_desk_links ?? [];
  const activeCashDeskIds =
    cashDeskIds.length > 0
      ? cashDeskIds
      : cashLinks.map((l) => l.cash_desk?.id).filter((id): id is number => id != null && id > 0);
  const primaryCashDeskId = activeCashDeskIds[0] ?? s.cash_desk?.id ?? null;

  const cashNames: string[] = [];
  for (const id of activeCashDeskIds) {
    const fromLookup = lookups?.cashDeskNames?.get(id);
    if (fromLookup && !cashNames.includes(fromLookup)) cashNames.push(fromLookup);
  }
  if (s.cash_desk?.name && !cashNames.includes(s.cash_desk.name)) {
    cashNames.push(s.cash_desk.name);
  }
  for (const l of cashLinks) {
    const n = l.cash_desk?.name;
    if (n?.trim() && !cashNames.includes(n)) cashNames.push(n);
  }

  const parts = summarizeTerritoriesForDisplay(territories, lookups?.territoryNodes ?? null);

  return {
    id: s.id,
    slot_code: s.slot_code,
    label: s.label,
    branch_code: s.branch_code,
    branch_codes: effectiveBranchCodes(s),
    direction_id: s.direction_id,
    direction_name: s.direction?.name ?? null,
    slot_type: s.slot_type,
    is_active: s.is_active,
    sort_order: s.sort_order,
    active_user_id: u?.id ?? null,
    active_user_name: u ? toFio(u) : null,
    active_user_territory: territory,
    active_user_position: u?.position ?? null,
    active_user_app_access: u != null ? u.app_access : null,
    active_user_max_sessions: u != null ? u.max_sessions : null,
    active_user_active_session_count: 0,
    active_territory_zone: parts.zone,
    active_territory_oblast: parts.oblast,
    active_territory_city: parts.city,
    active_territories: territories,
    active_warehouse_id: primaryWarehouseId,
    active_warehouse_ids: activeWarehouseIds,
    active_warehouse_name: whNames.size > 0 ? [...whNames].join(", ") : null,
    return_warehouse_id: s.return_warehouse_id ?? s.return_warehouse?.id ?? null,
    return_warehouse_name: s.return_warehouse?.name ?? null,
    active_cash_desk_id: primaryCashDeskId,
    active_cash_desk_ids: activeCashDeskIds,
    active_cash_desk_names: cashNames.length > 0 ? cashNames.join(", ") : null,
    price_type: s.price_type?.trim() || null,
    price_types: Array.isArray(s.price_types)
      ? (s.price_types as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    entitlements:
      s.entitlements != null && typeof s.entitlements === "object" && !Array.isArray(s.entitlements)
        ? (s.entitlements as Record<string, unknown>)
        : {},
    consignment: s.consignment,
    consignment_limit_amount: s.consignment_limit_amount?.toString() ?? null,
    consignment_ignore_previous_months_debt: s.consignment_ignore_previous_months_debt,
    consignment_close_day: s.consignment_close_day,
    consignment_close_hour: s.consignment_close_hour,
    consignment_close_minute: s.consignment_close_minute,
    warehouse_staff_entitlements:
      s.warehouse_staff_entitlements != null &&
      typeof s.warehouse_staff_entitlements === "object" &&
      !Array.isArray(s.warehouse_staff_entitlements)
        ? (s.warehouse_staff_entitlements as Record<string, boolean>)
        : {},
    expeditor_assignment_rules:
      s.expeditor_assignment_rules != null &&
      typeof s.expeditor_assignment_rules === "object" &&
      !Array.isArray(s.expeditor_assignment_rules)
        ? (s.expeditor_assignment_rules as Record<string, unknown>)
        : {},
    supervisee_agent_slot_ids: Array.isArray(s.supervisee_agent_slot_ids)
      ? s.supervisee_agent_slot_ids.filter((id): id is number => Number.isFinite(id) && id > 0)
      : [],
    active_since: active?.started_at.toISOString() ?? null,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString()
  };
}

export const slotInclude = {
  direction: { select: { name: true } },
  warehouse: { select: { id: true, name: true } },
  return_warehouse: { select: { id: true, name: true } },
  cash_desk: { select: { id: true, name: true } },
  user_links: {
    where: { ended_at: null },
    take: 1,
    select: {
      started_at: true,
      user: {
        select: {
          id: true,
          name: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          territory: true,
          position: true,
          app_access: true,
          max_sessions: true,
          warehouse: { select: { id: true, name: true } },
          warehouse_links: {
            select: { warehouse: { select: { id: true, name: true } } }
          },
          cash_desk_links: {
            select: { cash_desk: { select: { id: true, name: true } } }
          }
        }
      }
    }
  }
} as const;
