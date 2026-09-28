import type { NakladnoyBuildOptions, NakladnoyLine } from "../order-nakladnoy-xlsx.types";
import {
  fmtDate,
  fmtDateTime,
  fmtMoneyInt,
  lineCodeDisplay,
  uniqJoin
} from "../order-nakladnoy-xlsx.format";
import { loading520IsShelfReturnOnly, loading520SheetName, loading520Title, sortLoading520GroupKeys } from "../order-nakladnoy-xlsx.consignment-217";
import type { WarehouseAggregateContext } from "./warehouse-template-shared";
import { expeditorLoadingDownloadFilename } from "./expeditor-loading-template-ids";

export type ExpeditorLoading520Line = {
  num: number;
  code: string;
  name: string;
  qty: number;
  bonus: number;
  price: string;
  sum: string;
};

export type ExpeditorLoading520Group = {
  name: string;
  qty: number;
  bonus: number;
  sum: string;
  lines: ExpeditorLoading520Line[];
};

/** Virtual preview va Excel uchun yagona manba */
export type ExpeditorLoading520Document = {
  versionLabel: string;
  title: string;
  printedAt: string;
  filename: string;
  sheetName: string;
  meta: {
    dateOrder: string;
    dateShip: string | null;
    agents: string;
    agentPhones: string;
    agentPhonesVisible: boolean;
    territory: string;
    expeditor: string | null;
    expeditorVisible: boolean;
    currency: string;
  };
  groups: ExpeditorLoading520Group[];
  totals: {
    qty: number;
    bonus: number;
    sum: string;
  };
  /** Faqat polki qaytarish — guruh «Возврат с полки», Итого yo‘q */
  shelfReturnOnly: boolean;
};

function phoneFromInvoiceLine(line: string): string {
  const m = /\((\d{7,15})\)\s*$/.exec(line.trim());
  if (m?.[1]) return m[1];
  const d = /(\+?\d[\d\s\-()]{8,})/.exec(line);
  return d?.[1]?.replace(/\D/g, "") || "";
}

function metaAgentPhones(ctx: WarehouseAggregateContext): string {
  const phones = ctx.orders
    .map((o) => phoneFromInvoiceLine(o.invoiceAgentLine || o.agentLine))
    .filter(Boolean);
  return uniqJoin([...new Set(phones)]);
}

function dashOrEmpty(v: string): string {
  const t = v.trim();
  return !t || t === "—" ? "" : t;
}

export function buildExpeditorLoading520Document(
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
): ExpeditorLoading520Document {
  const at = ctx.now;
  const merged = ctx.merged;
  const agents = ctx.agentLabels.join(", ") || merged.agentLine;
  const territory = ctx.territoryLabels.join(", ") || merged.territory || "";
  const exp = ctx.expeditorLabels.join(", ") || merged.expeditorName || merged.expeditorLine;
  const expVal = dashOrEmpty(exp);
  const phones = dashOrEmpty(metaAgentPhones(ctx));

  const groupKeys = sortLoading520GroupKeys([...ctx.linesByGroup.keys()]);
  const groups: ExpeditorLoading520Group[] = [];
  let grandQty = 0;
  let grandBonus = 0;
  let grandSum = 0;
  let idx = 1;

  for (const gk of groupKeys) {
    const groupLines = ctx.linesByGroup
      .get(gk)!
      .filter((ln) => ln.qty > 0 || ln.bonusQty > 0);
    if (groupLines.length === 0) continue;

    let gQty = 0;
    let gBonus = 0;
    let gSum = 0;
    const lines: ExpeditorLoading520Line[] = [];

    for (const ln of groupLines) {
      gQty += ln.qty;
      gBonus += ln.bonusQty;
      gSum += ln.sum;
      lines.push(lineToDoc(ln, idx++, options));
    }

    grandQty += gQty;
    grandBonus += gBonus;
    grandSum += gSum;

    groups.push({
      name: gk,
      qty: gQty,
      bonus: gBonus,
      sum: fmtMoneyInt(gSum),
      lines
    });
  }

  return {
    versionLabel,
    title: loading520Title(at),
    printedAt: fmtDateTime(at),
    filename: expeditorLoadingDownloadFilename("ex-5.2.0", at),
    sheetName: loading520SheetName(expVal || merged.expeditorName),
    meta: {
      dateOrder: fmtDate(merged.createdAt),
      dateShip: merged.dateTo ? fmtDate(merged.dateTo) : fmtDate(merged.createdAt),
      agents: dashOrEmpty(agents) || "—",
      agentPhones: phones,
      agentPhonesVisible: Boolean(phones),
      territory: dashOrEmpty(territory) || "—",
      expeditor: expVal || null,
      expeditorVisible: true,
      currency: merged.currencyLabel || "сум (UZS)"
    },
    groups,
    totals: {
      qty: grandQty,
      bonus: grandBonus,
      sum: fmtMoneyInt(grandSum)
    },
    shelfReturnOnly: loading520IsShelfReturnOnly(groups.map((g) => g.name))
  };
}

function lineToDoc(
  ln: NakladnoyLine,
  num: number,
  options: NakladnoyBuildOptions
): ExpeditorLoading520Line {
  return {
    num,
    code: lineCodeDisplay(ln, options.codeColumn),
    name: ln.name,
    qty: ln.qty,
    bonus: ln.bonusQty,
    price: ln.price > 0 ? fmtMoneyInt(ln.price) : "0",
    sum: fmtMoneyInt(ln.sum)
  };
}
