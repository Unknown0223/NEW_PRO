import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildClientWhere,
  buildOrderCreatedLocalDateClause,
  loadTenantPaymentRefs,
  sqlIntIdToNumber,
  type ClientBalanceListQuery
} from "../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
const PAYMENT_NOT_PENDING = Prisma.sql`COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'`;

import type { OrderDebtsListQuery } from "./order-debts.types";

function parseOptPositiveInt(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseCommaInts(raw: string | undefined): number[] {
  if (raw == null || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** URL query → `OrderDebtsListQuery` (client-balances bilan mos parametrlar). */
export function parseOrderDebtsListQuery(q: Record<string, string | undefined>): OrderDebtsListQuery {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const allowLarge = q.large_export === "1" || q.large_export === "true";
  const maxL = allowLarge ? 5000 : 200;
  const limit = Math.min(maxL, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));

  const oc = q.order_consignment?.trim();
  const order_consignment: OrderDebtsListQuery["order_consignment"] =
    oc === "consignment" ? "consignment" : oc === "regular" ? "regular" : "all";

  return {
    view: "clients",
    page,
    limit,
    allow_large_export: allowLarge,
    ...(q.search?.trim() ? { search: q.search.trim() } : {}),
    ...(parseOptPositiveInt(q.agent_id) !== undefined ? { agent_id: parseOptPositiveInt(q.agent_id) } : {}),
    ...(parseOptPositiveInt(q.expeditor_user_id) !== undefined
      ? { expeditor_user_id: parseOptPositiveInt(q.expeditor_user_id) }
      : {}),
    ...(parseOptPositiveInt(q.supervisor_user_id) !== undefined
      ? { supervisor_user_id: parseOptPositiveInt(q.supervisor_user_id) }
      : {}),
    ...(q.trade_direction?.trim() ? { trade_direction: q.trade_direction.trim() } : {}),
    ...(q.category?.trim() ? { category: q.category.trim() } : {}),
    ...(q.status?.trim() ? { status: q.status.trim() } : {}),
    ...(q.agent_consignment?.trim() ? { agent_consignment: q.agent_consignment.trim() } : {}),
    ...(q.territory_region?.trim() ? { territory_region: q.territory_region.trim() } : {}),
    ...(q.territory_city?.trim() ? { territory_city: q.territory_city.trim() } : {}),
    ...(q.territory_district?.trim() ? { territory_district: q.territory_district.trim() } : {}),
    ...(q.territory_zone?.trim() ? { territory_zone: q.territory_zone.trim() } : {}),
    ...(q.agent_branch?.trim() ? { agent_branch: q.agent_branch.trim() } : {}),
    ...(q.agent_payment_type?.trim() ? { agent_payment_type: q.agent_payment_type.trim() } : {}),
    ...(q.branch_ids?.trim()
      ? {
          agent_branches: q.branch_ids
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        }
      : {}),
    ...(q.order_date_from?.trim() ? { order_date_from: q.order_date_from.trim() } : {}),
    ...(q.order_date_to?.trim() ? { order_date_to: q.order_date_to.trim() } : {}),
    ...(q.sort_by?.trim() ? { sort_by: q.sort_by.trim() } : {}),
    ...(q.sort_dir === "desc" ? { sort_dir: "desc" as const } : q.sort_dir === "asc" ? { sort_dir: "asc" as const } : {}),
    warehouse_ids: parseCommaInts(q.warehouse_ids),
    explicit_client_ids: parseCommaInts(q.client_ids),
    ...(q.shipment_date_from?.trim() ? { shipment_date_from: q.shipment_date_from.trim() } : {}),
    ...(q.shipment_date_to?.trim() ? { shipment_date_to: q.shipment_date_to.trim() } : {}),
    ...(q.order_consignment_due_from?.trim()
      ? { order_consignment_due_from: q.order_consignment_due_from.trim() }
      : {}),
    ...(q.order_consignment_due_to?.trim()
      ? { order_consignment_due_to: q.order_consignment_due_to.trim() }
      : {}),
    ...(q.order_payment_ref?.trim() ? { order_payment_ref: q.order_payment_ref.trim() } : {}),
    order_consignment
  };
}
