import type { OrderListRow } from "@/components/orders/order-detail-view";
import axios from "axios";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { ORDER_STATUS_VALUES } from "@/lib/order-status";
import { ORDER_TYPE_VALUES } from "@/lib/order-types";

export const VALID_STATUSES = new Set<string>(ORDER_STATUS_VALUES);
export const VALID_ORDER_TYPES = new Set<string>(ORDER_TYPE_VALUES);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export type OrdersDateMode = "created" | "order" | "ship";
const VALID_DATE_MODES = new Set<OrdersDateMode>(["created", "order", "ship"]);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Joriy kun (bugun) — URLda sana bo‘lmasa, ro‘yxat va «Найдено» standart shu
 * kun bo‘yicha ko‘rsatiladi. Boshqa kunlar/oralik faqat filtr tanlab «Применить»
 * bosilganda ochiladi.
 */
export function defaultOrdersDayRange(): { date_from: string; date_to: string } {
  const today = localYmd(new Date());
  return { date_from: today, date_to: today };
}

/** URLda `date_from` + `date_to` bo‘lsa — ro‘yxat so‘rovi ruxsat etiladi */
export function ordersListQueryReady(f: OrdersUrlFilters): boolean {
  return Boolean(f.date_from?.trim() && f.date_to?.trim());
}

export function withDefaultOrdersDateRange(f: OrdersUrlFilters): OrdersUrlFilters {
  if (f.date_from && f.date_to) return f;
  const defaults = defaultOrdersDayRange();
  return {
    ...f,
    date_from: f.date_from || defaults.date_from,
    date_to: f.date_to || defaults.date_to
  };
}

export type OrdersUrlFilters = {
  status: string;
  order_type: string;
  page: number;
  search: string;
  warehouse_id: string;
  agent_id: string;
  expeditor_id: string;
  date_from: string;
  date_to: string;
  client_id: string;
  product_id: string;
  client_category: string;
  client_region: string;
  client_city: string;
  client_zone: string;
  trade_direction: string;
  date_mode: OrdersDateMode;
  /** URL: true | false | "" */
  is_consignment: "" | "true" | "false";
  product_category_id: string;
  payment_type: string;
  payment_method_ref: string;
  /** Тип накладной (profile request_type_entries) */
  request_type_ref: string;
  /** 1–7 (Пн–Вс), bo‘sh = barcha */
  visit_weekday: string;
  /** Jadval «Тип цены» → API `price_type` */
  price_type: string;
  /** Skidka muammosi: not_applied | cash_desk_missing | bonus_required | any */
  discount_alert: string;
  bonus_alert: string;
  order_alert: string;
};

export type OrdersFilterVisibility = {
  status: boolean;
  orderType: boolean;
  nakladnoyType: boolean;
  paymentMethod: boolean;
  paymentLinkedType: boolean;
  priceType: boolean;
  day: boolean;
  clientCategory: boolean;
  productCategory: boolean;
  product: boolean;
  warehouse: boolean;
  agent: boolean;
  expeditor: boolean;
  consignment: boolean;
  tradeDirection: boolean;
  territory1: boolean;
  territory2: boolean;
  territory3: boolean;
  discountAlert: boolean;
  bonusAlert: boolean;
  orderAlert: boolean;
};

export const ORDERS_FILTER_VISIBILITY_STORAGE_KEY = "salesdoc.orders.filter-visibility.v1";

export const DEFAULT_ORDERS_FILTER_VISIBILITY: OrdersFilterVisibility = {
  status: true,
  orderType: true,
  nakladnoyType: true,
  paymentMethod: true,
  paymentLinkedType: true,
  priceType: true,
  day: true,
  clientCategory: true,
  productCategory: true,
  product: true,
  warehouse: true,
  agent: true,
  expeditor: true,
  consignment: true,
  tradeDirection: true,
  territory1: true,
  territory2: true,
  territory3: true,
  discountAlert: true,
  bonusAlert: true,
  orderAlert: true
};

/** Modalda bo‘limlar bo‘yicha tartib */
export const FILTER_VISIBILITY_GROUPS: Array<{
  title: string;
  keys: (keyof OrdersFilterVisibility)[];
}> = [
  {
    title: "Заказ",
    keys: [
      "status",
      "orderType",
      "nakladnoyType",
      "paymentMethod",
      "paymentLinkedType",
      "priceType",
      "day",
      "consignment",
      "discountAlert",
      "bonusAlert",
      "orderAlert"
    ]
  },
  {
    title: "Клиент и территория",
    keys: ["clientCategory", "tradeDirection", "territory1", "territory2", "territory3"]
  },
  { title: "Товары и склад", keys: ["productCategory", "product", "warehouse"] },
  { title: "Персонал", keys: ["agent", "expeditor"] }
];

const FILTER_VISIBILITY_LABELS: Record<keyof OrdersFilterVisibility, string> = {
  status: "Статус",
  orderType: "Тип",
  nakladnoyType: "Тип накладной",
  paymentMethod: "Способ оплаты (заказ)",
  paymentLinkedType: "Тип платежа (по заказу)",
  priceType: "Тип цены",
  day: "День",
  clientCategory: "Категория клиента",
  productCategory: "Категория продукта",
  product: "Продукт",
  warehouse: "Склад",
  agent: "Агент",
  expeditor: "Экспедиторы",
  consignment: "Консигнация",
  tradeDirection: "Направление торговли",
  territory1: "Зона",
  territory2: "Область",
  territory3: "Город",
  discountAlert: "Проблемы со скидкой",
  bonusAlert: "Проблемы с бонусом",
  orderAlert: "Проблемные заявки"
};

export const FILTER_VISIBILITY_ITEMS: Array<{ key: keyof OrdersFilterVisibility; label: string }> =
  (Object.keys(FILTER_VISIBILITY_LABELS) as (keyof OrdersFilterVisibility)[]).map((key) => ({
    key,
    label: FILTER_VISIBILITY_LABELS[key]
  }));

export function parseOrdersUrl(searchParams: URLSearchParams): OrdersUrlFilters {
  const rawStatus = searchParams.get("status")?.trim() ?? "";
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "";
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const wh = searchParams.get("warehouse_id")?.trim() ?? "";
  const warehouse_id = /^\d+$/.test(wh) ? wh : "";
  const ag = searchParams.get("agent_id")?.trim() ?? "";
  const agent_id = /^\d+$/.test(ag) ? ag : "";
  const ex = searchParams.get("expeditor_id")?.trim() ?? "";
  const expeditor_id = /^\d+$/.test(ex) ? ex : "";
  const df = searchParams.get("date_from")?.trim() ?? "";
  const date_from = ISO_DATE_RE.test(df) ? df : "";
  const dt = searchParams.get("date_to")?.trim() ?? "";
  const date_to = ISO_DATE_RE.test(dt) ? dt : "";
  const cr = searchParams.get("client_id")?.trim() ?? "";
  const client_id = /^\d+$/.test(cr) ? cr : "";
  const pr = searchParams.get("product_id")?.trim() ?? "";
  const product_id = /^\d+$/.test(pr) ? pr : "";
  const client_category = (searchParams.get("client_category")?.trim() ?? "").slice(0, 128);
  const rawOrderType = searchParams.get("order_type")?.trim() ?? "";
  const order_type = VALID_ORDER_TYPES.has(rawOrderType) ? rawOrderType : "";
  const rawDm = (searchParams.get("date_mode")?.trim().toLowerCase() ?? "") as OrdersDateMode;
  const date_mode: OrdersDateMode = VALID_DATE_MODES.has(rawDm) ? rawDm : "order";
  const icRaw = searchParams.get("is_consignment")?.trim().toLowerCase() ?? "";
  const is_consignment: "" | "true" | "false" =
    icRaw === "true" || icRaw === "1" || icRaw === "yes"
      ? "true"
      : icRaw === "false" || icRaw === "0" || icRaw === "no"
        ? "false"
        : "";
  const pc = searchParams.get("product_category_id")?.trim() ?? "";
  const product_category_id = /^\d+$/.test(pc) ? pc : "";
  const payment_type = (searchParams.get("payment_type")?.trim() ?? "").slice(0, 64);
  const payment_method_ref = (searchParams.get("payment_method_ref")?.trim() ?? "").slice(0, 64);
  const request_type_ref = (searchParams.get("request_type_ref")?.trim() ?? "").slice(0, 128);
  const search = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim().slice(0, 200);
  const client_region = (searchParams.get("client_region")?.trim() ?? "").slice(0, 128);
  const client_city = (searchParams.get("client_city")?.trim() ?? "").slice(0, 128);
  const client_zone = (searchParams.get("client_zone")?.trim() ?? "").slice(0, 128);
  const trade_direction = (searchParams.get("trade_direction")?.trim() ?? "").slice(0, 128);
  const rawWd = searchParams.get("visit_weekday")?.trim() ?? "";
  const visit_weekday = /^[1-7]$/.test(rawWd) ? rawWd : "";
  const price_type = (searchParams.get("price_type")?.trim() ?? "").slice(0, 64);
  const discount_alert = (searchParams.get("discount_alert")?.trim() ?? "").slice(0, 32);
  const bonus_alert = (searchParams.get("bonus_alert")?.trim() ?? "").slice(0, 32);
  const order_alert = (searchParams.get("order_alert")?.trim() ?? "").slice(0, 32);
  return {
    status,
    order_type,
    page,
    search,
    warehouse_id,
    agent_id,
    expeditor_id,
    date_from,
    date_to,
    client_id,
    product_id,
    client_category,
    client_region,
    client_city,
    client_zone,
    trade_direction,
    date_mode,
    is_consignment,
    product_category_id,
    payment_type,
    payment_method_ref,
    request_type_ref,
    visit_weekday,
    price_type,
    discount_alert,
    bonus_alert,
    order_alert
  };
}

export type OrdersResponse = {
  data: OrderListRow[];
  total: number;
  page: number;
  limit: number;
};

export type BulkOrderStatusResponse = {
  updated: number[];
  failed: { id: number; error: string; from?: string; to?: string }[];
};

export type BulkExpeditorResponse = {
  updated: number[];
  failed: { id: number; error: string }[];
};

export type BulkConsignmentResponse = BulkExpeditorResponse;

/** Bulk «Консигнация» — faqat «Новый» / «Подтверждён» va `order_type === order`. */
export function isBulkConsignmentEligible(
  order: Pick<OrderListRow, "status" | "order_type">
): boolean {
  const ot = (order.order_type ?? "order").trim();
  return (order.status === "new" || order.status === "confirmed") && ot === "order";
}

function consignmentBulkErrorLabel(code: string): string {
  switch (code) {
    case "ORDER_NOT_EDITABLE":
      return "статус не «Новый»/«Подтверждён»";
    case "BAD_ORDER_TYPE":
      return "не тип «Заказ»";
    case "NOT_FOUND":
      return "не найден";
    default:
      return code;
  }
}

export function formatConsignmentBulkFeedback(
  res: BulkConsignmentResponse & { skipped_ineligible?: number }
): string {
  const skipped = res.skipped_ineligible ?? 0;
  const failCount = res.failed.length;
  if (failCount === 0) {
    let msg = `Консигнация: ${res.updated.length} заказ(ов) обновлено.`;
    if (skipped > 0) {
      msg += ` Пропущено ${skipped} — недоступно для текущего статуса.`;
    }
    return msg;
  }
  const byError = new Map<string, number>();
  for (const f of res.failed) {
    byError.set(f.error, (byError.get(f.error) ?? 0) + 1);
  }
  const parts = [...byError.entries()].map(
    ([code, cnt]) => `${cnt} × ${consignmentBulkErrorLabel(code)}`
  );
  return `Консигнация: ${res.updated.length} OK, ${failCount} ошибок (${parts.join("; ")}).`;
}

export function parseNumField(s: string): number {
  const n = Number.parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function buildPaymentPrefillFromSelection(
  list: OrderListRow[],
  ids: Set<number>
): { href: string; note: string | null } {
  const sel = list.filter((r) => ids.has(r.id));
  if (sel.length === 0) {
    return { href: "/payments/new", note: null };
  }
  const clientSet = new Set(sel.map((r) => r.client_id));
  if (clientSet.size > 1) {
    return {
      href: "/payments/new",
      note: "Tanlov turli mijozlar — kassada mijozni qo‘lda tanlang."
    };
  }
  const clientId = sel[0]!.client_id;
  const sum = sel.reduce((acc, r) => acc + parseNumField(r.total_sum), 0);
  const p = new URLSearchParams();
  p.set("client_id", String(clientId));
  p.set("order_ids", sel.map((r) => String(r.id)).join(","));
  if (sum > 0) {
    p.set("amount", sum.toFixed(2));
  }
  return {
    href: `/payments/new?${p.toString()}`,
    note:
      sel.length > 1
        ? `${sel.length} ta zakaz — «Приход в кассу» jadvalida naqd ustuniga taqsimlangan.`
        : null
  };
}

export function rowStatusPatchError(err: unknown): string {
  if (!axios.isAxiosError(err)) return getUserFacingError(err, "Holatni yangilab bo‘lmadi.");
  const code = (err.response?.data as { error?: string } | undefined)?.error;
  if (code === "InvalidTransition") return "Недопустимый переход статуса.";
  if (code === "ForbiddenRevert") return "Oldingi bosqichga qaytarish faqat admin uchun.";
  if (code === "ForbiddenReopenCancelled") return "Bekor qilingan zakazni qayta ochish faqat admin uchun.";
  if (code === "ForbiddenOperatorCancelLate") return "Bu bosqichda bekor qilish taqiqlangan.";
  if (code === "ApprovalPending") return "Tasdiqlash zanjirini kuting — joriy tasdiqlovchi tasdiqlashi kerak.";
  if (code === "ApprovalRejected") return "Tasdiqlash rad etilgan — qayta sozlash kerak.";
  if (code === "NotFound") return "Zakaz topilmadi.";
  const flat = getZodFlattenFromApiErrorBody(err.response?.data);
  const hint = flat ? firstValidationUserHint(flat) : undefined;
  if (hint) return withApiSupportLine(hint, err);
  return getUserFacingError(err, "Holatni yangilab bo‘lmadi.");
}

export function ordersMutationFeedback(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const flat = getZodFlattenFromApiErrorBody(err.response?.data);
    const hint = flat ? firstValidationUserHint(flat) : undefined;
    if (hint) return withApiSupportLine(hint, err);
  }
  return getUserFacingError(err, fallback);
}

export function buildOrdersSearchParams(next: OrdersUrlFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (next.status) p.set("status", next.status);
  if (next.order_type) p.set("order_type", next.order_type);
  if (next.search) p.set("q", next.search);
  if (next.page > 1) p.set("page", String(next.page));
  if (next.warehouse_id) p.set("warehouse_id", next.warehouse_id);
  if (next.agent_id) p.set("agent_id", next.agent_id);
  if (next.expeditor_id) p.set("expeditor_id", next.expeditor_id);
  if (next.date_from) p.set("date_from", next.date_from);
  if (next.date_to) p.set("date_to", next.date_to);
  if (next.client_id) p.set("client_id", next.client_id);
  if (next.product_id) p.set("product_id", next.product_id);
  if (next.client_category) p.set("client_category", next.client_category);
  if (next.client_region) p.set("client_region", next.client_region);
  if (next.client_city) p.set("client_city", next.client_city);
  if (next.client_zone) p.set("client_zone", next.client_zone);
  if (next.trade_direction) p.set("trade_direction", next.trade_direction);
  if (next.date_mode && next.date_mode !== "order") p.set("date_mode", next.date_mode);
  if (next.is_consignment === "true") p.set("is_consignment", "true");
  if (next.is_consignment === "false") p.set("is_consignment", "false");
  if (next.product_category_id) p.set("product_category_id", next.product_category_id);
  if (next.payment_type) p.set("payment_type", next.payment_type);
  if (next.payment_method_ref) p.set("payment_method_ref", next.payment_method_ref);
  if (next.request_type_ref) p.set("request_type_ref", next.request_type_ref);
  if (next.visit_weekday) p.set("visit_weekday", next.visit_weekday);
  if (next.price_type) p.set("price_type", next.price_type);
  if (next.discount_alert) p.set("discount_alert", next.discount_alert);
  if (next.bonus_alert) p.set("bonus_alert", next.bonus_alert);
  if (next.order_alert) p.set("order_alert", next.order_alert);
  return p;
}

export function isOrdersFiltersEmpty(f: OrdersUrlFilters): boolean {
  const scoped = withDefaultOrdersDateRange(f);
  const dayDefaults = defaultOrdersDayRange();
  const hasDefaultDayOnly =
    scoped.date_from === dayDefaults.date_from && scoped.date_to === dayDefaults.date_to;
  return (
    !f.search &&
    !f.warehouse_id &&
    !f.agent_id &&
    !f.expeditor_id &&
    hasDefaultDayOnly &&
    !f.product_id &&
    !f.client_category &&
    !f.client_region &&
    !f.client_city &&
    !f.client_zone &&
    !f.trade_direction &&
    !f.client_id &&
    !f.order_type &&
    !f.status &&
    f.is_consignment === "" &&
    !f.product_category_id &&
    !f.payment_type &&
    !f.payment_method_ref &&
    !f.request_type_ref &&
    !f.visit_weekday &&
    !f.price_type &&
    !f.discount_alert &&
    !f.bonus_alert &&
    !f.order_alert &&
    f.date_mode === "order"
  );
}
