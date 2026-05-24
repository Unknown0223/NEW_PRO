/**
 * Lalaku spravochnik konstantalari va finance merge yordamchilari.
 */
import {
  priceTypeKey,
  type PaymentMethodEntryDto,
  type PriceTypeEntryDto
} from "../../src/modules/tenant-settings/finance-refs";
import { normKey } from "../../../shared/territory-lalaku-seed";

export { ZONE_ROOT_NAMES, REGION_ZONE_ROWS, mergeTerritoryBundle } from "../../../shared/territory-lalaku-seed";

export const SALES_CHANNELS: { name: string; code: string }[] = [
  { name: "B.SALOONS", code: "BSALOONS" },
  { name: "HORECA", code: "HORECA" },
  { name: "MOD.TRADE", code: "MODTRADE" },
  { name: "TRAD TRADE", code: "TRADTRADE" },
  { name: "WHOLESALE", code: "WHOLESALE" }
];

export const CLIENT_FORMATS: { name: string; code: string }[] = [
  { name: "Drogery", code: "DROGERY" },
  { name: "OP.Markets", code: "OPMARKETS" },
  { name: "Others", code: "OTHERS" },
  { name: "Perfumery", code: "PERFUMERY" },
  { name: "Pharmacy", code: "PHARMACY" },
  { name: "Superettes", code: "SUPERETTES" },
  { name: "Supermarket", code: "SUPERMARKET" },
  { name: "To'yxona", code: "TOYXONA" }
];

export const CLIENT_CATEGORIES: { name: string; code: string }[] = [
  { name: "A", code: "A" },
  { name: "B", code: "B" },
  { name: "C", code: "C" },
  { name: "D", code: "D" }
];

export const CLIENT_TYPES: { name: string; code: string }[] = [
  { name: "FOOD", code: "FOOD" },
  { name: "FOOD-HPC", code: "FOODHPC" },
  { name: "HPC", code: "HPC" },
  { name: "SUV", code: "SUV" }
];

export const TRADE_DIRECTIONS: {
  name: string;
  code: string;
  sort_order: number;
  use_in_order_proposal: boolean;
}[] = [
  { name: "DIELUX", code: "DIELUX", sort_order: 0, use_in_order_proposal: false },
  { name: "GIGA", code: "GIGA", sort_order: 0, use_in_order_proposal: false },
  { name: "LALAKU", code: "LALAKU", sort_order: 0, use_in_order_proposal: false },
  { name: "MAMA", code: "MAMA", sort_order: 0, use_in_order_proposal: false },
  { name: "MARKET PLACE", code: "MARKETPLACE", sort_order: 0, use_in_order_proposal: false },
  { name: "MIX_JENS", code: "MIX_JENS", sort_order: 0, use_in_order_proposal: false },
  { name: "MONNO", code: "MONNO", sort_order: 0, use_in_order_proposal: false },
  { name: "REVEREM", code: "REVEREM", sort_order: 0, use_in_order_proposal: true },
  { name: "SOF", code: "SOF", sort_order: 0, use_in_order_proposal: false },
  { name: "UMUMIY", code: "UMUMIY", sort_order: 0, use_in_order_proposal: false }
];

/** Sozlamalar → Finans → «Цена» (sotish): to‘lov usuli + narx turi juftlari */
export const LALAKU_FINANCE_PAYMENT_METHODS: PaymentMethodEntryDto[] = [
  {
    id: "lalaku-pay-naqd",
    name: "Naqd",
    code: "naqd",
    currency_code: "UZS",
    sort_order: 100,
    comment: null,
    color: null,
    active: true
  },
  {
    id: "lalaku-pay-terminal",
    name: "Terminal",
    code: "terminal",
    currency_code: "UZS",
    sort_order: 101,
    comment: null,
    color: null,
    active: true
  },
  {
    id: "lalaku-pay-perechis",
    name: "Perechis",
    code: "perechis",
    currency_code: "UZS",
    sort_order: 102,
    comment: null,
    color: null,
    active: true
  }
];

export const LALAKU_FINANCE_PRICE_TYPES: PriceTypeEntryDto[] = [
  {
    id: "lalaku-pt-naqd-pul",
    name: "NAQD PUL",
    code: "NAQD_PUL",
    payment_method_id: "lalaku-pay-naqd",
    kind: "sale",
    sort_order: 100,
    comment: null,
    active: true,
    manual: false,
    attached_clients_only: false
  },
  {
    id: "lalaku-pt-terminal",
    name: "TERMINAL",
    code: "TERMINAL",
    payment_method_id: "lalaku-pay-terminal",
    kind: "sale",
    sort_order: 101,
    comment: null,
    active: true,
    manual: false,
    attached_clients_only: false
  },
  {
    id: "lalaku-pt-perechisleniye",
    name: "PERECHISLENIYE",
    code: "PERECHISLENIYE",
    payment_method_id: "lalaku-pay-perechis",
    kind: "sale",
    sort_order: 102,
    comment: null,
    active: true,
    manual: false,
    attached_clients_only: false
  }
];

export function mergePaymentMethodEntries(
  existing: PaymentMethodEntryDto[],
  add: PaymentMethodEntryDto[]
): PaymentMethodEntryDto[] {
  const out = [...existing];
  const seenId = new Set(out.map((e) => e.id));
  const seenCode = new Set(
    out.map((e) => (e.code ? normKey(e.code) : "")).filter(Boolean)
  );
  const seenName = new Set(out.map((e) => normKey(e.name)));
  for (const row of add) {
    if (seenId.has(row.id)) continue;
    const ck = row.code ? normKey(row.code) : "";
    const nk = normKey(row.name);
    if ((ck && seenCode.has(ck)) || seenName.has(nk)) continue;
    seenId.add(row.id);
    if (ck) seenCode.add(ck);
    seenName.add(nk);
    out.push({ ...row });
  }
  return out;
}

export function mergePriceTypeEntries(
  existing: PriceTypeEntryDto[],
  add: PriceTypeEntryDto[]
): PriceTypeEntryDto[] {
  const out = [...existing];
  const seenId = new Set(out.map((e) => e.id));
  const seenKey = new Set(out.map((e) => normKey(priceTypeKey(e))));
  for (const row of add) {
    if (seenId.has(row.id)) continue;
    const k = normKey(priceTypeKey(row));
    if (seenKey.has(k)) continue;
    seenId.add(row.id);
    seenKey.add(k);
    out.push({ ...row });
  }
  return out;
}

export const WAREHOUSE_NAMES = [
  "Andijon SKLAD",
  "Buxoro SKLAD",
  "Denov SKLAD",
  "Farg'ona SKLAD",
  "Guliston SKLAD",
  "Jidda sklad",
  "Jizzax SKLAD",
  "Kattaqo'rgon SKLAD",
  "Namangan SKLAD",
  "Navoiy SKLAD",
  "Nukus Sklad",
  "Olmaliq sklad",
  "Orikzor SKLAD",
  "Qarshi Sklad",
  "Qoqon SKLAD",
  "Samarqand SKLAD",
  "Sergeli sklad",
  "Shaxrisabz Sklad",
  "Shimkent SKLAD",
  "Termiz SKLAD",
  "Xorazm SKLAD",
  "Yunusobod SKLAD",
  "Zarafshon LLK"
] as const;
