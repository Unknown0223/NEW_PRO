import ExcelJS from "exceljs";
import type {
  NakladnoyBuildOptions,
  NakladnoyCodeColumn,
  NakladnoyGroupBy,
  NakladnoyLine,
  NakladnoyOrderPayload
} from "./order-nakladnoy-xlsx.types";

export function lineCodeDisplay(ln: NakladnoyLine, codeColumn: NakladnoyCodeColumn): string {
  if (codeColumn === "barcode") {
    const b = ln.barcode?.trim();
    if (b) return b;
  }
  return ln.sku;
}

export const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } }
};

export const FILL_GROUP: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE6E0F5" }
};

export const FILL_HEADER_GREY: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9D9D9" }
};

export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function fmtDateTime(d: Date): string {
  const t = fmtDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${t} ${hh}:${mi}:${ss}`;
}

export function fmtMoneyInt(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(n));
}

export function fmtMoney2(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

export function blockCount(line: NakladnoyLine): number | string {
  const qpb = line.qtyPerBlock;
  if (qpb != null && qpb > 0) {
    const b = line.qty / qpb;
    if (Number.isFinite(b)) return Math.round(b * 1000) / 1000;
  }
  return "—";
}

export function sanitizeSheetName(raw: string): string {
  const s = raw.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return s || "Zakaz";
}

export function applyBorderRange(
  sheet: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number
) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      sheet.getCell(r, c).border = BORDER_THIN as ExcelJS.Borders;
    }
  }
}

/** Bir xil mahsulot+qator guruhi bo‘yicha yig‘indilar (bir nechta zakazdan). */
export function mergeLoadingLines(lines: NakladnoyLine[]): NakladnoyLine[] {
  const m = new Map<string, NakladnoyLine>();
  for (const ln of lines) {
    const k = `${ln.groupTitle}\0${ln.productId}`;
    const ex = m.get(k);
    if (!ex) {
      m.set(k, { ...ln });
      continue;
    }
    ex.qty += ln.qty;
    ex.bonusQty += ln.bonusQty;
    ex.sum += ln.sum;
    ex.price = ex.qty > 0 ? ex.sum / ex.qty : 0;
  }
  return [...m.values()];
}

/** Bir nechta zakaz/sodiqnik qiymatlari — vergul bilan (etalon shablon). */
export function uniqJoin(values: string[], sep = ", "): string {
  const u = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (u.length === 0) return "—";
  if (u.length === 1) return u[0]!;
  return u.join(sep);
}

export function buildMergedLoadingPayload(
  orders: NakladnoyOrderPayload[],
  sheetNumberLabel: string
): NakladnoyOrderPayload {
  const first = orders[0]!;
  const mergedLines = mergeLoadingLines(orders.flatMap((o) => o.lines));
  const times = orders.map((o) => o.createdAt.getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const dateTo = maxT > minT ? new Date(maxT) : null;

  return {
    ...first,
    number: sheetNumberLabel,
    createdAt: new Date(minT),
    dateTo,
    agentLine: uniqJoin(orders.map((o) => o.agentLine)),
    expeditorLine: uniqJoin(orders.map((o) => o.expeditorLine)),
    territory: uniqJoin(orders.map((o) => o.territory)),
    warehouseName: (() => {
      const names = orders
        .map((o) => o.warehouseName)
        .filter((n): n is string => Boolean(n?.trim()));
      const u = [...new Set(names)];
      if (u.length === 0) return null;
      if (u.length === 1) return u[0]!;
      return u.join(", ");
    })(),
    lines: mergedLines,
    paidLines: [],
    bonusLines: []
  };
}

export function groupKeyForOrder(o: NakladnoyOrderPayload, by: NakladnoyGroupBy): string {
  switch (by) {
    case "agent":
      return o.agentId != null ? `a:${o.agentId}` : "a:none";
    case "expeditor":
      return o.expeditorUserId != null ? `e:${o.expeditorUserId}` : "e:none";
    case "territory":
    default:
      return `t:${o.territory || "—"}`;
  }
}

export function sheetNameForGroup(by: NakladnoyGroupBy, orders: NakladnoyOrderPayload[]): string {
  const o = orders[0]!;
  const n = orders.length;
  if (n === 1) return o.number;
  const short = (s: string) => sanitizeSheetName(s.replace(/[:\\/?*[\]]/g, " ").slice(0, 18));
  switch (by) {
    case "agent":
      return short((o.agentId != null ? o.agentLine : "no_agent") + `_${n}`);
    case "expeditor":
      return short((o.expeditorUserId != null ? o.expeditorLine : "no_exp") + `_${n}`);
    case "territory":
    default:
      return short(`${o.territory || "no_ter"}_${n}`);
  }
}

export function expandLoadingSheetPayloads(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): NakladnoyOrderPayload[] {
  if (orders.length === 0) return [];
  if (!options.separateSheets) {
    if (orders.length === 1) return [orders[0]!];
    return [buildMergedLoadingPayload(orders, `Все_${orders.length}`)];
  }
  const buckets = new Map<string, NakladnoyOrderPayload[]>();
  for (const o of orders) {
    const k = groupKeyForOrder(o, options.groupBy);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(o);
  }
  return [...buckets.values()].map((group) => {
    if (group.length === 1) return group[0]!;
    return buildMergedLoadingPayload(group, sheetNameForGroup(options.groupBy, group));
  });
}

/** «Накладные 2.1.0»: zakazlarni birlashtirmasdan, varaq(lar)da ustma-ust. */
export function expandConsignmentSheetGroups(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): NakladnoyOrderPayload[][] {
  if (orders.length === 0) return [];
  if (!options.separateSheets) return [orders];
  const buckets = new Map<string, NakladnoyOrderPayload[]>();
  for (const o of orders) {
    const k = groupKeyForOrder(o, options.groupBy);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(o);
  }
  return [...buckets.values()];
}
