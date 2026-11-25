/** Pure matrix helpers — SalesDoc `/report/expeditor` grain. */

export type ShipCell = {
  block_count: number;
  volume: string;
  qty: string;
  amount: string;
};

export type ShipCol = {
  expeditor_id: number | null;
  expeditor_name: string;
};

export type ShipProductRow = {
  product_id: number;
  product_name: string;
  category_name: string;
  cells: Record<string, ShipCell>;
};

export type ShipCategoryGroup = {
  key: string;
  category_name: string;
  products: ShipProductRow[];
  cells: Record<string, ShipCell>;
};

export function colKey(id: number | null | undefined): string {
  return id == null ? "none" : String(id);
}

function num(v: string | number | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function qtyOut(n: number): string {
  const s = n.toFixed(3).replace(/\.?0+$/, "");
  return s || "0";
}

function moneyOut(n: number): string {
  return n.toFixed(2);
}

export function emptyCell(): ShipCell {
  return { block_count: 0, volume: "0", qty: "0", amount: "0.00" };
}

export function aggregateCells(cells: ShipCell[]): ShipCell {
  let block = 0;
  let volume = 0;
  let qty = 0;
  let amount = 0;
  for (const c of cells) {
    block += c.block_count || 0;
    volume += num(c.volume);
    qty += num(c.qty);
    amount += num(c.amount);
  }
  return {
    block_count: block,
    volume: qtyOut(volume),
    qty: qtyOut(qty),
    amount: moneyOut(amount)
  };
}

export function isZeroCell(cell: ShipCell | undefined): boolean {
  if (!cell) return true;
  return (
    (cell.block_count || 0) === 0 &&
    num(cell.volume) === 0 &&
    num(cell.qty) === 0 &&
    num(cell.amount) === 0
  );
}

/** Selected filter order wins (incl. empty cols); else report columns. */
export function resolveExpeditorColumns(args: {
  selectedIds: string[];
  reportColumns: ShipCol[];
  filterExpeditors: Array<{ id: number; name: string }>;
}): ShipCol[] {
  const { selectedIds, reportColumns, filterExpeditors } = args;
  if (selectedIds.length === 0) return reportColumns;

  const byId = new Map(filterExpeditors.map((e) => [String(e.id), e.name]));
  for (const c of reportColumns) {
    const k = colKey(c.expeditor_id);
    if (!byId.has(k)) byId.set(k, c.expeditor_name);
  }

  return selectedIds.map((id) => {
    if (id === "none" || id === "") {
      return { expeditor_id: null, expeditor_name: byId.get("none") || "Без экспедитора" };
    }
    const n = Number(id);
    return {
      expeditor_id: Number.isFinite(n) ? n : null,
      expeditor_name: byId.get(id) || id
    };
  });
}

/** Hide expeditors with zero totals (and no activity). Selected filter cols stay. */
export function filterEmptyExpeditorColumns(args: {
  columns: ShipCol[];
  totals: Record<string, ShipCell & { invoice_count?: number }>;
  showEmpty: boolean;
  /** When user picked expeditors in filter, keep all selected even if empty. */
  forceKeepIds?: string[];
}): ShipCol[] {
  const { columns, totals, showEmpty, forceKeepIds } = args;
  if (showEmpty) return columns;
  const force = new Set(forceKeepIds ?? []);
  return columns.filter((c) => {
    const k = colKey(c.expeditor_id);
    if (force.has(k) || (c.expeditor_id == null && force.has("none"))) return true;
    const t = totals[k];
    if (!t) return false;
    return !isZeroCell(t) || (t.invoice_count ?? 0) > 0;
  });
}

export function groupRowsByCategory(
  rows: ShipProductRow[],
  columns: ShipCol[]
): ShipCategoryGroup[] {
  const order: string[] = [];
  const map = new Map<string, ShipProductRow[]>();
  for (const r of rows) {
    const key = (r.category_name || "").trim() || "—";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(r);
  }

  return order.map((key) => {
    const products = map.get(key)!;
    const cells: Record<string, ShipCell> = {};
    for (const col of columns) {
      const k = colKey(col.expeditor_id);
      cells[k] = aggregateCells(products.map((p) => p.cells[k] ?? emptyCell()));
    }
    return { key, category_name: key, products, cells };
  });
}
