export type VisitStatus = "ordered" | "visited" | "rejected" | "missed";
export type VisitModule = "client" | "warehouse" | "cash" | "fuel" | "start";

export interface VisitPhoto {
  id: number;
  caption: string | null;
  created_at: string;
  image_url?: string;
  content_purged: boolean;
}

export interface VisitPoint {
  id: string;
  index: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  planned: number;
  arrived: number | null;
  duration: number;
  expectedDuration: number;
  status: VisitStatus;
  orderSum: number;
  orderAmount?: number;
  orderComment?: string | null;
  orderReason?: string | null;
  refusalReason?: string | null;
  refusalComment?: string | null;
  visitNotes?: string | null;
  sku: number;
  distance: number;
  distanceToClient?: number | null;
  wasAtPoint?: boolean;
  placeType: string;
  accuracy: number;
  internet: "4G" | "3G" | "WiFi" | "—";
  batteryAt: number | null;
  module: VisitModule;
  cashExpected: number;
  cashCollected: number;
  payMethod: "Naqd" | "Terminal" | "Perechislenie";
  delivered: boolean;
  paid: boolean;
  photoUrl?: string;
  photoTaken: boolean;
  photoTime?: string;
  photos?: VisitPhoto[];
  customerEvidence: boolean;
  clientId?: number | null;
}

export const PAY_METHOD_LABEL: Record<string, string> = {
  Naqd: "Наличные",
  Terminal: "Терминал",
  Perechislenie: "Перечисление",
};

export function payMethodLabel(v: string | null | undefined): string {
  if (!v) return "";
  return PAY_METHOD_LABEL[v] ?? v;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  territory: string;
  segment: string;
  type: "agent" | "delivery" | "supervisor" | "inkasator" | "vansell";
  supervisorId: string | null;
  battery: number | null;
  network?: "4G" | "3G" | "WiFi" | "—" | null;
  online: boolean;
  lastSeen: string;
  region?: string;
  /** Tanlangan kunda faoliyat (GPS/zakaz/vizit/foto) */
  activeOnDate?: boolean;
}

export interface SupervisorOption {
  id: string;
  label: string;
}

export interface TradingPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  hour: number;
}

export interface OverviewCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  label: string;
}

export interface OverviewAgent {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  type: Employee["type"];
  online: boolean;
}

export interface AgentRoute {
  employee: Employee;
  points: VisitPoint[];
}

export const ROLE_META: Record<
  Employee["type"],
  { label: string; short: string; color: string; desc: string }
> = {
  agent: { label: "Агенты", short: "АГТ", color: "#0f9e8e", desc: "Визиты и заказы" },
  delivery: { label: "Доставщики", short: "ДОС", color: "#3b9fe9", desc: "Доставка" },
  supervisor: { label: "Супервайзеры", short: "СВР", color: "#7c5cff", desc: "Контроль территории" },
  inkasator: { label: "Инкассаторы", short: "ИНК", color: "#d69e27", desc: "Сбор наличных и торговой выручки" },
  vansell: { label: "Ван-селлинг", short: "ВС", color: "#e0567a", desc: "Заказ + доставка + оплата (с машины)" }
};

export const STATUS_META: Record<VisitStatus, { label: string; color: string }> = {
  ordered: { label: "Заказ", color: "#16a34a" },
  visited: { label: "Посещен", color: "#0f9e8e" },
  rejected: { label: "Отказ", color: "#e11d48" },
  missed: { label: "Пропущен", color: "#94a3b8" }
};

export const MONTHS_RU = [
  "Янв.",
  "Фев.",
  "Мар.",
  "Апр.",
  "Май",
  "Июн.",
  "Июл.",
  "Авг.",
  "Сен.",
  "Окт.",
  "Ноя.",
  "Дек."
];
export const WEEKDAYS_RU = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

export const fmtKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1).replace(".", ",")} км`;

/** To‘liq so‘m format: 300 000 сум */
export const fmtSomAmount = (n: number) => {
  const abs = Math.round(Math.abs(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${formatted} сум`;
};

/** Zakaz summasi: to‘liq so‘m; fallback legacy mln */
export const fmtOrderValue = (p: { orderAmount?: number; orderSum: number }) => {
  if (p.orderAmount != null && p.orderAmount > 0) return fmtSomAmount(p.orderAmount);
  if (p.orderSum > 0) return `${p.orderSum.toFixed(1).replace(".", ",")} млн сум`;
  return null;
};

export const fmtHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const fmtDateLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;

export const fmtDateShort = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function regionOf(e: Employee): string {
  if (e.region) return e.region;
  const t = e.territory.toUpperCase();
  if (
    /(TOSHKENT|YUNUSOBOD|CHILANZOR|MIRABOD|YASHNOBOD|SERGELI|CHIRCHIQ|O'RTA|BO'KA|PISKENT|TO'YTEPA|QIBRAY|OLMALIQ|ANGREN|YANGIYO|ТАШКЕНТ)/.test(
      t
    )
  ) {
    return "Ташкент";
  }
  if (/(FARG'ONA|FERGANA|QO'QON|VODIYSI|ФЕРГАН)/.test(t)) return "Фергана";
  if (/ANDIJON|АНДИЖАН/.test(t)) return "Андижан";
  if (/NAMANGAN|НАМАНГАН/.test(t)) return "Наманган";
  if (/SAMARQAND|САМАРКАНД/.test(t)) return "Самарканд";
  if (/BUXORO|БУХАРА/.test(t)) return "Бухара";
  if (/NAVOIY|НАВОИ/.test(t)) return "Навои";
  if (/NUKUS|НУКУС/.test(t)) return "Нукус";
  return "Другое";
}
