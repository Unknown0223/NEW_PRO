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
  const unitLabel = settings.period_unit === "month" ? "oy" : "kun";
  const log: string[] = [];

  log.push(`Rejim: ${modeLabel(mode)}`);
  if (stats.client_balance != null) {
    log.push(`Ko‘rinadigan balans (Финансы): ${stats.client_balance}`);
  }
  if (stats.ledger_net_balance != null) {
    log.push(`Ledger yig‘indisi (zakaz+to‘lov): ${stats.ledger_net_balance}`);
  }
  if (stats.unpaid_delivered_total != null && stats.unpaid_delivered_total !== "0") {
    log.push(`Yetkazilgan, to‘lanmagan zakazlar: ${stats.unpaid_delivered_total}`);
  }
  if (stats.ledger_balance != null) {
    log.push(`L/s jurnal (faqat to‘lov/rasxod): ${stats.ledger_balance}`);
  }

  if (settings.period_enabled) {
    log.push(
      `Davr: oxirgi ${settings.period_value} ${unitLabel} (${formatIsoDate(window.period_from?.toISOString() ?? null)} dan)`
    );
    if (stats.delivered_in_period != null) {
      log.push(`Davr ichida yetkazilgan zakazlar: ${stats.delivered_in_period}`);
    }
  } else {
    log.push("Davr filtri: o‘chiq");
  }

  if (settings.balance_zero_enabled) {
    if (window.balance_zero_at) {
      log.push(
        `Balans 0 nuqtasi topildi (zakaz+to‘lov ledger): ${formatIsoDate(window.balance_zero_at.toISOString())}`
      );
    } else if (mode === "period_and_balance_zero") {
      log.push("Balans 0: tanlangan davr ichida topilmadi");
    } else {
      log.push("Balans 0: hech qachon topilmadi — cheklovsiz (faqat balans 0 rejimi)");
    }
  } else {
    log.push("Balans 0 filtri: o‘chiq");
  }

  if (window.empty) {
    log.push("Natija: zakazlar ko‘rsatilmaydi (ikkala cheklov birga bajarilmadi)");
  } else if (window.min_order_created_at) {
    log.push(`Zakazlar sanasi ≥ ${formatIsoDate(window.min_order_created_at.toISOString())}`);
    log.push(`Filtrdan o‘tgan yetkazilgan zakazlar: ${stats.delivered_after_filter}`);
  } else {
    log.push(`Filtrdan o‘tgan yetkazilgan zakazlar: ${stats.delivered_after_filter}`);
  }

  return log;
}

function modeLabel(mode: ReturnFilterMode): string {
  switch (mode) {
    case "period_only":
      return "faqat davr";
    case "balance_zero_only":
      return "faqat balans 0";
    case "period_and_balance_zero":
      return "davr + balans 0";
    default:
      return "filtr yo‘q";
  }
}

export function buildReturnFilterExplanation(
  window: ReturnEligibleWindow,
  stats: ReturnFilterStats
): string {
  const mode = returnFilterModeFromSettings(window);
  const { settings } = window;
  const unitLabel = settings.period_unit === "month" ? "oy" : "kun";

  if (mode === "period_only") {
    return `Oxirgi ${settings.period_value} ${unitLabel} ichidagi yetkazilgan zakazlar (${stats.delivered_after_filter} ta). Balans 0 hisobga olinmaydi.`;
  }

  if (mode === "balance_zero_only") {
    if (window.balance_zero_at) {
      return `Oxirgi balans 0 (${formatIsoDate(window.balance_zero_at.toISOString())}) dan keyingi zakazlar (${stats.delivered_after_filter} ta).`;
    }
    return `Balans 0 hech qachon topilmadi — barcha yetkazilgan zakazlar (${stats.delivered_after_filter} ta).`;
  }

  if (mode === "period_and_balance_zero") {
    if (window.empty) {
      const inPeriod = stats.delivered_in_period ?? 0;
      return `Oxirgi ${settings.period_value} ${unitLabel} ichida to‘liq yopilgan (balans 0) nuqta topilmadi — faqat qarzli zakazlar bor. Davrda ${inPeriod} ta yetkazilgan zakaz mavjud. To‘liq to‘lov qiling yoki Balans 0 filtrini o‘chiring.`;
    }
    return `Oxirgi ${settings.period_value} ${unitLabel} ichidagi balans 0 (${formatIsoDate(window.balance_zero_at?.toISOString() ?? null)}) dan keyingi zakazlar (${stats.delivered_after_filter} ta).`;
  }

  return `Filtr o‘chiq — barcha yetkazilgan zakazlar (${stats.delivered_after_filter} ta). Ehtiyotkorlik bilan ishlating.`;
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
