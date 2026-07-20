import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import type { ProductSalesReportFilters } from "./product-sales.types";
import { parseDate, parseDateEnd, sqlInStrings, strList } from "./product-sales.helpers";
import { buildScopedAgentExistsSql, type ScopedReportActor } from "../access/access-agent-scope";

export function productFilterSql(f: ProductSalesReportFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.product_ids && f.product_ids.length > 0) {
    parts.push(Prisma.sql`p.id IN (${Prisma.join(f.product_ids)})`);
  }
  if (f.category_ids && f.category_ids.length > 0) {
    parts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.product_group_ids && f.product_group_ids.length > 0) {
    parts.push(Prisma.sql`p.product_group_id IN (${Prisma.join(f.product_group_ids)})`);
  }
  if (f.segment_ids && f.segment_ids.length > 0) {
    parts.push(Prisma.sql`p.segment_id IN (${Prisma.join(f.segment_ids)})`);
  }
  if (f.brand_ids && f.brand_ids.length > 0) {
    parts.push(Prisma.sql`p.brand_id IN (${Prisma.join(f.brand_ids)})`);
  }
  if (f.active_only) {
    parts.push(Prisma.sql`p.is_active = true`);
  }
  if (parts.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, " AND ")}`;
}

export function buildOrderWhereSql(
  tenantId: number,
  f: ProductSalesReportFilters,
  actor?: ReportActor | ScopedReportActor
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`];

  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dateExpr =
    f.date_type === "delivered_date"
      ? Prisma.sql`sl.delivered_at`
      : f.date_type === "shipped_date"
        ? Prisma.sql`sl.shipped_at`
        : Prisma.sql`o.created_at`;
  if (from) parts.push(Prisma.sql`${dateExpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dateExpr} <= ${to}`);

  if (f.statuses && f.statuses.length > 0) {
    parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  } else {
    parts.push(Prisma.sql`o.status <> 'cancelled'`);
  }

  if (f.order_types && f.order_types.length > 0) {
    parts.push(Prisma.sql`o.order_type IN (${sqlInStrings(f.order_types)})`);
  } else {
    parts.push(Prisma.sql`o.order_type = 'order'`);
  }

  if (f.agent_ids && f.agent_ids.length > 0) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }

  if (f.supervisor_ids && f.supervisor_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users su
        WHERE su.id = COALESCE(o.agent_id, c.agent_id)
          AND su.tenant_id = ${tenantId}
          AND su.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})
      )`
    );
  }

  if (f.price_types && f.price_types.length > 0) {
    parts.push(
      Prisma.sql`(
        COALESCE(u.price_type,'') IN (${sqlInStrings(f.price_types)})
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(u.price_type, ''), ',') AS pt(v)
          WHERE btrim(pt.v) IN (${sqlInStrings(f.price_types)})
        )
      )`
    );
  }

  if (f.payment_methods && f.payment_methods.length > 0) {
    parts.push(
      Prisma.sql`(
        COALESCE(o.payment_method_ref,'') IN (${sqlInStrings(f.payment_methods)})
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(o.payment_method_ref, ''), ',') AS pm(v)
          WHERE btrim(pm.v) IN (${sqlInStrings(f.payment_methods)})
        )
      )`
    );
  }

  if (f.warehouse_id != null && Number.isFinite(f.warehouse_id)) {
    parts.push(Prisma.sql`o.warehouse_id = ${f.warehouse_id}`);
  }

  if (f.paid_orders_only) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM client_payments pay
        WHERE pay.order_id = o.id
          AND pay.tenant_id = ${tenantId}
          AND pay.deleted_at IS NULL
          AND pay.entry_kind = 'payment'
          AND pay.workflow_status = 'confirmed'
          AND pay.amount > 0
      )`
    );
  }

  if (f.territory_1_list && f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list && f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list && f.territory_3_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }

  if (f.trade_direction_ids && f.trade_direction_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users au
        WHERE au.id = COALESCE(o.agent_id, c.agent_id)
          AND au.tenant_id = ${tenantId}
          AND au.trade_direction_id IN (${Prisma.join(f.trade_direction_ids)})
      )`
    );
  }

  if (f.consignment === "yes") {
    parts.push(
      Prisma.sql`(
        o.is_consignment = true OR EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = COALESCE(o.agent_id, c.agent_id)
            AND au.tenant_id = ${tenantId}
            AND au.consignment = true
        )
      )`
    );
  } else if (f.consignment === "no") {
    parts.push(
      Prisma.sql`(
        o.is_consignment = false AND NOT EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = COALESCE(o.agent_id, c.agent_id)
            AND au.tenant_id = ${tenantId}
            AND au.consignment = true
        )
      )`
    );
  }

  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    const idTry = Number.parseInt(search, 10);
    if (Number.isFinite(idTry) && String(idTry) === search) {
      parts.push(
        Prisma.sql`(
          p.name ILIKE ${pat}
          OR p.sku ILIKE ${pat}
          OR COALESCE(p.sell_code, '') ILIKE ${pat}
          OR p.id = ${idTry}
        )`
      );
    } else {
      parts.push(
        Prisma.sql`(
          p.name ILIKE ${pat}
          OR p.sku ILIKE ${pat}
          OR COALESCE(p.sell_code, '') ILIKE ${pat}
        )`
      );
    }
  }

  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }

  return Prisma.join(parts, " AND ");
}

export function sortOrderSql(sortBy: ProductSalesReportFilters["sort_by"]): Prisma.Sql {
  if (sortBy === "total") return Prisma.sql`total_revenue DESC NULLS LAST, product_name ASC, product_id`;
  if (sortBy === "qty") return Prisma.sql`qty DESC NULLS LAST, product_name ASC, product_id`;
  return Prisma.sql`product_name ASC, product_id`;
}
