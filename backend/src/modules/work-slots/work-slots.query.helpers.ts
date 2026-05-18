import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SlotHistoryRow, WorkSlotRow } from "./work-slots.types";

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
  const whNames = new Set<string>();
  if (u?.warehouse?.name) whNames.add(u.warehouse.name);
  for (const l of u?.warehouse_links ?? []) {
    if (l.warehouse?.name) whNames.add(l.warehouse.name);
  }
  const cashLinks = u?.cash_desk_links ?? [];
  const cashNames = cashLinks
    .map((l) => l.cash_desk?.name)
    .filter((n): n is string => Boolean(n?.trim()));
  const primaryWarehouseId = u?.warehouse?.id ?? u?.warehouse_links?.[0]?.warehouse?.id ?? null;
  const primaryCashDeskId = cashLinks[0]?.cash_desk?.id ?? null;

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
    active_user_territory: u?.territory?.trim() || null,
    ...(() => {
      const parts = parseUserTerritoryParts(u?.territory);
      return {
        active_territory_zone: parts.zone,
        active_territory_oblast: parts.oblast,
        active_territory_city: parts.city
      };
    })(),
    active_warehouse_id: primaryWarehouseId,
    active_warehouse_name: whNames.size > 0 ? [...whNames].join(", ") : null,
    active_cash_desk_id: primaryCashDeskId,
    active_cash_desk_names: cashNames.length > 0 ? cashNames.join(", ") : null,
    active_since: active?.started_at.toISOString() ?? null,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString()
  };
}

export const slotInclude = {
  direction: { select: { name: true } },
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
            where: { link_role: "skladchik" },
            take: 5,
            select: { warehouse: { select: { id: true, name: true } } }
          },
          cash_desk_links: {
            take: 5,
            select: { cash_desk: { select: { id: true, name: true } } }
          }
        }
      }
    }
  }
} as const;
