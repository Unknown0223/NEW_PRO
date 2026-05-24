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

export type OrdersUrlFilters = {
  status: string;
  order_type: string;
  page: number;
  warehouse_id: string;
  agent_id: string;
  expeditor_id: string;
  date_from: string;
  date_to: string;
  client_id: string;
  product_id: string;
  client_category: string;
  date_mode: OrdersDateMode;
  /** URL: true | false | "" */
  is_consignment: "" | "true" | "false";
  product_category_id: string;
  payment_type: string;
  payment_method_ref: string;
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
  clientId: boolean;
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
  clientId: true,
  productCategory: true,
  product: true,
  warehouse: true,
  agent: true,
  expeditor: true,
  consignment: true,
  tradeDirection: true,
  territory1: true,
  territory2: true,
  territory3: true
};

export const FILTER_VISIBILITY_ITEMS: Array<{ key: keyof OrdersFilterVisibility; label: string }> = [
  { key: "status", label: "Статус" },
  { key: "orderType", label: "Тип" },
  { key: "nakladnoyType", label: "Тип накладной" },
  { key: "paymentMethod", label: "Способ оплаты (заказ)" },
  { key: "paymentLinkedType", label: "Тип платежа (по заказу)" },
  { key: "priceType", label: "Тип цены" },
  { key: "day", label: "День" },
  { key: "clientCategory", label: "Категория клиента" },
  { key: "clientId", label: "Клиенты (ID)" },
  { key: "productCategory", label: "Категория продукта" },
  { key: "product", label: "Продукт" },
  { key: "warehouse", label: "Склад" },
  { key: "agent", label: "Агент" },
  { key: "expeditor", label: "Экспедиторы" },
  { key: "consignment", label: "Консигнация" },
  { key: "tradeDirection", label: "Направление торговли" },
  { key: "territory1", label: "Территория 1" },
  { key: "territory2", label: "Территория 2" },
  { key: "territory3", label: "Территория 3" }
];

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
  const date_mode: OrdersDateMode = VALID_DATE_MODES.has(rawDm) ? rawDm : "ship";
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
  return {
    status,
    order_type,
    page,
    warehouse_id,
    agent_id,
    expeditor_id,
    date_from,
    date_to,
    client_id,
    product_id,
    client_category,
    date_mode,
    is_consignment,
    product_category_id,
    payment_type,
    payment_method_ref
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
  if (sel.length === 1) {
    p.set("order_id", String(sel[0]!.id));
  }
  if (sum > 0) {
    p.set("amount", sum.toFixed(2));
  }
  return {
    href: `/payments/new?${p.toString()}`,
    note: sel.length > 1 ? `${sel.length} ta zakaz yig‘indisi (summa maydonga qo‘yilgan).` : null
  };
}

export function rowStatusPatchError(err: unknown): string {
  if (!axios.isAxiosError(err)) return getUserFacingError(err, "Holatni yangilab bo‘lmadi.");
  const code = (err.response?.data as { error?: string } | undefined)?.error;
  if (code === "InvalidTransition") return "Bu holatga o‘tish mumkin emas.";
  if (code === "ForbiddenRevert") return "Oldingi bosqichga qaytarish faqat admin uchun.";
  if (code === "ForbiddenReopenCancelled") return "Bekor qilingan zakazni qayta ochish faqat admin uchun.";
  if (code === "ForbiddenOperatorCancelLate") return "Bu bosqichda bekor qilish taqiqlangan.";
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
  if (next.page > 1) p.set("page", String(next.page));
  if (next.warehouse_id) p.set("warehouse_id", next.warehouse_id);
  if (next.agent_id) p.set("agent_id", next.agent_id);
  if (next.expeditor_id) p.set("expeditor_id", next.expeditor_id);
  if (next.date_from) p.set("date_from", next.date_from);
  if (next.date_to) p.set("date_to", next.date_to);
  if (next.client_id) p.set("client_id", next.client_id);
  if (next.product_id) p.set("product_id", next.product_id);
  if (next.client_category) p.set("client_category", next.client_category);
  if (next.date_mode !== "ship") p.set("date_mode", next.date_mode);
  if (next.is_consignment === "true") p.set("is_consignment", "true");
  if (next.is_consignment === "false") p.set("is_consignment", "false");
  if (next.product_category_id) p.set("product_category_id", next.product_category_id);
  if (next.payment_type) p.set("payment_type", next.payment_type);
  if (next.payment_method_ref) p.set("payment_method_ref", next.payment_method_ref);
  return p;
}

export function isOrdersFiltersEmpty(f: OrdersUrlFilters): boolean {
  return (
    !f.warehouse_id &&
    !f.agent_id &&
    !f.expeditor_id &&
    !f.date_from &&
    !f.date_to &&
    !f.product_id &&
    !f.client_category &&
    !f.client_id &&
    !f.order_type &&
    !f.status &&
    f.is_consignment === "" &&
    !f.product_category_id &&
    !f.payment_type &&
    !f.payment_method_ref &&
    f.date_mode === "ship"
  );
}
