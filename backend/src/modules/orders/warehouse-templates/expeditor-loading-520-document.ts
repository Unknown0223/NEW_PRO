import type { NakladnoyBuildOptions, NakladnoyLine } from "../order-nakladnoy-xlsx.types";
import {
  fmtDate,
  fmtDateTime,
  fmtMoneyInt,
  lineCodeDisplay,
  uniqJoin
} from "../order-nakladnoy-xlsx.format";
import type { WarehouseAggregateContext } from "./warehouse-template-shared";
import { expeditorLoadingDownloadFilename } from "./expeditor-loading-template-ids";

export type ExpeditorLoading520Line = {
  num: number;
  code: string;
  name: string;
  qty: number | null;
  bonus: number | null;
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
};

function metaAgentPhones(ctx: WarehouseAggregateContext): string {
  const phones = ctx.orders
    .map((o) => {
      const m = /(\+?\d[\d\s\-()]{8,})/.exec(o.agentLine);
      return m?.[1]?.trim() ?? "";
    })
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
  const exp = ctx.expeditorLabels.join(", ") || merged.expeditorLine;
  const expVal = dashOrEmpty(exp);
  const phones = dashOrEmpty(metaAgentPhones(ctx));

  const groupKeys = [...ctx.linesByGroup.keys()].sort((a, b) => a.localeCompare(b, "ru"));
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
      sum: gSum > 0 ? fmtMoneyInt(gSum) : "",
      lines
    });
  }

  return {
    versionLabel,
    title: `Загрузочный лист ${versionLabel} (Время печати: ${fmtDateTime(at)})`,
    printedAt: fmtDateTime(at),
    filename: expeditorLoadingDownloadFilename("ex-5.2.0", at),
    meta: {
      dateOrder: fmtDate(merged.createdAt),
      dateShip: merged.dateTo ? fmtDate(merged.dateTo) : null,
      agents: dashOrEmpty(agents) || "—",
      agentPhones: phones,
      agentPhonesVisible: Boolean(phones),
      territory: dashOrEmpty(territory) || "—",
      expeditor: expVal || null,
      expeditorVisible: Boolean(expVal),
      currency: merged.currencyLabel || "So'm (UZS)"
    },
    groups,
    totals: {
      qty: grandQty,
      bonus: grandBonus,
      sum: grandSum > 0 ? fmtMoneyInt(grandSum) : ""
    }
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
    qty: ln.qty > 0 ? ln.qty : null,
    bonus: ln.bonusQty > 0 ? ln.bonusQty : null,
    price: ln.price > 0 ? fmtMoneyInt(ln.price) : "",
    sum: ln.sum > 0 ? fmtMoneyInt(ln.sum) : ""
  };
}
