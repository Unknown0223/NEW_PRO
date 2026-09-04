import type { Prisma } from "@prisma/client";

export type ListWorkSlotsFilters = {
  branch_code?: string;
  branch_codes?: string[];
  slot_type?: string;
  slot_types?: string[];
  is_active?: boolean;
  archive?: boolean;
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

function territoryContainsOr(terms: string[]): Prisma.WorkSlotWhereInput[] {
  return terms.flatMap((t) => [
    { territory: { contains: t, mode: "insensitive" as const } },
    { territories: { has: t } },
    {
      user_links: {
        some: {
          ended_at: null,
          user: { territory: { contains: t, mode: "insensitive" as const } }
        }
      }
    }
  ]);
}

export function buildListWhere(tenantId: number, filters: ListWorkSlotsFilters): Prisma.WorkSlotWhereInput {
  const where: Prisma.WorkSlotWhereInput = { tenant_id: tenantId };

  if (filters.archive) {
    where.deleted_at = { not: null };
  } else {
    where.deleted_at = null;
  }

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

  const branchCodes = normStrings(
    filters.branch_codes?.length ? filters.branch_codes : filters.branch_code ? [filters.branch_code] : []
  );
  if (branchCodes.length > 0) {
    and.push({
      OR: [
        { branch_code: branchCodes.length === 1 ? branchCodes[0]! : { in: branchCodes } },
        { branch_codes: { hasSome: branchCodes } }
      ]
    });
  }

  const territoryZones = normStrings(
    filters.territory_zones?.length
      ? filters.territory_zones
      : filters.territory_zone
        ? [filters.territory_zone]
        : []
  );
  const territoryOblasts = normStrings(
    filters.territory_oblasts?.length
      ? filters.territory_oblasts
      : filters.territory_oblast
        ? [filters.territory_oblast]
        : []
  );
  const territoryCities = normStrings(
    filters.territory_cities?.length
      ? filters.territory_cities
      : filters.territory_city
        ? [filters.territory_city]
        : []
  );

  if (territoryZones.length > 0) {
    and.push({
      OR: territoryContainsOr(territoryZones)
    });
  }
  if (territoryOblasts.length > 0) {
    and.push({
      OR: territoryContainsOr(territoryOblasts)
    });
  }
  if (territoryCities.length > 0) {
    and.push({
      OR: territoryContainsOr(territoryCities)
    });
  }
  if (
    filters.territory?.trim() &&
    territoryZones.length === 0 &&
    territoryOblasts.length === 0 &&
    territoryCities.length === 0
  ) {
    and.push({ OR: territoryContainsOr([filters.territory.trim()]) });
  }

  const warehouseIds = normPositiveIds(
    filters.warehouse_ids?.length
      ? filters.warehouse_ids
      : filters.warehouse_id != null
        ? [filters.warehouse_id]
        : []
  );
  if (warehouseIds.length > 0) {
    and.push({
      OR: [
        { warehouse_id: warehouseIds.length === 1 ? warehouseIds[0]! : { in: warehouseIds } },
        { warehouse_ids: { hasSome: warehouseIds } },
        {
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
        }
      ]
    });
  }

  const cashDeskIds = normPositiveIds(
    filters.cash_desk_ids?.length
      ? filters.cash_desk_ids
      : filters.cash_desk_id != null
        ? [filters.cash_desk_id]
        : []
  );
  if (cashDeskIds.length > 0) {
    and.push({
      OR: [
        { cash_desk_id: cashDeskIds.length === 1 ? cashDeskIds[0]! : { in: cashDeskIds } },
        { cash_desk_ids: { hasSome: cashDeskIds } },
        {
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
        }
      ]
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}
