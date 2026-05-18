import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

import type { ClientBalanceListQuery } from "./client-balances.types";
import { parseIsoDateEndUtc, parseIsoDateStartUtc } from "./client-balances.date";

export function buildClientWhere(
  tenantId: number,
  q: ClientBalanceListQuery,
  opts?: { skipBalanceFilter?: boolean; skipTerritoryFilters?: boolean }
): Prisma.ClientWhereInput {
  const andParts: Prisma.ClientWhereInput[] = [
    { tenant_id: tenantId },
    { merged_into_client_id: null }
  ];

  const st = q.status?.trim();
  if (st === "active") andParts.push({ is_active: true });
  else if (st === "inactive") {
    andParts.push({ is_active: false });
    andParts.push({
      OR: [
        { client_balances: { some: { balance: { lt: 0 } } } },
        { client_balances: { some: { balance: { gt: 0 } } } }
      ]
    });
  }

  if (q.agent_id != null && q.agent_id > 0) {
    andParts.push({ agent_id: q.agent_id });
  }

  if (q.expeditor_user_id != null && q.expeditor_user_id > 0) {
    const ex = q.expeditor_user_id;
    andParts.push({
      OR: [
        { orders: { some: { expeditor_user_id: ex } } },
        { payments: { some: { expeditor_user_id: ex } } }
      ]
    });
  }

  if (q.supervisor_user_id != null && q.supervisor_user_id > 0) {
    andParts.push({ agent: { supervisor_user_id: q.supervisor_user_id } });
  }

  const td = q.trade_direction?.trim();
  if (td) {
    andParts.push({
      agent: {
        OR: [
          { trade_direction: { contains: td, mode: "insensitive" } },
          { trade_direction_row: { name: { contains: td, mode: "insensitive" } } }
        ]
      }
    });
  }

  const cat = q.category?.trim();
  if (cat) {
    andParts.push({ category: { contains: cat, mode: "insensitive" } });
  }

  const ac = q.agent_consignment?.trim();
  if (ac === "consignment") andParts.push({ agent: { consignment: true } });
  else if (ac === "regular") andParts.push({ agent: { consignment: false } });

  const brs = q.agent_branches?.filter((b) => b.trim() !== "") ?? [];
  if (brs.length > 0) {
    andParts.push({ agent: { branch: { in: brs } } });
  } else {
    const br = q.agent_branch?.trim();
    if (br) {
      andParts.push({ agent: { branch: br } });
    }
  }

  const cFrom = q.consignment_due_from?.trim() ? parseIsoDateStartUtc(q.consignment_due_from) : null;
  const cTo = q.consignment_due_to?.trim() ? parseIsoDateEndUtc(q.consignment_due_to) : null;
  if (cFrom && cTo) {
    andParts.push({ license_until: { gte: cFrom, lte: cTo } });
  } else if (cFrom) {
    andParts.push({ license_until: { gte: cFrom } });
  } else if (cTo) {
    andParts.push({ license_until: { lte: cTo } });
  }

  if (!opts?.skipTerritoryFilters) {
    if (q.territory_region?.trim()) {
      andParts.push({ region: { contains: q.territory_region.trim(), mode: "insensitive" } });
    }
    if (q.territory_city?.trim()) {
      andParts.push({ city: { contains: q.territory_city.trim(), mode: "insensitive" } });
    }
    if (q.territory_district?.trim()) {
      andParts.push({ district: { contains: q.territory_district.trim(), mode: "insensitive" } });
    }
    if (q.territory_zone?.trim()) {
      andParts.push({ zone: { contains: q.territory_zone.trim(), mode: "insensitive" } });
    }
  }

  const pt = q.agent_payment_type?.trim();
  if (pt) {
    andParts.push({
      payments: { some: { entry_kind: "payment", payment_type: pt } }
    });
  }

  if (!opts?.skipBalanceFilter) {
    const bf = q.balance_filter?.trim();
    if (bf === "debt") {
      andParts.push({ client_balances: { some: { balance: { lt: 0 } } } });
    } else if (bf === "credit") {
      andParts.push({ client_balances: { some: { balance: { gt: 0 } } } });
    }
  }

  const s = q.search?.trim();
  if (s) {
    andParts.push({
      OR: [
        { name: { contains: s, mode: "insensitive" } },
        { phone: { contains: s, mode: "insensitive" } },
        { client_code: { contains: s, mode: "insensitive" } },
        { inn: { contains: s, mode: "insensitive" } }
      ]
    });
  }

  return { AND: andParts };
}
