import { enrichScopedReportActor } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  attachYoy,
  buildP1MonthColumns,
  emptyMetric,
  fillQuarterAndYear,
  monthKey,
  rollupCells
} from "./p1.pure";
import { queryP1AggCells } from "./p1.query";
import type { P1Metric, P1ReportFilters, P1ReportPayload, P1Row } from "./p1.types";

function metricFromRaw(akb: bigint, qty: { toString(): string } | string, total: { toString(): string } | string): P1Metric {
  return {
    akb: Number(akb),
    qty: String(qty),
    total: String(total)
  };
}

export async function getP1Report(
  tenantId: number,
  f: P1ReportFilters,
  actor?: ReportActor
): Promise<P1ReportPayload> {
  const scoped = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const raw = await queryP1AggCells(tenantId, f, scoped);
  const months = buildP1MonthColumns(f.year, f.compare_year);
  const cellKeys = months.map((m) => m.key);
  const years = [f.year, f.compare_year];

  type ProdBag = { id: number; name: string; cells: Record<string, P1Metric> };
  const byRegion = new Map<string, Map<number, ProdBag>>();

  for (const r of raw) {
    let prodMap = byRegion.get(r.region_key);
    if (!prodMap) {
      prodMap = new Map();
      byRegion.set(r.region_key, prodMap);
    }
    let p = prodMap.get(r.product_id);
    if (!p) {
      p = { id: r.product_id, name: r.product_name, cells: {} };
      prodMap.set(r.product_id, p);
    }
    p.cells[monthKey(r.year, r.month)] = metricFromRaw(r.akb, r.qty, r.total);
  }

  const regionKeys = [...byRegion.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  const rows: P1Row[] = [];
  const regionCellBags: Array<Record<string, P1Metric>> = [];

  for (const regionKey of regionKeys) {
    const prodMap = byRegion.get(regionKey)!;
    const products = [...prodMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const productCellBags: Array<Record<string, P1Metric>> = [];

    for (const p of products) {
      const cells = fillQuarterAndYear(p.cells, years);
      productCellBags.push(cells);
      rows.push({
        kind: "product",
        region_key: regionKey,
        region_label: regionKey,
        product_id: p.id,
        product_name: p.name,
        cells,
        yoy: attachYoy(cells, f.year, f.compare_year)
      });
    }

    const monthOnlyKeys = cellKeys.filter((k) => /^\d{4}-\d{2}$/.test(k));
    const regionMonths = rollupCells(productCellBags, monthOnlyKeys);
    const regionFilled = fillQuarterAndYear(regionMonths, years);
    regionCellBags.push(regionFilled);
    rows.push({
      kind: "region",
      region_key: regionKey,
      region_label: regionKey,
      product_id: null,
      product_name: null,
      cells: regionFilled,
      yoy: attachYoy(regionFilled, f.year, f.compare_year)
    });
  }

  // Grand total: Excel — viloyat qatorlari yig‘indisi (product qatorlaridan oldin ko‘rsatiladi)
  const monthOnlyKeys = cellKeys.filter((k) => /^\d{4}-\d{2}$/.test(k));
  const grandMonths = rollupCells(regionCellBags, monthOnlyKeys);
  const grandFilled = fillQuarterAndYear(grandMonths, years);
  const grandRow: P1Row = {
    kind: "grand_total",
    region_key: "__ALL__",
    region_label: "Общая сводка",
    product_id: null,
    product_name: null,
    cells: grandFilled,
    yoy: attachYoy(grandFilled, f.year, f.compare_year)
  };

  // Order: grand → for each region: region header then products (Excel: region header with «Продукт», then products)
  // Excel: Общая сводка, then ANDIJON (Продукт=region sum), then products...
  // Our region row is the sum; products under it.
  const ordered: P1Row[] = [grandRow];
  for (const regionKey of regionKeys) {
    const regionRow = rows.find((r) => r.kind === "region" && r.region_key === regionKey);
    const productRows = rows.filter((r) => r.kind === "product" && r.region_key === regionKey);
    if (regionRow) ordered.push(regionRow);
    ordered.push(...productRows);
  }

  const dateLabel =
    f.date_type === "delivered_date"
      ? "дата доставки"
      : f.date_type === "shipped_date"
        ? "дата отправки"
        : "дата заказа";
  return {
    year: f.year,
    compare_year: f.compare_year,
    date_type: f.date_type,
    months,
    rows: ordered,
    totals_note: `АКБ — уникальные клиенты по товару за месяц (в итоге области/сводки суммируется как в Excel). Кол-во/Сумма = продажи − возвраты. Период по: ${dateLabel}.`
  };
}

export function zeroIfEmpty(m: P1Metric | undefined): P1Metric {
  return m ?? emptyMetric();
}
