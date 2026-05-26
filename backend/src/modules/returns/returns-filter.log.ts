import { logger } from "../../config/logger";
import type { ReturnFilterMeta } from "./returns-filter.types";

const returnFilterLog = logger.child({ module: "return_filter" });

export function logReturnFilterDecision(
  tenantId: number,
  clientId: number,
  meta: ReturnFilterMeta,
  context = "order-balances"
): void {
  returnFilterLog.info(
    {
      tenant_id: tenantId,
      client_id: clientId,
      context,
      filter_mode: meta.filter_mode,
      period_enabled: meta.period_enabled,
      balance_zero_enabled: meta.balance_zero_enabled,
      empty_reason: meta.empty_reason,
      period_from: meta.period_from,
      balance_zero_at: meta.balance_zero_at,
      min_order_created_at: meta.min_order_created_at,
      client_balance: meta.client_balance,
      delivered_in_period: meta.delivered_in_period,
      delivered_after_filter: meta.delivered_after_filter,
      log: meta.log
    },
    meta.explanation ?? "return filter resolved"
  );
}
