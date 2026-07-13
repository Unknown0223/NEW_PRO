import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SlotHistoryRow, WorkSlotRow } from "./work-slots.types";


export type ListWorkSlotsFilters = {
  branch_code?: string;
  branch_codes?: string[];
  slot_type?: string;
  slot_types?: string[];
  is_active?: boolean;
  q?: string;
  direction_id?: number;
  direction_ids?: number[];
  territory?: string;
  territory_zone?: string;
  territory_zones?: string[];
  territory_oblast?: string;
  territory_oblasts?: string[];
  territory_city?: string;
  territory_cities?: string[];
  warehouse_id?: number;
  warehouse_ids?: number[];
  cash_desk_id?: number;
  cash_desk_ids?: number[];
  page?: number;
  limit?: number;
};

export function normStrings(values?: string[]): string[] {
  if (!values?.length) return [];
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

export function normPositiveIds(values?: number[]): number[] {
  if (!values?.length) return [];
  return [...new Set(values.filter((n) => Number.isFinite(n) && n > 0))];
}

export function buildListWhere(tenantId: number, filters: ListWorkSlotsFilters): Prisma.WorkSlotWhereInput {
  const where: Prisma.WorkSlotWhereInput = { tenant_id: tenantId };

  const branchCodes = normStrings(
    filters.branch_codes?.length ? filters.branch_codes : filters.branch_code ? [filters.branch_code] : []
  );
  if (branchCodes.length === 1) where.branch_code = branchCodes[0];
  else if (branchCodes.length > 1) where.branch_code = { in: branchCodes };

  if (filters.slot_types?.length) {
    where.slot_type = { in: filters.slot_types };
  } else if (filters.slot_type?.trim()) {
    where.slot_type = filters.slot_type.trim();
  }

  if (filters.is_active === true || filters.is_active === false) where.is_active = filters.is_active;

  const directionIds = normPositiveIds(
    filters.direction_ids?.length
      ? filters.direction_ids
      : filters.direction_id != null
        ? [filters.direction_id]
        : []
  );
  if (directionIds.length === 1) where.direction_id = directionIds[0];
  else if (directionIds.length > 1) where.direction_id = { in: directionIds };

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { slot_code: { contains: q, mode: "insensitive" } },
      { label: { contains: q, mode: "insensitive" } }
    ];
  }

  const and: Prisma.WorkSlotWhereInput[] = [];

  const territoryUserAnd: Prisma.UserWhereInput[] = [];
  const territoryZones = normStrings(
    filters.territory_zones?.length
      ? filters.territory_zones
      : filters.territory_zone
        ? [filters.territory_zone]
        : []
  );
  if (territoryZones.length === 1) {
    territoryUserAnd.push({ territory: { contains: territoryZones[0]!, mode: "insensitive" } });
  } else if (territoryZones.length > 1) {
    territoryUserAnd.push({
      OR: territoryZones.map((z) => ({ territory: { contains: z, mode: "insensitive" as const } }))
    });
  }

  const territoryOblasts = normStrings(
    filters.territory_oblasts?.length
      ? filters.territory_oblasts
      : filters.territory_oblast
        ? [filters.territory_oblast]
        : []
  );
  if (territoryOblasts.length === 1) {
    territoryUserAnd.push({ territory: { contains: territoryOblasts[0]!, mode: "insensitive" } });
  } else if (territoryOblasts.length > 1) {
    territoryUserAnd.push({
      OR: territoryOblasts.map((z) => ({ territory: { contains: z, mode: "insensitive" as const } }))
    });
  }

  const territoryCities = normStrings(
    filters.territory_cities?.length
      ? filters.territory_cities
      : filters.territory_city
        ? [filters.territory_city]
        : []
  );
  if (territoryCities.length === 1) {
    territoryUserAnd.push({ territory: { contains: territoryCities[0]!, mode: "insensitive" } });
  } else if (territoryCities.length > 1) {
    territoryUserAnd.push({
      OR: territoryCities.map((z) => ({ territory: { contains: z, mode: "insensitive" as const } }))
    });
  }
  if (filters.territory?.trim() && territoryUserAnd.length === 0) {
    territoryUserAnd.push({ territory: { contains: filters.territory.trim(), mode: "insensitive" } });
  }
  if (territoryUserAnd.length > 0) {
    and.push({
      user_links: {
        some: {
          ended_at: null,
          user: territoryUserAnd.length === 1 ? territoryUserAnd[0]! : { AND: territoryUserAnd }
        }
      }
    });
  }

  const warehouseIds = normPositiveIds(
    filters.warehouse_ids?.length
      ? filters.warehouse_ids
      : filters.warehouse_id != null
        ? [filters.warehouse_id]
        : []
  );
  if (warehouseIds.length === 1) {
    const wid = warehouseIds[0]!;
    and.push({
      user_links: {
        some: {
          ended_at: null,
          user: {
            OR: [
              { warehouse_id: wid },
              { warehouse_links: { some: { warehouse_id: wid } } }
            ]
          }
        }
      }
    });
  } else if (warehouseIds.length > 1) {
    and.push({
      user_links: {
        some: {
          ended_at: null,
          user: {
            OR: warehouseIds.flatMap((wid) => [
              { warehouse_id: wid },
              { warehouse_links: { some: { warehouse_id: wid } } }
            ])
          }
        }
      }
    });
  }

  const cashDeskIds = normPositiveIds(
    filters.cash_desk_ids?.length
      ? filters.cash_desk_ids
      : filters.cash_desk_id != null
        ? [filters.cash_desk_id]
        : []
  );
  if (cashDeskIds.length === 1) {
    const cid = cashDeskIds[0]!;
    and.push({
      user_links: {
        some: {
          ended_at: null,
          user: { cash_desk_links: { some: { cash_desk_id: cid } } }
        }
      }
    });
  } else if (cashDeskIds.length > 1) {
    and.push({
      user_links: {
        some: {
          ended_at: null,
          user: {
            OR: cashDeskIds.map((cid) => ({
              cash_desk_links: { some: { cash_desk_id: cid } }
            }))
          }
        }
      }
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}
