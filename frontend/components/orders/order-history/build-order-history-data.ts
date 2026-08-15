import type { OrderChangeLogRow, OrderDetailRow, OrderItemRow } from "@/components/orders/order-detail-view";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import {
  formatOrderHistoryDateShort,
  formatOrderHistoryDateTime
} from "./format-order-history-datetime";

/** Shablon «История заказа» — operator ko‘rinishidagi status matnlari */
const ORDER_HISTORY_STATUS_LABELS: Record<string, string> = {
  ...ORDER_STATUS_LABELS,
  confirmed: "Подтвержден к отгрузке"
};

function statusLabel(code: string): string {
  return ORDER_HISTORY_STATUS_LABELS[code] ?? ORDER_STATUS_LABELS[code] ?? code;
}

export type OrderHistoryVersion = {
  date: string;
  client: string;
  clientId: number | null;
  agent: string;
  expediter: string;
  shipDate: string;
  deliveryDate: string;
  consignation: string;
  consignationDeadline: string;
  priceType: string;
  quantity: string;
  volume: string;
  sum: string;
  warehouse: string;
  tradeDirection: string;
  returnDate: string;
  comment: string;
  createdBy: string;
  updatedBy: string;
  status: string;
  statusKey: string;
};

export type OrderHistoryProduct = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  volume: number;
  total: number;
};

export type OrderHistoryBonusAction =
  | "Создано"
  | "Изменено"
  | "Удалено"
  | "Не начислен";

export type OrderHistoryBonusEntry = {
  id: string;
  /** Jadvalda ko‘rinadigan sana */
  date: string;
  /** Tartiblash uchun ISO */
  sortAt: string;
  bonusName: string;
  product: string;
  quantity: number | null;
  action: OrderHistoryBonusAction;
  user: string;
};

/** API (`OrderDetailRow`) dan — bonus jadvali va umumiy holat */
export type OrderHistoryBonusSection = {
  autoBonusApplied: boolean;
  bonusQty: string;
  bonusSum: string;
  hasBonusLines: boolean;
  entries: OrderHistoryBonusEntry[];
};

function mapStatusKey(status: string): string {
  const s = status.toLowerCase();
  if (s === "new") return "NEW";
  if (s === "confirmed" || s === "picking") return "CONFIRMED";
  if (s === "delivering") return "SHIPPED";
  if (s === "delivered") return "DELIVERED";
  return s.toUpperCase();
}

function formatAgentMultiline(data: OrderDetailRow): string {
  const code = data.agent_code?.trim();
  const name = data.agent_name?.trim();
  const display = data.agent_display?.trim();
  const lines: string[] = [];
  if (display) lines.push(display);
  else if (code && name) lines.push(`${code}\n[${name}]`);
  else if (code) lines.push(code);
  else if (name) lines.push(name);
  return lines.join("\n");
}

function formatClientLabel(data: OrderDetailRow): string {
  const code = data.client_code?.trim();
  const name = data.client_name?.trim();
  if (code && name) return `${code} ${name}`;
  if (code) return code;
  return name || "—";
}

function formatCreatedBy(data: OrderDetailRow): string {
  const parts = [data.created_by, data.created_by_role].filter((x) => x?.trim());
  if (parts.length) return parts.join(" · ");
  return formatAgentMultiline(data);
}

function formatSum(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  return `${formatNumberGrouped(value, { maxFractionDigits: 0 })} сум`;
}

function emptyVersionFields(): OrderHistoryVersion {
  return {
    date: "",
    client: "",
    clientId: null,
    agent: "",
    expediter: "",
    shipDate: "",
    deliveryDate: "",
    consignation: "",
    consignationDeadline: "",
    priceType: "",
    quantity: "",
    volume: "",
    sum: "",
    warehouse: "",
    tradeDirection: "",
    returnDate: "",
    comment: "",
    createdBy: "",
    updatedBy: "",
    status: "",
    statusKey: ""
  };
}

function buildFullVersion(
  data: OrderDetailRow,
  statusCode: string,
  dateIso: string
): OrderHistoryVersion {
  const consignationDeadline =
    data.is_consignment && data.consignment_due_date
      ? formatOrderHistoryDateTime(data.consignment_due_date)
      : "";

  return {
    date: formatOrderHistoryDateTime(dateIso),
    client: formatClientLabel(data),
    clientId: data.client_id,
    agent: formatAgentMultiline(data),
    expediter: data.expeditor_display?.trim() || data.expeditors?.trim() || "",
    shipDate: data.shipped_at ? formatOrderHistoryDateTime(data.shipped_at) : "",
    deliveryDate: data.delivered_at ? formatOrderHistoryDateTime(data.delivered_at) : "",
    consignation: data.is_consignment ? "Да" : "Нет",
    consignationDeadline,
    priceType: data.payment_method_label?.trim() || data.price_type?.trim() || "",
    quantity: data.qty?.trim() ? formatNumberGrouped(data.qty, { maxFractionDigits: 3 }) : "",
    volume: data.volume_m3?.trim()
      ? formatNumberGrouped(data.volume_m3, { maxFractionDigits: 3 })
      : "0",
    sum: formatSum(data.total_sum),
    warehouse: data.warehouse_name?.trim() || "",
    tradeDirection: data.agent_trade_direction?.trim() || "",
    returnDate: data.returned_at
      ? formatOrderHistoryDateTime(data.returned_at)
      : "",
    comment: data.comment?.trim() || "",
    createdBy: formatCreatedBy(data),
    updatedBy: formatCreatedBy(data),
    status: statusLabel(statusCode),
    statusKey: mapStatusKey(statusCode)
  };
}

function buildPartialFromLog(
  log: { to_status: string; user_login: string | null; created_at: string },
  data: OrderDetailRow
): OrderHistoryVersion {
  const v = emptyVersionFields();
  v.date = formatOrderHistoryDateTime(log.created_at);
  v.status = statusLabel(log.to_status);
  v.statusKey = mapStatusKey(log.to_status);
  v.updatedBy = log.user_login?.trim() || "";

  const to = log.to_status.toLowerCase();
  if (to === "delivering") {
    v.shipDate = data.shipped_at
      ? formatOrderHistoryDateTime(data.shipped_at)
      : formatOrderHistoryDateTime(log.created_at);
  }
  if (to === "delivered") {
    v.deliveryDate = data.delivered_at
      ? formatOrderHistoryDateTime(data.delivered_at)
      : formatOrderHistoryDateTime(log.created_at);
  }
  return v;
}

function parseDecStr(s: unknown): string {
  if (s == null || s === "") return "";
  return formatSum(String(s));
}

function buildPartialFromChangeLog(
  log: OrderChangeLogRow,
  data: OrderDetailRow
): OrderHistoryVersion {
  const v = emptyVersionFields();
  v.date = formatOrderHistoryDateTime(log.created_at);
  v.updatedBy = log.user_login?.trim() || "";
  v.status = statusLabel(data.status);
  v.statusKey = mapStatusKey(data.status);

  const p =
    log.payload && typeof log.payload === "object"
      ? (log.payload as Record<string, unknown>)
      : {};

  if (log.action === "lines") {
    const ts = p.total_sum as { from?: unknown; to?: unknown } | undefined;
    if (ts?.to != null) v.sum = parseDecStr(ts.to);
    else if (ts != null && typeof ts !== "object") v.sum = parseDecStr(ts);

    const paid = p.paid_lines as { to?: unknown[] } | undefined;
    if (paid?.to) {
      v.quantity = String(paid.to.length);
    }

    const da = p.discount_alert as { to?: unknown; from?: unknown } | string | null | undefined;
    const alertTo =
      da != null && typeof da === "object" && !Array.isArray(da)
        ? (da as { to?: unknown }).to
        : da;
    const parts: string[] = ["Изменён состав / сумма"];
    if (alertTo) parts.push(`Скидка: ${String(alertTo)}`);
    v.comment = parts.join(" · ");
  } else if (log.action === "meta") {
    const bits: string[] = [];
    if (p.warehouse_id) bits.push("склад");
    if (p.agent_id) bits.push("агент");
    if (p.expeditor_user_id) bits.push("экспедитор");
    if (p.payment_method_ref) bits.push("тип оплаты");
    v.comment = bits.length ? `Изменены: ${bits.join(", ")}` : "Изменены данные заказа";
    v.warehouse = data.warehouse_name?.trim() || "";
    v.agent = formatAgentMultiline(data);
    v.expediter = data.expeditor_display?.trim() || data.expeditors?.trim() || "";
    v.priceType = data.payment_method_label?.trim() || data.price_type?.trim() || "";
  } else if (log.action.includes("consignment")) {
    v.consignation = log.action.includes("unset") ? "Нет" : "Да";
    v.comment = log.action.includes("unset") ? "Консигнация отключена" : "Консигнация включена";
  } else if (log.action === "return_reason") {
    const reason =
      typeof p.reason === "string"
        ? p.reason
        : typeof p.comment === "string"
          ? p.comment
          : "";
    v.comment = reason ? `Причина возврата: ${reason}` : "Указана причина возврата";
  } else {
    v.comment = log.action;
  }

  return v;
}

type TimelineEvent =
  | { kind: "status"; at: number; log: NonNullable<OrderDetailRow["status_logs"]>[number] }
  | { kind: "change"; at: number; log: OrderChangeLogRow };

export function buildOrderVersions(data: OrderDetailRow): OrderHistoryVersion[] {
  const statusLogs = [...(data.status_logs ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const changeLogs = [...(data.change_logs ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const events: TimelineEvent[] = [
    ...statusLogs.map((log) => ({
      kind: "status" as const,
      at: new Date(log.created_at).getTime(),
      log
    })),
    ...changeLogs.map((log) => ({
      kind: "change" as const,
      at: new Date(log.created_at).getTime(),
      log
    }))
  ].sort((a, b) => a.at - b.at);

  const initialStatus = statusLogs[0]?.from_status ?? data.status ?? "new";
  const versions: OrderHistoryVersion[] = [
    buildFullVersion(data, initialStatus, data.created_at)
  ];

  for (const ev of events) {
    if (ev.kind === "status") {
      versions.push(buildPartialFromLog(ev.log, data));
    } else {
      versions.push(buildPartialFromChangeLog(ev.log, data));
    }
  }

  // Faqat yaratish snapshoti — change/status yo‘q bo‘lsa ham 1 ustun yetarli
  return versions;
}

export function buildOrderHistoryProducts(data: OrderDetailRow): OrderHistoryProduct[] {
  return data.items
    .filter((i) => !i.is_bonus)
    .map((i) => rowToProduct(i));
}

function rowToProduct(i: OrderItemRow): OrderHistoryProduct {
  const qty = Number.parseFloat(String(i.qty).replace(",", ".")) || 0;
  const price = Number.parseFloat(String(i.price).replace(",", ".")) || 0;
  const total = Number.parseFloat(String(i.total).replace(",", ".")) || 0;
  const volume = Number.parseFloat(String(i.line_volume_m3 ?? i.volume_m3 ?? "0").replace(",", ".")) || 0;
  return {
    id: String(i.id),
    name: i.name,
    quantity: qty,
    price,
    volume,
    total
  };
}

function parseDec(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  return Number.parseFloat(String(s).replace(/\s/g, "").replace(",", ".")) || 0;
}

function ruleNameForProduct(data: OrderDetailRow, productId: number): string | null {
  for (const opt of data.bonus_gift_swap_options ?? []) {
    if (opt.chosen_product_id === productId || opt.allowed_product_ids.includes(productId)) {
      return opt.rule_name.trim() || null;
    }
  }
  return null;
}

function bonusNameForItem(data: OrderDetailRow, item: OrderItemRow): string {
  const fromRule = ruleNameForProduct(data, item.product_id);
  if (fromRule) return fromRule;
  const trigger = item.bonus_trigger_label?.trim();
  if (trigger) return trigger;
  return "Бонус";
}

function bonusActionFromSumDelta(from: number, to: number): OrderHistoryBonusAction {
  if (from <= 0 && to > 0) return "Создано";
  if (to <= 0 && from > 0) return "Удалено";
  return "Изменено";
}

function pushEntry(
  entries: OrderHistoryBonusEntry[],
  entry: Omit<OrderHistoryBonusEntry, "date"> & { sortAt: string }
) {
  entries.push({
    ...entry,
    date: formatOrderHistoryDateShort(entry.sortAt)
  });
}

function buildNoBonusInfoEntry(data: OrderDetailRow, user: string): OrderHistoryBonusEntry {
  const bonusSum = parseDec(data.bonus_sum);
  const bonusQty = parseDec(data.bonus_qty);
  const hasLines = data.items.some((i) => i.is_bonus);

  const bonusName = "Автоматический бонус";
  const action: OrderHistoryBonusAction = "Не начислен";
  let product = "—";

  if (data.apply_bonus && !hasLines && bonusSum <= 0 && bonusQty <= 0) {
    product = "Правила применены, позиции не начислены";
  } else if (!data.apply_bonus && !hasLines) {
    product = "Бонус не применялся к заказу";
  } else if (bonusSum <= 0 && bonusQty <= 0) {
    product = "Бонусные позиции отсутствуют";
  }

  return {
    id: "bonus-status-none",
    date: formatOrderHistoryDateShort(data.created_at),
    sortAt: data.created_at,
    bonusName,
    product,
    quantity: null,
    action,
    user
  };
}

export function buildBonusHistorySection(data: OrderDetailRow): OrderHistoryBonusSection {
  const entries: OrderHistoryBonusEntry[] = [];
  const defaultUser = formatCreatedBy(data);
  const hasBonusLines = data.items.some((i) => i.is_bonus);

  for (const item of data.items.filter((i) => i.is_bonus)) {
    const qty = parseDec(item.qty);
    pushEntry(entries, {
      id: `item-${item.id}`,
      sortAt: data.created_at,
      bonusName: bonusNameForItem(data, item),
      product: item.name,
      quantity: qty,
      action: "Создано",
      user: defaultUser
    });
  }

  if (!hasBonusLines) {
    for (const item of data.items.filter((i) => !i.is_bonus && i.bonus_product_name?.trim())) {
      const giftName = item.bonus_product_name!.trim();
      const qty = parseDec(item.bonus_product_qty);
      if (qty <= 0) continue;
      pushEntry(entries, {
        id: `paid-${item.id}-${giftName}`,
        sortAt: data.created_at,
        bonusName: item.bonus_trigger_label?.trim() || "Бонус",
        product: giftName,
        quantity: qty,
        action: "Создано",
        user: defaultUser
      });
    }
  }

  const lineLogs = [...(data.change_logs ?? [])]
    .filter((l) => l.action === "lines")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (const log of lineLogs) {
    const delta = extractBonusFromChangeLog(log);
    if (!delta) continue;
    pushEntry(entries, {
      id: `log-${log.id}`,
      sortAt: log.created_at,
      bonusName: delta.label,
      product: delta.product,
      quantity: delta.quantity,
      action: delta.action,
      user: log.user_login?.trim() || defaultUser
    });
  }

  entries.sort((a, b) => new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime());

  if (entries.length === 0) {
    entries.push(buildNoBonusInfoEntry(data, defaultUser));
  }

  return {
    autoBonusApplied: data.apply_bonus,
    bonusQty: data.bonus_qty?.trim()
      ? formatNumberGrouped(data.bonus_qty, { maxFractionDigits: 3 })
      : "0",
    bonusSum: data.bonus_sum?.trim()
      ? `${formatNumberGrouped(data.bonus_sum, { maxFractionDigits: 0 })} сум`
      : "0 сум",
    hasBonusLines,
    entries
  };
}

/** @deprecated — `buildBonusHistorySection` ishlating */
export function buildBonusHistory(data: OrderDetailRow): OrderHistoryBonusEntry[] {
  return buildBonusHistorySection(data).entries;
}

function extractBonusFromChangeLog(log: OrderChangeLogRow): {
  label: string;
  product: string;
  quantity: number;
  action: OrderHistoryBonusAction;
} | null {
  if (!log.payload || typeof log.payload !== "object") return null;
  const p = log.payload as Record<string, unknown>;
  const bs = p.bonus_sum as { from?: string; to?: string } | undefined;
  if (!bs) return null;
  const from = parseDec(bs.from != null ? String(bs.from) : "0");
  const to = parseDec(bs.to != null ? String(bs.to) : "0");
  if (from === to) return null;

  const action = bonusActionFromSumDelta(from, to);
  const productLabel =
    action === "Удалено"
      ? "Бонусные позиции сняты"
      : action === "Создано"
        ? "Начисление по заказу"
        : "Изменение суммы бонуса";

  return {
    label: "Изменение состава",
    product: productLabel,
    quantity: Math.abs(to - from),
    action
  };
}

export function orderHistoryAuditMeta(
  versions: OrderHistoryVersion[],
  data: OrderDetailRow
): { createdBy: string; updatedBy: string; lastChange: string } {
  const first = versions[0];
  const last = versions[versions.length - 1];

  const changeLogs = [...(data.change_logs ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const statusLogs = [...(data.status_logs ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const latestChange = changeLogs[0];
  const latestStatus = statusLogs[0];
  let latestAt = data.created_at;
  let latestUser = last?.updatedBy || last?.createdBy || "";

  const candidates: Array<{ at: string; user: string }> = [];
  if (latestChange) {
    candidates.push({
      at: latestChange.created_at,
      user: latestChange.user_login?.trim() || ""
    });
  }
  if (latestStatus) {
    candidates.push({
      at: latestStatus.created_at,
      user: latestStatus.user_login?.trim() || ""
    });
  }
  if (data.delivered_at) candidates.push({ at: data.delivered_at, user: latestUser });
  if (data.shipped_at) candidates.push({ at: data.shipped_at, user: latestUser });
  if (candidates.length) {
    candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    latestAt = candidates[0]!.at;
    if (candidates[0]!.user) latestUser = candidates[0]!.user;
  }

  return {
    createdBy: first?.createdBy || formatCreatedBy(data) || "—",
    updatedBy: latestUser || formatCreatedBy(data) || "—",
    lastChange: formatOrderHistoryDateTime(latestAt) || last?.date || "—"
  };
}
