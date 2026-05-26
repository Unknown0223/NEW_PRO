import type {
  NakladnoyBuildOptions,
  NakladnoyLine,
  NakladnoyOrderPayload
} from "../order-nakladnoy-xlsx.types";
import {
  buildMergedLoadingPayload,
  expandLoadingSheetPayloads,
  mergeLoadingLines,
  uniqJoin
} from "../order-nakladnoy-xlsx.format";

export type WarehouseAggregateContext = {
  orders: NakladnoyOrderPayload[];
  merged: NakladnoyOrderPayload;
  lines: NakladnoyLine[];
  lineBySku: Map<string, NakladnoyLine>;
  lineByNameNorm: Map<string, NakladnoyLine>;
  linesByGroup: Map<string, NakladnoyLine[]>;
  agentLabels: string[];
  expeditorLabels: string[];
  territoryLabels: string[];
  clientColumns: Array<{
    key: string;
    clientName: string;
    agentLine: string;
    territory: string;
    lines: NakladnoyLine[];
  }>;
  expeditorBlocks: Array<{
    expeditorLine: string;
    lines: NakladnoyLine[];
  }>;
  now: Date;
};

function normName(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function stripExpeditorDecor(line: string | undefined | null): string {
  if (!line) return "";
  return line
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(\d{2}\.\d{2}\.\d{4}\).*$/, "")
    .trim();
}

export function buildWarehouseAggregateContext(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): WarehouseAggregateContext {
  const payloads = expandLoadingSheetPayloads(orders, options);
  const merged =
    payloads.length === 1
      ? payloads[0]!
      : buildMergedLoadingPayload(orders, `Все_${orders.length}`);

  const lines = mergeLoadingLines(merged.lines);
  const lineBySku = new Map<string, NakladnoyLine>();
  const lineByNameNorm = new Map<string, NakladnoyLine>();
  for (const ln of lines) {
    lineBySku.set(ln.sku.trim().toUpperCase(), ln);
    lineByNameNorm.set(normName(ln.name), ln);
  }

  const linesByGroup = new Map<string, NakladnoyLine[]>();
  for (const ln of lines) {
    const g = ln.groupTitle || "Прочее";
    if (!linesByGroup.has(g)) linesByGroup.set(g, []);
    linesByGroup.get(g)!.push(ln);
  }

  const clientColumns = orders.map((o) => ({
    key: `o:${o.id}`,
    clientName: o.clientName,
    agentLine: o.agentLine,
    territory: o.territory,
    lines: mergeLoadingLines(o.lines)
  }));

  const expMap = new Map<string, NakladnoyLine[]>();
  for (const o of orders) {
    const k = o.expeditorLine || "—";
    if (!expMap.has(k)) expMap.set(k, []);
    expMap.get(k)!.push(...o.lines);
  }
  const expeditorBlocks = [...expMap.entries()].map(([expeditorLine, raw]) => ({
    expeditorLine,
    lines: mergeLoadingLines(raw)
  }));

  return {
    orders,
    merged,
    lines,
    lineBySku,
    lineByNameNorm,
    linesByGroup,
    agentLabels: [...new Set(orders.map((o) => o.agentLine).filter((x) => x && x !== "—"))],
    expeditorLabels: [
      ...new Set(
        orders
          .map((o) => stripExpeditorDecor(o.expeditorLine))
          .filter((x) => x && x !== "—")
      )
    ],
    territoryLabels: [...new Set(orders.map((o) => o.territory).filter((x) => x && x !== "—"))],
    clientColumns,
    expeditorBlocks,
    now: new Date()
  };
}

export function lookupLine(
  ctx: WarehouseAggregateContext,
  skuOrName: string | null | undefined
): NakladnoyLine | undefined {
  if (!skuOrName) return undefined;
  const t = skuOrName.trim();
  if (!t) return undefined;
  const bySku = ctx.lineBySku.get(t.toUpperCase());
  if (bySku) return bySku;
  return ctx.lineByNameNorm.get(normName(t));
}

export function metaAgents(ctx: WarehouseAggregateContext): string {
  return uniqJoin(ctx.agentLabels.length ? ctx.agentLabels : ctx.orders.map((o) => o.agentLine));
}

export function metaExpeditors(ctx: WarehouseAggregateContext): string {
  return uniqJoin(
    ctx.expeditorLabels.length
      ? ctx.expeditorLabels
      : ctx.orders.map((o) => stripExpeditorDecor(o.expeditorLine))
  );
}

export function metaTerritories(ctx: WarehouseAggregateContext): string {
  return uniqJoin(
    ctx.territoryLabels.length ? ctx.territoryLabels : ctx.orders.map((o) => o.territory)
  );
}

export function bonusLabel(qty: number): string {
  if (qty <= 0) return "";
  return `${qty} бонус`;
}

export function blockLabel(line: NakladnoyLine): string {
  const qpb = line.qtyPerBlock;
  if (qpb != null && qpb > 0) {
    const b = Math.round((line.qty / qpb) * 1000) / 1000;
    return `${b} бл`;
  }
  return line.qty > 0 ? `${line.qty} бл` : "";
}
