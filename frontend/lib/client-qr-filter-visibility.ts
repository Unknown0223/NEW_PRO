/** QR kodlar sahifasi — filtr maydonlari va bloklar ko‘rinishi (brauzerda saqlanadi). */

export type ClientQrFilterVisibility = {
  date_type: boolean;
  period: boolean;
  list_mode: boolean;
  status: boolean;
  attached: boolean;
  zone: boolean;
  region: boolean;
  city: boolean;
};

export const CLIENT_QR_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100] as const;
export type ClientQrPageSize = (typeof CLIENT_QR_PAGE_SIZE_OPTIONS)[number];

export type ClientQrPageView = {
  showStats: boolean;
  showFilterCard: boolean;
  pageSize: ClientQrPageSize;
};

export const DEFAULT_CLIENT_QR_FILTER_VISIBILITY: ClientQrFilterVisibility = {
  date_type: true,
  period: true,
  list_mode: true,
  status: true,
  attached: true,
  zone: true,
  region: true,
  city: true
};

export const DEFAULT_CLIENT_QR_PAGE_VIEW: ClientQrPageView = {
  showStats: true,
  showFilterCard: true,
  pageSize: 10
};

const FILTER_LS_KEY = "salesdoc.client-qr.filters-visibility-v1";
const PAGE_LS_KEY = "salesdoc.client-qr.page-view-v1";

export const CLIENT_QR_FILTER_VISIBILITY_META: {
  key: keyof ClientQrFilterVisibility;
  label: string;
}[] = [
  { key: "date_type", label: "Тип даты" },
  { key: "period", label: "Период" },
  { key: "list_mode", label: "Список (QR / без QR)" },
  { key: "status", label: "Статус" },
  { key: "attached", label: "Клиент (привязка)" },
  { key: "zone", label: "Зона" },
  { key: "region", label: "Область" },
  { key: "city", label: "Город" }
];

function normalizeFilter(raw: unknown): ClientQrFilterVisibility {
  const d = DEFAULT_CLIENT_QR_FILTER_VISIBILITY;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const b = (k: keyof ClientQrFilterVisibility) => (typeof o[k] === "boolean" ? o[k] : d[k]);
  return {
    date_type: b("date_type"),
    period: b("period"),
    list_mode: b("list_mode"),
    status: b("status"),
    attached: b("attached"),
    zone: b("zone"),
    region: b("region"),
    city: b("city")
  };
}

function normalizePageSize(v: unknown): ClientQrPageSize {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (CLIENT_QR_PAGE_SIZE_OPTIONS.includes(n as ClientQrPageSize)) return n as ClientQrPageSize;
  return DEFAULT_CLIENT_QR_PAGE_VIEW.pageSize;
}

function normalizePageView(raw: unknown): ClientQrPageView {
  const d = DEFAULT_CLIENT_QR_PAGE_VIEW;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    showStats: typeof o.showStats === "boolean" ? o.showStats : d.showStats,
    showFilterCard: typeof o.showFilterCard === "boolean" ? o.showFilterCard : d.showFilterCard,
    pageSize: normalizePageSize(o.pageSize)
  };
}

export function loadClientQrFilterVisibility(): ClientQrFilterVisibility {
  if (typeof window === "undefined") return DEFAULT_CLIENT_QR_FILTER_VISIBILITY;
  try {
    const s = window.localStorage.getItem(FILTER_LS_KEY);
    if (!s) return DEFAULT_CLIENT_QR_FILTER_VISIBILITY;
    return normalizeFilter(JSON.parse(s) as unknown);
  } catch {
    return DEFAULT_CLIENT_QR_FILTER_VISIBILITY;
  }
}

export function saveClientQrFilterVisibility(v: ClientQrFilterVisibility): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTER_LS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function loadClientQrPageView(): ClientQrPageView {
  if (typeof window === "undefined") return DEFAULT_CLIENT_QR_PAGE_VIEW;
  try {
    const s = window.localStorage.getItem(PAGE_LS_KEY);
    if (!s) return DEFAULT_CLIENT_QR_PAGE_VIEW;
    return normalizePageView(JSON.parse(s) as unknown);
  } catch {
    return DEFAULT_CLIENT_QR_PAGE_VIEW;
  }
}

export function saveClientQrPageView(v: ClientQrPageView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_LS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
