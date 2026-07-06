import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ClientSales2Filters, ReportActor } from "./client-sales-2.types";
import { buildScopedAgentExistsSql } from "../access/access-agent-scope";
import { intList, numOr, parseDate, strList } from "./client-sales-2.helpers";

export function productFilterSql(f: ClientSales2Filters): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.product_ids && f.product_ids.length > 0) parts.push(Prisma.sql`p.id IN (${Prisma.join(f.product_ids)})`);
  if (f.category_ids && f.category_ids.length > 0) parts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  if (f.product_group_ids && f.product_group_ids.length > 0) {
    parts.push(Prisma.sql`p.product_group_id IN (${Prisma.join(f.product_group_ids)})`);
  }
  if (f.segment_ids && f.segment_ids.length > 0) parts.push(Prisma.sql`p.segment_id IN (${Prisma.join(f.segment_ids)})`);
  if (parts.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, " AND ")}`;
}

export function buildOrderWhereSql(tenantId: number, f: ClientSales2Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`];

  const from = parseDate(f.from);
  const to = parseDate(f.to);
  if (to) to.setUTCHours(23, 59, 59, 999);
  const dateExpr =
    f.date_type === "delivered_date"
      ? Prisma.sql`sl.delivered_at`
      : f.date_type === "shipped_date"
        ? Prisma.sql`sl.shipped_at`
        : f.date_type === "created_date"
          ? Prisma.sql`c.created_at`
          : Prisma.sql`o.created_at`;
  if (from) parts.push(Prisma.sql`${dateExpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dateExpr} <= ${to}`);

  if (f.statuses && f.statuses.length > 0) parts.push(Prisma.sql`o.status IN (${Prisma.join(f.statuses)})`);
  else if (f.status) parts.push(Prisma.sql`o.status = ${f.status}`);
  else parts.push(Prisma.sql`o.status <> 'cancelled'`);

  if (f.order_types && f.order_types.length > 0) parts.push(Prisma.sql`o.order_type IN (${Prisma.join(f.order_types)})`);
  else if (f.order_type) parts.push(Prisma.sql`o.order_type = ${f.order_type}`);
  else parts.push(Prisma.sql`o.order_type = 'order'`);

  if (f.agent_ids && f.agent_ids.length > 0) parts.push(Prisma.sql`o.agent_id IN (${Prisma.join(f.agent_ids)})`);
  else if (f.agent_id) parts.push(Prisma.sql`o.agent_id = ${f.agent_id}`);

  if (f.price_types && f.price_types.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users au
        WHERE au.id = o.agent_id
          AND au.tenant_id = ${tenantId}
          AND COALESCE(au.price_type, '') IN (${Prisma.join(f.price_types)})
      )`
    );
  } else if (f.price_type) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users au
        WHERE au.id = o.agent_id
          AND au.tenant_id = ${tenantId}
          AND COALESCE(au.price_type, '') = ${f.price_type}
      )`
    );
  }

  if (f.client_categories && f.client_categories.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${Prisma.join(f.client_categories)})`);
  } else if (f.client_category) {
    parts.push(Prisma.sql`COALESCE(c.category, '') = ${f.client_category}`);
  }

  if (f.client_activity === "active") parts.push(Prisma.sql`c.is_active = true`);
  if (f.client_activity === "inactive") parts.push(Prisma.sql`c.is_active = false`);
  if (f.day_visit_iso && f.day_visit_iso.length > 0) {
    parts.push(Prisma.sql`c.visit_date IS NOT NULL AND EXTRACT(ISODOW FROM c.visit_date) IN (${Prisma.join(f.day_visit_iso)})`);
  }

  if (f.territory_1_list && f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${Prisma.join(f.territory_1_list)})`);
  } else if (f.territory_1) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') = ${f.territory_1}`);
  }
  if (f.territory_2_list && f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${Prisma.join(f.territory_2_list)})`);
  } else if (f.territory_2) {
    parts.push(Prisma.sql`COALESCE(c.region, '') = ${f.territory_2}`);
  }
  if (f.territory_3_list && f.territory_3_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${Prisma.join(f.territory_3_list)})`);
  } else if (f.territory_3) {
    parts.push(Prisma.sql`COALESCE(c.city, '') = ${f.territory_3}`);
  }

  const search = f.search?.trim();
  if (search) {
    const pat = `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const idTry = Number.parseInt(search, 10);
    parts.push(
      Number.isFinite(idTry)
        ? Prisma.sql`(c.name ILIKE ${pat} OR COALESCE(c.phone, '') ILIKE ${pat} OR c.id = ${idTry})`
        : Prisma.sql`(c.name ILIKE ${pat} OR COALESCE(c.phone, '') ILIKE ${pat})`
    );
  }

  if (f.consignment_mode === "consignment") {
    parts.push(
      Prisma.sql`(
        o.is_consignment = true OR EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = o.agent_id
            AND au.tenant_id = ${tenantId}
            AND au.consignment = true
        )
      )`
    );
  } else if (f.consignment_mode === "regular") {
    parts.push(
      Prisma.sql`(
        o.is_consignment = false AND NOT EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = o.agent_id
            AND au.tenant_id = ${tenantId}
            AND au.consignment = true
        )
      )`
    );
  }

  if (actor?.userId && (actor.role === "agent" || actor.role === "supervisor" || actor.role === "manager" || actor.role === "regional_manager")) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`o.agent_id`, actor));
  }

  return Prisma.join(parts, " AND ");
}

export function buildClientScopeSql(tenantId: number, f: ClientSales2Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`c.tenant_id = ${tenantId}`];
  if (f.client_categories && f.client_categories.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${Prisma.join(f.client_categories)})`);
  } else if (f.client_category) {
    parts.push(Prisma.sql`COALESCE(c.category, '') = ${f.client_category}`);
  }
  if (f.client_activity === "active") parts.push(Prisma.sql`c.is_active = true`);
  if (f.client_activity === "inactive") parts.push(Prisma.sql`c.is_active = false`);
  if (f.day_visit_iso && f.day_visit_iso.length > 0) {
    parts.push(Prisma.sql`c.visit_date IS NOT NULL AND EXTRACT(ISODOW FROM c.visit_date) IN (${Prisma.join(f.day_visit_iso)})`);
  }
  if (f.territory_1_list && f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${Prisma.join(f.territory_1_list)})`);
  } else if (f.territory_1) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') = ${f.territory_1}`);
  }
  if (f.territory_2_list && f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${Prisma.join(f.territory_2_list)})`);
  } else if (f.territory_2) {
    parts.push(Prisma.sql`COALESCE(c.region, '') = ${f.territory_2}`);
  }
  if (f.territory_3_list && f.territory_3_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${Prisma.join(f.territory_3_list)})`);
  } else if (f.territory_3) {
    parts.push(Prisma.sql`COALESCE(c.city, '') = ${f.territory_3}`);
  }

  if (f.agent_ids && f.agent_ids.length > 0) parts.push(Prisma.sql`c.agent_id IN (${Prisma.join(f.agent_ids)})`);
  else if (f.agent_id) parts.push(Prisma.sql`c.agent_id = ${f.agent_id}`);

  if (f.price_types && f.price_types.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users au
        WHERE au.id = c.agent_id
          AND au.tenant_id = ${tenantId}
          AND COALESCE(au.price_type, '') IN (${Prisma.join(f.price_types)})
      )`
    );
  } else if (f.price_type) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users au
        WHERE au.id = c.agent_id
          AND au.tenant_id = ${tenantId}
          AND COALESCE(au.price_type, '') = ${f.price_type}
      )`
    );
  }

  if (actor?.userId && (actor.role === "agent" || actor.role === "supervisor" || actor.role === "manager" || actor.role === "regional_manager")) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`c.agent_id`, actor));
  }

  return Prisma.join(parts, " AND ");
}

