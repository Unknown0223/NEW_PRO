import type {
  ReturnEligibleWindow,
  ReturnFilterMeta,
  ReturnFilterMode
} from "./returns-filter.types";

export type ReturnFilterStats = {
  client_balance: string | null;
  ledger_balance: string | null;
  unpaid_delivered_total: string | null;
  ledger_net_balance: string | null;
  delivered_in_period: number | null;
  delivered_after_filter: number;
};

export function returnFilterModeFromSettings(window: ReturnEligibleWindow): ReturnFilterMode {
  const { period_enabled, balance_zero_enabled } = window.settings;
  if (period_enabled && balance_zero_enabled) return "period_and_balance_zero";
  if (period_enabled) return "period_only";
  if (balance_zero_enabled) return "balance_zero_only";
  return "none";
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** Filtr qadamlari — API va UI log uchun. */
export function buildReturnFilterLog(
  window: ReturnEligibleWindow,
  stats: ReturnFilterStats
): string[] {
  const { settings } = window;
  const mode = returnFilterModeFromSettings(window);
  const unitLabel = settings.period_unit === "month" ? "мес." : "дн.";
  const log: string[] = [];

  log.push(`Режим: ${modeLabel(mode)}`);
  if (stats.client_balance != null) {
    log.push(`Видимый баланс (Финансы): ${stats.client_balance}`);
  }
  if (stats.ledger_net_balance != null) {
    log.push(`Итог по леджеру (заказы + оплаты): ${stats.ledger_net_balance}`);
  }
  if (stats.unpaid_delivered_total != null && stats.unpaid_delivered_total !== "0") {
    log.push(`Доставленные неоплаченные заказы: ${stats.unpaid_delivered_total}`);
  }
  if (stats.ledger_balance != null) {
    log.push(`Журнал л/с (только оплаты/расходы): ${stats.ledger_balance}`);
  }

  if (settings.period_enabled) {
    log.push(
      `Период: последние ${settings.period_value} ${unitLabel} (с ${formatIsoDate(window.period_from?.toISOString() ?? null)})`
    );
    if (stats.delivered_in_period != null) {
      log.push(`Доставлено заказов за период: ${stats.delivered_in_period}`);
    }
  } else {
    log.push("Фильтр по периоду: выключен");
  }

  if (settings.balance_zero_enabled) {
    if (window.balance_zero_at) {
      log.push(
        `Найдена точка нулевого баланса (леджер заказов и оплат): ${formatIsoDate(window.balance_zero_at.toISOString())}`
      );
    } else if (mode === "period_and_balance_zero") {
      log.push("Баланс 0: в выбранном периоде не найден");
    } else {
      log.push("Баланс 0: не найден ни разу — без ограничений (режим «только баланс 0»)");
    }
  } else {
    log.push("Фильтр «Баланс 0»: выключен");
  }

  if (window.empty) {
    log.push("Результат: заказы не показываются (оба условия одновременно не выполнены)");
  } else if (window.min_order_created_at) {
    log.push(`Дата заказов ≥ ${formatIsoDate(window.min_order_created_at.toISOString())}`);
    log.push(`Доставленных заказов после фильтра: ${stats.delivered_after_filter}`);
  } else {
    log.push(`Доставленных заказов после фильтра: ${stats.delivered_after_filter}`);
  }

  return log;
}

function modeLabel(mode: ReturnFilterMode): string {
  switch (mode) {
    case "period_only":
      return "только период";
    case "balance_zero_only":
      return "только баланс 0";
    case "period_and_balance_zero":
      return "период + баланс 0";
    default:
      return "без фильтра";
  }
}

export function buildReturnFilterExplanation(
  window: ReturnEligibleWindow,
  stats: ReturnFilterStats
): string {
  const mode = returnFilterModeFromSettings(window);
  const { settings } = window;
  const unitLabel = settings.period_unit === "month" ? "мес." : "дн.";

  if (mode === "period_only") {
    return `Доставленные заказы за последние ${settings.period_value} ${unitLabel} (${stats.delivered_after_filter} шт.). Баланс 0 не учитывается.`;
  }

  if (mode === "balance_zero_only") {
    if (window.balance_zero_at) {
      return `Заказы после последнего нулевого баланса (${formatIsoDate(window.balance_zero_at.toISOString())}) (${stats.delivered_after_filter} шт.).`;
    }
    return `Баланс 0 не найден ни разу — все доставленные заказы (${stats.delivered_after_filter} шт.).`;
  }

  if (mode === "period_and_balance_zero") {
    if (window.empty) {
      const inPeriod = stats.delivered_in_period ?? 0;
      return `За последние ${settings.period_value} ${unitLabel} не найдена точка полного закрытия (баланс 0) — есть только заказы с долгом. Доставленных заказов за период: ${inPeriod}. Внесите полную оплату или отключите фильтр «Баланс 0».`;
    }
    return `Заказы после нулевого баланса (${formatIsoDate(window.balance_zero_at?.toISOString() ?? null)}) за последние ${settings.period_value} ${unitLabel} (${stats.delivered_after_filter} шт.).`;
  }

  return `Фильтр выключен — все доставленные заказы (${stats.delivered_after_filter} шт.). Используйте с осторожностью.`;
}

export function returnFilterMetaEnriched(
  window: ReturnEligibleWindow,
  stats: ReturnFilterStats
): ReturnFilterMeta {
  const base = {
    period_from: window.period_from?.toISOString() ?? null,
    balance_zero_at: window.balance_zero_at?.toISOString() ?? null,
    empty_reason: window.empty_reason ?? null,
    period_enabled: window.settings.period_enabled,
    balance_zero_enabled: window.settings.balance_zero_enabled
  };
  const log = buildReturnFilterLog(window, stats);
  return {
    ...base,
    filter_mode: returnFilterModeFromSettings(window),
    client_balance: stats.client_balance,
    ledger_balance: stats.ledger_balance,
    unpaid_delivered_total: stats.unpaid_delivered_total,
    ledger_net_balance: stats.ledger_net_balance,
    delivered_in_period: stats.delivered_in_period,
    delivered_after_filter: stats.delivered_after_filter,
    min_order_created_at: window.min_order_created_at?.toISOString() ?? null,
    explanation: buildReturnFilterExplanation(window, stats),
    log
  };
}
