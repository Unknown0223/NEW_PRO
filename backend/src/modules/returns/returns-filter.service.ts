import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { findLatestBalanceZeroAt } from "./returns-filter.balance-zero";
import { loadReturnFilterSettings } from "./returns-filter.settings";
import type {
  ReturnEligibleWindow,
  ReturnFilterMeta,
  ReturnFilterSettings
} from "./returns-filter.types";

export function subtractReturnPeriod(now: Date, value: number, unit: "day" | "month"): Date {
  const d = new Date(now.getTime());
  if (unit === "month") {
    d.setMonth(d.getMonth() - value);
    return d;
  }
  d.setDate(d.getDate() - value);
  return d;
}

function orderMinCreatedAt(periodFrom: Date | null, balanceZeroAt: Date | null): Date | undefined {
  if (periodFrom && balanceZeroAt) {
    const afterZero = new Date(balanceZeroAt.getTime() + 1);
    return periodFrom.getTime() > afterZero.getTime() ? periodFrom : afterZero;
  }
  if (periodFrom) return periodFrom;
  if (balanceZeroAt) return new Date(balanceZeroAt.getTime() + 1);
  return undefined;
}

export function resolveReturnEligibleWindowSync(
  settings: ReturnFilterSettings,
  balanceZeroAt: Date | null,
  now: Date = new Date()
): ReturnEligibleWindow {
  const periodFrom = settings.period_enabled
    ? subtractReturnPeriod(now, settings.period_value, settings.period_unit)
    : null;

  const base: ReturnEligibleWindow = {
    empty: false,
    max_order_created_at: now,
    period_from: periodFrom,
    balance_zero_at: balanceZeroAt,
    settings
  };

  if (settings.period_enabled && settings.balance_zero_enabled) {
    if (!balanceZeroAt) {
      return {
        ...base,
        empty: true,
        empty_reason: "balance_zero_not_in_period"
      };
    }
    return {
      ...base,
      min_order_created_at: orderMinCreatedAt(periodFrom, balanceZeroAt)
    };
  }

  if (settings.period_enabled && !settings.balance_zero_enabled) {
    return {
      ...base,
      min_order_created_at: periodFrom ?? undefined
    };
  }

  if (!settings.period_enabled && settings.balance_zero_enabled) {
    if (!balanceZeroAt) {
      return base;
    }
    return {
      ...base,
      min_order_created_at: orderMinCreatedAt(null, balanceZeroAt)
    };
  }

  return base;
}

export async function resolveReturnEligibleWindow(
  tenantId: number,
  clientId: number,
  now: Date = new Date()
): Promise<ReturnEligibleWindow> {
  const settings = await loadReturnFilterSettings(tenantId);
  const periodFrom = settings.period_enabled
    ? subtractReturnPeriod(now, settings.period_value, settings.period_unit)
    : null;

  let balanceZeroAt: Date | null = null;
  if (settings.balance_zero_enabled) {
    const searchFrom = settings.period_enabled ? periodFrom : null;
    balanceZeroAt = await findLatestBalanceZeroAt(tenantId, clientId, searchFrom, now);
  }

  return resolveReturnEligibleWindowSync(settings, balanceZeroAt, now);
}

export function buildOrderCreatedAtFilter(
  window: ReturnEligibleWindow
): Prisma.DateTimeFilter | undefined {
  if (window.empty) {
    return { gte: new Date(8_640_000_000_000_000) };
  }
  const filter: Prisma.DateTimeFilter = { lte: window.max_order_created_at };
  if (window.min_order_created_at) {
    filter.gte = window.min_order_created_at;
  }
  return filter;
}

export function mergeOptionalDateRange(
  tenantWindow: ReturnEligibleWindow,
  dateFrom?: string,
  dateTo?: string,
  localDayStart: (iso: string) => Date = (iso) => new Date(iso),
  localDayEnd: (iso: string) => Date = (iso) => new Date(iso)
): Prisma.DateTimeFilter | undefined {
  if (tenantWindow.empty) {
    return buildOrderCreatedAtFilter(tenantWindow);
  }

  let min = tenantWindow.min_order_created_at;
  let max = tenantWindow.max_order_created_at;

  if (dateFrom) {
    const uiFrom = localDayStart(dateFrom);
    min = min && min.getTime() > uiFrom.getTime() ? min : uiFrom;
  }
  if (dateTo) {
    const uiTo = localDayEnd(dateTo);
    max = max.getTime() < uiTo.getTime() ? max : uiTo;
  }

  if (min && max && min.getTime() > max.getTime()) {
    return { gte: new Date(8_640_000_000_000_000) };
  }

  const filter: Prisma.DateTimeFilter = {};
  if (min) filter.gte = min;
  if (max) filter.lte = max;
  return filter;
}

export function returnFilterMetaFromWindow(window: ReturnEligibleWindow): ReturnFilterMeta {
  return {
    period_from: window.period_from?.toISOString() ?? null,
    balance_zero_at: window.balance_zero_at?.toISOString() ?? null,
    empty_reason: window.empty_reason ?? null,
    period_enabled: window.settings.period_enabled,
    balance_zero_enabled: window.settings.balance_zero_enabled
  };
}

export async function assertOrdersInReturnFilter(
  tenantId: number,
  clientId: number,
  orderIds: number[]
): Promise<void> {
  if (orderIds.length === 0) return;
  const window = await resolveReturnEligibleWindow(tenantId, clientId);
  if (window.empty) throw new Error("RETURN_FILTER_EMPTY");

  const createdFilter = buildOrderCreatedAtFilter(window);
  const allowed = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      id: { in: orderIds },
      ...(createdFilter ? { created_at: createdFilter } : {})
    },
    select: { id: true }
  });
  if (allowed.length !== orderIds.length) throw new Error("RETURN_ORDER_OUT_OF_FILTER");
}
