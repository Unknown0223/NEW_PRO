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
  if (f.brand_ids && f.brand_ids.length > 0) parts.push(Prisma.sql`p.brand_id IN (${Prisma.join(f.brand_ids)})`);
  if (parts.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, " AND ")}`;
}

export function buildOrderWhereSql(tenantId: number, f: ClientSales2Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`];

  const from = parseDate(f.from);
  const to = parseDate(f.to);
  if (to) to.setUTCHours(23, 59, 59, 999);
  // SalesDoc DATE_LOAD: otgruzka; lokalda delivering log bo‘lmasa delivered_at fallback.
  const dateExpr =
    f.date_type === "delivered_date"
      ? Prisma.sql`sl.delivered_at`
      : f.date_type === "shipped_date"
        ? Prisma.sql`COALESCE(sl.shipped_at, sl.delivered_at)`
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

  if (f.agent_ids && f.agent_ids.length > 0) parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  else if (f.agent_id) parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) = ${f.agent_id}`);
  if (f.supervisor_ids && f.supervisor_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users ag
        WHERE ag.id = COALESCE(o.agent_id, c.agent_id)
          AND ag.tenant_id = ${tenantId}
          AND ag.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})
      )`
    );
  }

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
    parts.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM client_agent_assignments caa
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(caa.visit_weekdays::jsonb, '[]'::jsonb)) AS el(val)
      CROSS JOIN LATERAL (SELECT NULLIF(el.val, '')::int AS ord) d
      WHERE caa.client_id = c.id
        AND caa.tenant_id = ${tenantId}
        AND d.ord IN (${Prisma.join(f.day_visit_iso)})
    )`);
  }

  if (f.payment_methods && f.payment_methods.length > 0) {
    parts.push(
      Prisma.sql`(
        COALESCE(o.payment_method_ref,'') IN (${Prisma.join(f.payment_methods)})
        OR EXISTS (
          SELECT 1 FROM regexp_split_to_table(COALESCE(o.payment_method_ref, ''), ',') AS pm(v)
          WHERE btrim(pm.v) IN (${Prisma.join(f.payment_methods)})
        )
      )`
    );
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

  if (actor) {
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
    parts.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM client_agent_assignments caa
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(caa.visit_weekdays::jsonb, '[]'::jsonb)) AS el(val)
      CROSS JOIN LATERAL (SELECT NULLIF(el.val, '')::int AS ord) d
      WHERE caa.client_id = c.id
        AND caa.tenant_id = ${tenantId}
        AND d.ord IN (${Prisma.join(f.day_visit_iso)})
    )`);
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
  if (f.supervisor_ids && f.supervisor_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users ag
        WHERE ag.id = c.agent_id
          AND ag.tenant_id = ${tenantId}
          AND ag.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})
      )`
    );
  }

  const clientSearch = f.search?.trim();
  if (clientSearch) {
    const pat = `%${clientSearch.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const idTry = Number.parseInt(clientSearch, 10);
    parts.push(
      Number.isFinite(idTry)
        ? Prisma.sql`(
            c.name ILIKE ${pat}
            OR COALESCE(c.phone, '') ILIKE ${pat}
            OR COALESCE(c.address, '') ILIKE ${pat}
            OR COALESCE(c.category, '') ILIKE ${pat}
            OR COALESCE(c.city, '') ILIKE ${pat}
            OR c.id = ${idTry}
          )`
        : Prisma.sql`(
            c.name ILIKE ${pat}
            OR COALESCE(c.phone, '') ILIKE ${pat}
            OR COALESCE(c.address, '') ILIKE ${pat}
            OR COALESCE(c.category, '') ILIKE ${pat}
            OR COALESCE(c.city, '') ILIKE ${pat}
          )`
    );
  }

  if (f.expeditor_ids && f.expeditor_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM client_agent_assignments caa
        WHERE caa.client_id = c.id
          AND caa.tenant_id = ${tenantId}
          AND caa.expeditor_user_id IN (${Prisma.join(f.expeditor_ids)})
      )`
    );
  }

  if (f.tag_ids && f.tag_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM client_tag_links ctl
        WHERE ctl.client_id = c.id
          AND ctl.tag_id IN (${Prisma.join(f.tag_ids)})
      )`
    );
  }

  if (f.inventory_mode === "with") {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM client_equipment ce
        WHERE ce.client_id = c.id
          AND ce.tenant_id = ${tenantId}
          AND ce.removed_at IS NULL
      )`
    );
  } else if (f.inventory_mode === "without") {
    parts.push(
      Prisma.sql`NOT EXISTS (
        SELECT 1 FROM client_equipment ce
        WHERE ce.client_id = c.id
          AND ce.tenant_id = ${tenantId}
          AND ce.removed_at IS NULL
      )`
    );
  }

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

  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`c.agent_id`, actor));
  }

  return Prisma.join(parts, " AND ");
}

