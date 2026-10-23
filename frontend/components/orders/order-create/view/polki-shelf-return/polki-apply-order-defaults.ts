import type { PolkiOrderPickRow } from "../../types";
import { parsePriceAmount } from "../../utils";
import type { PolkiPriceTypeEntryRef } from "./polki-price-type-options";
import { polkiPriceTypeKey, salePriceTypeOptionsFromProfile } from "./polki-price-type-options";

export type PolkiOrderDefaultsPatch = {
  warehouseId: string;
  agentId: string;
  priceType: string;
  tradeDirection: string;
  skidkaType: "none" | "auto" | "line";
  bonusCalcMode: "auto" | "manual";
};

function matchTradeDirectionValue(
  stored: string | null | undefined,
  options: Array<{ value: string; label: string }>
): string {
  const raw = stored?.trim();
  if (!raw) return "";
  const low = raw.toLowerCase();
  const hit = options.find(
    (o) =>
      o.value.toLowerCase() === low ||
      o.label.toLowerCase() === low ||
      o.value.toLowerCase().includes(low) ||
      low.includes(o.value.toLowerCase())
  );
  return hit?.value ?? raw;
}

export function resolvePriceTypeFromOrder(
  order: {
    price_type?: string | null;
    payment_method_ref?: string | null;
    payment_method_label?: string | null;
  },
  priceTypeOptions: Array<{ key: string; label: string }>,
  priceEntries: PolkiPriceTypeEntryRef[] | undefined
): string {
  const candidates = [
    order.price_type?.trim(),
    order.payment_method_ref?.trim(),
    order.payment_method_label?.trim()
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (priceTypeOptions.some((p) => p.key === c)) return c;
    const low = c.toLowerCase();
    const entry = (priceEntries ?? []).find((e) => {
      const code = (e.code ?? "").trim().toLowerCase();
      const pmId = (e.payment_method_id ?? "").trim().toLowerCase();
      return (
        e.id.toLowerCase() === low ||
        code === low ||
        e.name.trim().toLowerCase() === low ||
        polkiPriceTypeKey(e).toLowerCase() === low ||
        (pmId !== "" && pmId === low)
      );
    });
    if (entry) {
      const key = polkiPriceTypeKey(entry);
      if (priceTypeOptions.some((p) => p.key === key)) return key;
    }
    const byLabel = priceTypeOptions.find(
      (p) => p.key.toLowerCase() === low || p.label.toLowerCase() === low
    );
    if (byLabel) return byLabel.key;
  }

  return priceTypeOptions[0]?.key ?? "retail";
}

/** Narx turi kaliti → to‘lov usuli select id (Saqlash effektga qaramasdan). */
export function paymentMethodIdForPriceType(
  priceType: string,
  priceEntries: PolkiPriceTypeEntryRef[] | undefined,
  paymentOptions: Array<{ id: string; name: string }>,
  paymentEntries: Array<{ id?: string; name?: string; code?: string | null }>
): string | null {
  const pt = priceType.trim();
  if (!pt) return null;
  const low = pt.toLowerCase();
  const hit = (priceEntries ?? []).find((e) => {
    const key = polkiPriceTypeKey(e);
    const code = (e.code ?? "").trim();
    return (
      key === pt ||
      key.toLowerCase() === low ||
      e.id.trim().toLowerCase() === low ||
      e.name.trim().toLowerCase() === low ||
      (code !== "" && code.toLowerCase() === low)
    );
  });
  const raw = (hit?.payment_method_id ?? "").trim() || (hit ? polkiPriceTypeKey(hit) : pt);
  return matchPaymentMethodSelectId(raw, paymentOptions, paymentEntries) ?? (raw || null);
}

export function matchPaymentMethodSelectId(
  stored: string,
  options: Array<{ id: string; name: string }>,
  entries: Array<{ id?: string; name?: string; code?: string | null }>
): string | null {
  const t = stored.trim();
  if (!t) return null;
  const low = t.toLowerCase();
  const optHit = options.find(
    (o) => o.id.toLowerCase() === low || o.name.trim().toLowerCase() === low
  );
  if (optHit) return optHit.id;
  const eHit = entries.find((e) => {
    const id = String(e.id ?? "").trim();
    const name = String(e.name ?? "").trim();
    const code = String(e.code ?? "").trim();
    return (
      id.toLowerCase() === low ||
      name.toLowerCase() === low ||
      (code !== "" && code.toLowerCase() === low)
    );
  });
  if (eHit) {
    const id = String(eHit.id ?? "").trim();
    const opt = options.find((o) => o.id === id);
    if (opt) return opt.id;
  }
  return null;
}

function resolveSkidkaType(order: PolkiOrderPickRow): "none" | "auto" | "line" {
  const discount = parsePriceAmount(order.discount_sum ?? "0");
  const bonus = parsePriceAmount(order.bonus_sum ?? "0");
  const bonusQty = Number.parseFloat(String(order.bonus_qty ?? "").replace(",", "."));
  const hasBonus = bonus > 0 || (Number.isFinite(bonusQty) && bonusQty > 0);
  if (discount <= 0 && !hasBonus) return "none";
  if (discount > 0 && hasBonus) return "auto";
  if (discount > 0) return "line";
  return "none";
}

/** Po zakaz: tanlangan zakaz parametrlarini forma maydonlariga. */
export function polkiDefaultsFromOrderRow(
  order: PolkiOrderPickRow,
  input: {
    priceTypeEntries?: PolkiPriceTypeEntryRef[];
    fallbackPriceTypes: string[];
    tradeDirectionOptions: Array<{ value: string; label: string }>;
  }
): PolkiOrderDefaultsPatch {
  const priceTypeOptions = salePriceTypeOptionsFromProfile(
    input.priceTypeEntries,
    input.fallbackPriceTypes
  );

  const warehouseId =
    order.warehouse_id != null && order.warehouse_id > 0 ? String(order.warehouse_id) : "";
  const agentId = order.agent_id != null && order.agent_id > 0 ? String(order.agent_id) : "";

  return {
    warehouseId,
    agentId,
    priceType: resolvePriceTypeFromOrder(order, priceTypeOptions, input.priceTypeEntries),
    tradeDirection: matchTradeDirectionValue(order.agent_trade_direction, input.tradeDirectionOptions),
    skidkaType: resolveSkidkaType(order),
    bonusCalcMode: "auto"
  };
}
