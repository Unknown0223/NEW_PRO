import type { WorkSlotRow } from "./work-slots.types";

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

type SlotRowSource = {
  id: number;
  slot_code: string;
  label: string | null;
  branch_code: string | null;
  direction_id: number | null;
  slot_type: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  territory: string | null;
  warehouse_id: number | null;
  return_warehouse_id: number | null;
  cash_desk_id: number | null;
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
  warehouse: { id: number; name: string } | null;
  return_warehouse: { id: number; name: string } | null;
  cash_desk: { id: number; name: string } | null;
  direction: { name: string } | null;
  user_links: Array<{
    started_at: Date;
    user: {
      id: number;
      name: string;
      territory: string | null;
      warehouse: { id: number; name: string } | null;
      warehouse_links: Array<{ warehouse: { id: number; name: string } }>;
      cash_desk_links: Array<{ cash_desk: { id: number; name: string } }>;
    };
  }>;
};

export function mapSlotRow(s: SlotRowSource): WorkSlotRow {
  const active = s.user_links[0];
  const u = active?.user;

  // P0: slot config manba; user — fallback (dual-write davri).
  const slotTerritory = s.territory?.trim() || null;
  const userTerritory = u?.territory?.trim() || null;
  const territory = slotTerritory || userTerritory;

  const slotWhId = s.warehouse_id ?? s.warehouse?.id ?? null;
  const userWhId = u?.warehouse?.id ?? u?.warehouse_links?.[0]?.warehouse?.id ?? null;
  const primaryWarehouseId = slotWhId ?? userWhId;

  const whNames = new Set<string>();
  if (s.warehouse?.name) whNames.add(s.warehouse.name);
  if (u?.warehouse?.name) whNames.add(u.warehouse.name);
  for (const l of u?.warehouse_links ?? []) {
    if (l.warehouse?.name) whNames.add(l.warehouse.name);
  }

  const slotCashId = s.cash_desk_id ?? s.cash_desk?.id ?? null;
  const cashLinks = u?.cash_desk_links ?? [];
  const primaryCashDeskId = slotCashId ?? cashLinks[0]?.cash_desk?.id ?? null;
  const cashNames: string[] = [];
  if (s.cash_desk?.name) cashNames.push(s.cash_desk.name);
  for (const l of cashLinks) {
    const n = l.cash_desk?.name;
    if (n?.trim() && !cashNames.includes(n)) cashNames.push(n);
  }

  const parts = parseUserTerritoryParts(territory);

  return {
    id: s.id,
    slot_code: s.slot_code,
    label: s.label,
    branch_code: s.branch_code,
    direction_id: s.direction_id,
    direction_name: s.direction?.name ?? null,
    slot_type: s.slot_type,
    is_active: s.is_active,
    sort_order: s.sort_order,
    active_user_id: u?.id ?? null,
    active_user_name: u?.name ?? null,
    active_user_territory: territory,
    active_territory_zone: parts.zone,
    active_territory_oblast: parts.oblast,
    active_territory_city: parts.city,
    active_warehouse_id: primaryWarehouseId,
    active_warehouse_name: whNames.size > 0 ? [...whNames].join(", ") : null,
    return_warehouse_id: s.return_warehouse_id ?? s.return_warehouse?.id ?? null,
    return_warehouse_name: s.return_warehouse?.name ?? null,
    active_cash_desk_id: primaryCashDeskId,
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
          territory: true,
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
