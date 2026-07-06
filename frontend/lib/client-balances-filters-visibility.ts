/** Balanslar sahifasi — qaysi filtr maydonlari ko‘rinadi (brauzerda saqlanadi) */

export type ClientBalancesFilterVisibility = {
  balance_date: boolean;
  license_from: boolean;
  license_to: boolean;
  agent_branch: boolean;
  supervisor_user_id: boolean;
  agent_id: boolean;
  expeditor_user_id: boolean;
  category: boolean;
  trade_direction: boolean;
  status: boolean;
  balance_filter: boolean;
  agent_payment_type: boolean;
  territory_zone: boolean;
  territory_region: boolean;
  territory_city: boolean;
};

export const DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY: ClientBalancesFilterVisibility = {
  balance_date: true,
  license_from: true,
  license_to: true,
  agent_branch: true,
  supervisor_user_id: true,
  agent_id: true,
  expeditor_user_id: true,
  category: true,
  trade_direction: true,
  status: true,
  balance_filter: true,
  agent_payment_type: true,
  territory_zone: true,
  territory_region: true,
  territory_city: true
};

export const CLIENT_BALANCES_FILTER_VISIBILITY_META: {
  key: keyof ClientBalancesFilterVisibility;
  label: string;
}[] = [
  { key: "balance_date", label: "Баланс на дату" },
  { key: "license_from", label: "Дата срок консигнация · Срок от" },
  { key: "license_to", label: "Дата срок консигнация · Срок до" },
  { key: "agent_branch", label: "Филиалы" },
  { key: "supervisor_user_id", label: "Супервайзер" },
  { key: "agent_id", label: "Агент" },
  { key: "expeditor_user_id", label: "Экспедитор" },
  { key: "category", label: "Категория" },
  { key: "trade_direction", label: "Направление торговли" },
  { key: "status", label: "Статус" },
  { key: "balance_filter", label: "Общий баланс" },
  { key: "agent_payment_type", label: "Тип оплаты" },
  { key: "territory_zone", label: "Зона" },
  { key: "territory_region", label: "Область" },
  { key: "territory_city", label: "Город" }
];

const LS_KEY = "salesdoc.client-balances-filters-visibility-v1";

function normalize(raw: unknown): ClientBalancesFilterVisibility {
  const d = DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const b = (k: keyof ClientBalancesFilterVisibility) =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : d[k];
  return {
    balance_date: b("balance_date"),
    license_from: b("license_from"),
    license_to: b("license_to"),
    agent_branch: b("agent_branch"),
    supervisor_user_id: b("supervisor_user_id"),
    agent_id: b("agent_id"),
    expeditor_user_id: b("expeditor_user_id"),
    category: b("category"),
    trade_direction: b("trade_direction"),
    status: b("status"),
    balance_filter: b("balance_filter"),
    agent_payment_type: b("agent_payment_type"),
    territory_zone: b("territory_zone"),
    territory_region: b("territory_region"),
    territory_city: b("territory_city")
  };
}

export function loadClientBalancesFilterVisibility(): ClientBalancesFilterVisibility {
  if (typeof window === "undefined") return DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY;
  try {
    const s = window.localStorage.getItem(LS_KEY);
    if (!s) return DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY;
    return normalize(JSON.parse(s) as unknown);
  } catch {
    return DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY;
  }
}

export function saveClientBalancesFilterVisibility(v: ClientBalancesFilterVisibility): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
