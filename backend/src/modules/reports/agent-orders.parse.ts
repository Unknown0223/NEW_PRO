import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";

import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";
import { intList, strList } from "./agent-orders.helpers";

export function parseAgentOrdersQuery(q: Record<string, string | undefined>): AgentOrdersFilters {
  const intOr = (v?: string) => {
    if (!v) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    date_type:
      q.date_type === "shipped_date" || q.date_type === "delivered_date" ? q.date_type : "order_date",
    from: q.from,
    to: q.to,
    category_id: intOr(q.category_id),
    category_ids: intList(q.category_ids),
    product_id: intOr(q.product_id),
    product_ids: intList(q.product_ids),
    trade_direction: q.trade_direction?.trim() || undefined,
    trade_directions: strList(q.trade_directions),
    status: q.status?.trim() || undefined,
    statuses: strList(q.statuses),
    agent_id: intOr(q.agent_id),
    agent_ids: intList(q.agent_ids),
    client_category: q.client_category?.trim() || undefined,
    client_categories: strList(q.client_categories),
    price_type: q.price_type?.trim() || undefined,
    price_types: strList(q.price_types),
    payment_method: q.payment_method?.trim() || undefined,
    payment_methods: strList(q.payment_methods),
    order_type: q.order_type?.trim() || undefined,
    order_types: strList(q.order_types),
    product_group_id: intOr(q.product_group_id),
    product_group_ids: intList(q.product_group_ids),
    segment_id: intOr(q.segment_id),
    segment_ids: intList(q.segment_ids),
    consignment: q.consignment === "yes" || q.consignment === "no" ? q.consignment : "all",
    territory_1: q.territory_1?.trim() || undefined,
    territory_1_list: strList(q.territory_1_list),
    territory_2: q.territory_2?.trim() || undefined,
    territory_2_list: strList(q.territory_2_list),
    territory_3: q.territory_3?.trim() || undefined,
    territory_3_list: strList(q.territory_3_list)
  };
}

