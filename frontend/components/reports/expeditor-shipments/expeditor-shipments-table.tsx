"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import {
  colKey,
  groupRowsByCategory,
  isZeroCell,
  type ShipCell,
  type ShipCol,
  type ShipProductRow
} from "./expeditor-shipments-matrix";

type Totals = Record<string, ShipCell & { invoice_count?: number }>;

const METRICS = [
  { key: "block", label: "Бл", title: "Блок" },
  { key: "volume", label: "Об", title: "Объём" },
  { key: "qty", label: "Кол", title: "Количество" },
  { key: "amount", label: "Σ", title: "Сумма" }
] as const;

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function cellTxt(v: string | number, blankZero: boolean) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  if (blankZero && (!Number.isFinite(n) || n === 0)) return "";
  return money(v);
}

function MetricCells({
  cell,
  emphasize
}: {
  cell: ShipCell | undefined;
  emphasize?: boolean;
}) {
  const zero = isZeroCell(cell);
  const cls = cn(
    "w-[3.25rem] max-w-[3.25rem] whitespace-nowrap px-1 py-1 text-right tabular-nums",
    zero && "text-muted-foreground",
    emphasize && "font-medium"
  );
  return (
    <Fragment>
      <td className={cls}>{cellTxt(cell?.block_count ?? 0, true)}</td>
      <td className={cls}>{cellTxt(cell?.volume ?? 0, true)}</td>
      <td className={cls}>{cellTxt(cell?.qty ?? 0, true)}</td>
      <td className={cn(cls, "w-[4.5rem] max-w-[4.5rem]")}>
        {zero ? "0" : money(cell?.amount ?? 0)}
      </td>
    </Fragment>
  );
}

const stickyHead =
  "sticky left-0 z-30 w-44 min-w-[11rem] max-w-[11rem] border-r border-border bg-muted px-2 py-1.5 text-left";
const stickyBody =
  "sticky left-0 z-10 w-44 min-w-[11rem] max-w-[11rem] border-r border-border bg-card px-2 py-1";
const stickyGroup =
  "sticky left-0 z-10 w-44 min-w-[11rem] max-w-[11rem] border-r border-border bg-muted/50 px-2 py-1";
const stickyFoot =
  "sticky left-0 z-10 w-44 min-w-[11rem] max-w-[11rem] border-r border-border bg-muted/30 px-2 py-1.5";

/** Dual-header matrix — dense layout, short metric labels. */
export function ExpeditorShipmentsTable({
  columns,
  rows,
  totals,
  loading,
  fetching,
  page,
  totalPages,
  onPage,
  expandAllSignal
}: {
  columns: ShipCol[];
  rows: ShipProductRow[];
  totals: Totals;
  loading: boolean;
  fetching: boolean;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  /** Increment to expand all; decrement signal via negative to collapse — use {version, open}. */
  expandAllSignal?: { version: number; open: boolean };
}) {
  const groups = useMemo(() => groupRowsByCategory(rows, columns), [rows, columns]);
  const groupKeys = groups.map((g) => g.key).join("\u0001");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.key] = true;
    setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat yangi guruhlar
  }, [groupKeys]);

  useEffect(() => {
    if (!expandAllSignal) return;
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.key] = expandAllSignal.open;
    setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signal version
  }, [expandAllSignal?.version, expandAllSignal?.open]);

  const colSpan = Math.max(1, 1 + columns.length * 4);

  return (
    <>
      <div className="overflow-auto">
        <table className="w-max min-w-full border-collapse text-[11px] leading-tight">
          <thead className="app-table-thead sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className={stickyHead}>
                Товар
              </th>
              {columns.map((c, i) => (
                <th
                  key={colKey(c.expeditor_id)}
                  colSpan={4}
                  title={c.expeditor_name}
                  className={cn(
                    "border-l border-border/50 px-1 py-1 text-center font-semibold",
                    i % 2 === 1 && "bg-primary/[0.04]"
                  )}
                >
                  <span className="line-clamp-2 max-w-[8.5rem] mx-auto">{c.expeditor_name}</span>
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((c, i) => (
                <Fragment key={`${colKey(c.expeditor_id)}-sub`}>
                  {METRICS.map((m, mi) => (
                    <th
                      key={m.key}
                      title={m.title}
                      className={cn(
                        "px-1 py-0.5 text-right font-medium text-muted-foreground",
                        mi === 0 && "border-l border-border/50",
                        i % 2 === 1 && "bg-primary/[0.04]"
                      )}
                    >
                      {m.label}
                    </th>
                  ))}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={colSpan}>
                  Загрузка…
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={colSpan}>
                  Нет данных
                </td>
              </tr>
            ) : (
              groups.map((g) => {
                const expanded = open[g.key] !== false;
                return (
                  <Fragment key={g.key}>
                    <tr className="border-t border-border/60 bg-muted/40">
                      <td className={stickyGroup}>
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-0.5 text-left font-semibold"
                          onClick={() => setOpen((s) => ({ ...s, [g.key]: !expanded }))}
                        >
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                              expanded && "rotate-90"
                            )}
                          />
                          <span className="truncate" title={g.category_name}>
                            {g.category_name}
                          </span>
                          <span className="ml-1 shrink-0 text-[10px] font-normal text-muted-foreground">
                            ({g.products.length})
                          </span>
                        </button>
                      </td>
                      {columns.map((c) => (
                        <MetricCells
                          key={`${g.key}-${colKey(c.expeditor_id)}`}
                          cell={g.cells[colKey(c.expeditor_id)]}
                          emphasize
                        />
                      ))}
                    </tr>
                    {expanded
                      ? g.products.map((r) => (
                          <tr
                            key={r.product_id}
                            className="border-t border-border/40 hover:bg-muted/20"
                          >
                            <td className={cn(stickyBody, "pl-7 font-medium")}>
                              <span className="line-clamp-2" title={r.product_name}>
                                {r.product_name}
                              </span>
                            </td>
                            {columns.map((c) => (
                              <MetricCells
                                key={`${r.product_id}-${colKey(c.expeditor_id)}`}
                                cell={r.cells[colKey(c.expeditor_id)]}
                              />
                            ))}
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {columns.length > 0 && groups.length > 0 ? (
            <tfoot className="border-t bg-muted/30 font-medium">
              <tr>
                <td className={stickyFoot}>Итого</td>
                {columns.map((c) => (
                  <MetricCells
                    key={`tot-${colKey(c.expeditor_id)}`}
                    cell={totals[colKey(c.expeditor_id)]}
                    emphasize
                  />
                ))}
              </tr>
              <tr>
                <td className={stickyFoot}>Накладных</td>
                {columns.map((c) => (
                  <td
                    key={`inv-${colKey(c.expeditor_id)}`}
                    className="px-1 py-1.5 text-right tabular-nums"
                    colSpan={4}
                  >
                    {totals[colKey(c.expeditor_id)]?.invoice_count ?? 0}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || fetching}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          Назад
        </Button>
        <span className="text-xs text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || fetching}
          onClick={() => onPage(page + 1)}
        >
          Далее
        </Button>
      </div>
    </>
  );
}
