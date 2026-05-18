import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";

export function splitCsvTokens(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function intList(v?: string): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x));
}

export function strList(v?: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** GET `/api/:slug/reports/agent-orders` query */

export function parseTerritoryNodes(value: unknown): TerritoryNode[] {
  if (!Array.isArray(value)) return [];
  const nodes: TerritoryNode[] = [];
  for (const raw of value) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const active = typeof row.active === "boolean" ? row.active : true;
    const children = parseTerritoryNodes(row.children);
    nodes.push({ name, active, children });
  }
  return nodes;
}

export function buildTerritoryIndexFromNodes(nodes: TerritoryNode[]) {
  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();
  const regionsByZone = new Map<string, Set<string>>();
  const citiesByRegion = new Map<string, Set<string>>();

  for (const zoneNode of nodes) {
    if (zoneNode.active === false) continue;
    const zone = zoneNode.name.trim();
    if (!zone) continue;
    zones.add(zone);
    const zoneRegions = regionsByZone.get(zone) ?? new Set<string>();

    for (const regionNode of zoneNode.children ?? []) {
      if (regionNode.active === false) continue;
      const region = regionNode.name.trim();
      if (!region) continue;
      regions.add(region);
      zoneRegions.add(region);
      const regionCities = citiesByRegion.get(region) ?? new Set<string>();

      for (const cityNode of regionNode.children ?? []) {
        if (cityNode.active === false) continue;
        const city = cityNode.name.trim();
        if (!city) continue;
        cities.add(city);
        regionCities.add(city);
      }
      citiesByRegion.set(region, regionCities);
    }
    regionsByZone.set(zone, zoneRegions);
  }

  return {
    territory_1: [...zones].sort((a, b) => a.localeCompare(b, "ru")),
    territory_2: [...regions].sort((a, b) => a.localeCompare(b, "ru")),
    territory_3: [...cities].sort((a, b) => a.localeCompare(b, "ru")),
    territory_2_by_1: Object.fromEntries(
      [...regionsByZone.entries()].map(([zone, set]) => [zone, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
    ) as Record<string, string[]>,
    territory_3_by_2: Object.fromEntries(
      [...citiesByRegion.entries()].map(([region, set]) => [region, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
    ) as Record<string, string[]>
  };
}


export function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildFilterSql(tenantId: number, f: AgentOrdersFilters) {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`];

  const from = parseDate(f.from);
  const to = parseDate(f.to);
  if (to) to.setUTCHours(23, 59, 59, 999);
  const dateExpr =
    f.date_type === "delivered_date"
      ? Prisma.sql`sl.delivered_at`
      : f.date_type === "shipped_date"
        ? Prisma.sql`sl.shipped_at`
        : Prisma.sql`o.created_at`;
  if (from) parts.push(Prisma.sql`${dateExpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dateExpr} <= ${to}`);

  if (f.statuses && f.statuses.length > 0) parts.push(Prisma.sql`o.status IN (${Prisma.join(f.statuses)})`);
  else if (f.status) parts.push(Prisma.sql`o.status = ${f.status}`);

  if (f.agent_ids && f.agent_ids.length > 0) parts.push(Prisma.sql`o.agent_id IN (${Prisma.join(f.agent_ids)})`);
  else if (f.agent_id) parts.push(Prisma.sql`o.agent_id = ${f.agent_id}`);

  if (f.order_types && f.order_types.length > 0) parts.push(Prisma.sql`o.order_type IN (${Prisma.join(f.order_types)})`);
  else if (f.order_type) parts.push(Prisma.sql`o.order_type = ${f.order_type}`);
  if (f.trade_directions && f.trade_directions.length > 0) {
    parts.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM trade_directions td
        WHERE td.tenant_id = ${tenantId}
          AND (td.code IN (${Prisma.join(f.trade_directions)}) OR td.name IN (${Prisma.join(f.trade_directions)}))
          AND (
            u.trade_direction_id = td.id
            OR COALESCE(u.trade_direction, '') = td.code
            OR COALESCE(u.trade_direction, '') = td.name
          )
      )
    `);
  } else if (f.trade_direction) {
    parts.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM trade_directions td
        WHERE td.tenant_id = ${tenantId}
          AND (td.code = ${f.trade_direction} OR td.name = ${f.trade_direction})
          AND (
            u.trade_direction_id = td.id
            OR COALESCE(u.trade_direction, '') = td.code
            OR COALESCE(u.trade_direction, '') = td.name
          )
      )
    `);
  }
  if (f.client_categories && f.client_categories.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.category,'') IN (${Prisma.join(f.client_categories)})`);
  } else if (f.client_category) {
    parts.push(Prisma.sql`COALESCE(c.category,'') = ${f.client_category}`);
  }
  if (f.price_types && f.price_types.length > 0) {
    parts.push(Prisma.sql`
      (
        COALESCE(u.price_type,'') IN (${Prisma.join(f.price_types)})
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(u.price_type, ''), ',') AS pt(v)
          WHERE btrim(pt.v) IN (${Prisma.join(f.price_types)})
        )
      )
    `);
  } else if (f.price_type) {
    parts.push(Prisma.sql`
      (
        COALESCE(u.price_type,'') = ${f.price_type}
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(u.price_type, ''), ',') AS pt(v)
          WHERE btrim(pt.v) = ${f.price_type}
        )
      )
    `);
  }
  if (f.payment_methods && f.payment_methods.length > 0) {
    parts.push(Prisma.sql`
      (
        COALESCE(o.payment_method_ref,'') IN (${Prisma.join(f.payment_methods)})
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(o.payment_method_ref, ''), ',') AS pm(v)
          WHERE btrim(pm.v) IN (${Prisma.join(f.payment_methods)})
        )
      )
    `);
  } else if (f.payment_method) {
    parts.push(Prisma.sql`
      (
        COALESCE(o.payment_method_ref,'') = ${f.payment_method}
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(o.payment_method_ref, ''), ',') AS pm(v)
          WHERE btrim(pm.v) = ${f.payment_method}
        )
      )
    `);
  }
  if (f.territory_1_list && f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.zone,'')) IN (${Prisma.join(f.territory_1_list)})`);
  } else if (f.territory_1) {
    parts.push(Prisma.sql`btrim(COALESCE(c.zone,'')) = ${f.territory_1}`);
  }
  if (f.territory_2_list && f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.region,'')) IN (${Prisma.join(f.territory_2_list)})`);
  } else if (f.territory_2) {
    parts.push(Prisma.sql`btrim(COALESCE(c.region,'')) = ${f.territory_2}`);
  }
  if (f.territory_3_list && f.territory_3_list.length > 0) {
    parts.push(Prisma.sql`btrim(COALESCE(c.city,'')) IN (${Prisma.join(f.territory_3_list)})`);
  } else if (f.territory_3) {
    parts.push(Prisma.sql`btrim(COALESCE(c.city,'')) = ${f.territory_3}`);
  }
  if (f.consignment === "yes") parts.push(Prisma.sql`o.is_consignment = true`);
  if (f.consignment === "no") parts.push(Prisma.sql`o.is_consignment = false`);

  if (
    f.product_id ||
    (f.product_ids && f.product_ids.length > 0) ||
    f.category_id ||
    (f.category_ids && f.category_ids.length > 0) ||
    f.product_group_id ||
    (f.product_group_ids && f.product_group_ids.length > 0) ||
    f.segment_id ||
    (f.segment_ids && f.segment_ids.length > 0)
  ) {
    parts.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM order_items oi2
        JOIN products p2 ON p2.id = oi2.product_id
        WHERE oi2.order_id = o.id
          ${
            f.product_ids && f.product_ids.length > 0
              ? Prisma.sql`AND p2.id IN (${Prisma.join(f.product_ids)})`
              : f.product_id
                ? Prisma.sql`AND p2.id = ${f.product_id}`
                : Prisma.empty
          }
          ${
            f.category_ids && f.category_ids.length > 0
              ? Prisma.sql`AND p2.category_id IN (${Prisma.join(f.category_ids)})`
              : f.category_id
                ? Prisma.sql`AND p2.category_id = ${f.category_id}`
                : Prisma.empty
          }
          ${
            f.product_group_ids && f.product_group_ids.length > 0
              ? Prisma.sql`AND p2.product_group_id IN (${Prisma.join(f.product_group_ids)})`
              : f.product_group_id
                ? Prisma.sql`AND p2.product_group_id = ${f.product_group_id}`
                : Prisma.empty
          }
          ${
            f.segment_ids && f.segment_ids.length > 0
              ? Prisma.sql`AND p2.segment_id IN (${Prisma.join(f.segment_ids)})`
              : f.segment_id
                ? Prisma.sql`AND p2.segment_id = ${f.segment_id}`
                : Prisma.empty
          }
      )
    `);
  }

  return Prisma.join(parts, " AND ");
}
