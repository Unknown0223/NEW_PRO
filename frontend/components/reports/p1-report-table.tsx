"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

export type P1Metric = { akb: number; qty: string; total: string };
export type P1MonthCol = {
  key: string;
  year: number;
  month?: number;
  label: string;
  kind: "month" | "quarter" | "year";
};
export type P1Row = {
  kind: "grand_total" | "region" | "product";
  region_key: string;
  region_label: string;
  product_id: number | null;
  product_name: string | null;
  cells: Record<string, P1Metric>;
  yoy: Record<string, { total: number | null }>;
};

type PeriodGroup = {
  id: string;
  title: string;
  kind: "month" | "quarter" | "year";
  ly?: P1MonthCol;
  cy?: P1MonthCol;
};

const MONTH_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const STICKY_REGION =
  "sticky left-0 z-[2] w-44 max-w-[11rem] border-b border-r border-border";
const STICKY_PRODUCT =
  "sticky left-44 z-[2] min-w-[12rem] border-b border-r border-border shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]";
const STICKY_HEAD_REGION =
  "sticky left-0 z-30 w-44 max-w-[11rem] border-b border-r border-border bg-slate-100";
const STICKY_HEAD_PRODUCT =
  "sticky left-44 z-30 min-w-[12rem] border-b border-r border-border bg-slate-100 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]";

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}
function qtyFmt(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 1 });
}
function pct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function periodTitle(col: P1MonthCol): string {
  if (col.kind === "month") return MONTH_RU[(col.month ?? 1) - 1] ?? col.label;
  if (col.kind === "quarter") return `${col.month ?? ""} кв.`;
  return "Итого";
}

function rowSolidBg(kind: P1Row["kind"], odd: boolean): string {
  if (kind === "grand_total") return "bg-amber-50";
  if (kind === "region") return "bg-slate-100";
  return odd ? "bg-white" : "bg-slate-50";
}

/** Oy/chorak/yil jufti: o‘tgan yil | joriy yil | % к прошлому году */
export function groupP1Periods(months: P1MonthCol[], year: number, compareYear: number): PeriodGroup[] {
  const map = new Map<string, PeriodGroup>();
  const order: string[] = [];

  for (const col of months) {
    const id =
      col.kind === "month"
        ? `m-${col.month}`
        : col.kind === "quarter"
          ? `q-${col.month}`
          : "y";
    let g = map.get(id);
    if (!g) {
      g = { id, title: periodTitle(col), kind: col.kind };
      map.set(id, g);
      order.push(id);
    }
    if (col.year === compareYear) g.ly = col;
    if (col.year === year) g.cy = col;
  }
  return order.map((id) => map.get(id)!);
}

export function P1ReportTable({
  rows,
  months,
  year,
  compareYear,
  showYoy,
  loading,
  emptyHint
}: {
  rows: P1Row[];
  months: P1MonthCol[];
  year: number;
  compareYear: number;
  showYoy: boolean;
  loading: boolean;
  emptyHint?: string;
}) {
  const groups = useMemo(
    () => groupP1Periods(months, year, compareYear),
    [months, year, compareYear]
  );

  const regionKeys = useMemo(
    () => rows.filter((r) => r.kind === "region").map((r) => r.region_key),
    [rows]
  );
  const regionKeySig = regionKeys.join("\u0001");
  const [openRegion, setOpenRegion] = useState<string | null>(null);

  useEffect(() => {
    setOpenRegion(regionKeys[0] ?? null);
    // regionKeySig — yangi hisobotda birinchi viloyatni ochish
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat ro‘yxat o‘zgaganda
  }, [regionKeySig]);

  const productCountByRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.kind !== "product") continue;
      m.set(r.region_key, (m.get(r.region_key) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  let productOdd = false;

  return (
    <div className="h-full min-h-[280px] overflow-auto">
      <table className="min-w-max border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            <th rowSpan={3} className={cn(STICKY_HEAD_REGION, "px-2.5 py-2 text-left font-medium align-bottom")}>
              Область
            </th>
            <th rowSpan={3} className={cn(STICKY_HEAD_PRODUCT, "px-2.5 py-2 text-left font-medium align-bottom")}>
              Продукт
            </th>
            {groups.map((g) => {
              const span = (g.ly ? 3 : 0) + (g.cy ? 3 : 0) + (showYoy && g.cy ? 1 : 0);
              return (
                <th
                  key={g.id}
                  colSpan={Math.max(span, 1)}
                  className="border-b border-l border-border bg-slate-100 px-2 py-1.5 text-center text-[11px] font-semibold tracking-wide"
                >
                  {g.title}
                </th>
              );
            })}
          </tr>
          <tr>
            {groups.map((g) => (
              <YearPairHeads key={`${g.id}-y`} group={g} showYoy={showYoy} year={year} compareYear={compareYear} />
            ))}
          </tr>
          <tr>
            {groups.map((g) => (
              <MetricHeads key={`${g.id}-m`} group={g} showYoy={showYoy} />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="bg-white px-4 py-10 text-muted-foreground" colSpan={40}>
                Загрузка…
              </td>
            </tr>
          ) : null}
          {!loading && !rows.length ? (
            <tr>
              <td className="bg-white px-4 py-10 text-muted-foreground" colSpan={40}>
                <div className="max-w-lg space-y-1">
                  <p className="font-medium text-foreground/80">Нет данных за период</p>
                  <p className="text-[11px] leading-relaxed">
                    {emptyHint ?? "Ослабьте фильтры или смените год / тип даты."}
                  </p>
                </div>
              </td>
            </tr>
          ) : null}
          {rows.map((row, idx) => {
            if (row.kind === "product" && openRegion !== row.region_key) return null;

            const open = row.kind === "region" && openRegion === row.region_key;
            if (row.kind === "product") productOdd = !productOdd;
            const solid = rowSolidBg(row.kind, productOdd);
            const prodCount = productCountByRegion.get(row.region_key) ?? 0;

            return (
              <tr
                key={`${row.kind}-${row.region_key}-${row.product_id ?? "r"}-${idx}`}
                className={cn(solid, row.kind === "grand_total" && "font-semibold", row.kind === "region" && "font-medium")}
              >
                <td className={cn(STICKY_REGION, solid, "px-2.5 py-1.5")}>
                  {row.kind === "region" ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenRegion((prev) => (prev === row.region_key ? null : row.region_key))}
                      className="flex w-full max-w-full items-center gap-1 text-left hover:text-foreground"
                      title={open ? "Свернуть" : "Развернуть"}
                    >
                      <ChevronRight
                        className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                      />
                      <span className="truncate">{row.region_label}</span>
                    </button>
                  ) : row.kind === "grand_total" ? (
                    <span className="truncate font-semibold">{row.region_label}</span>
                  ) : null}
                </td>
                <td className={cn(STICKY_PRODUCT, solid, "px-2.5 py-1.5")}>
                  {row.kind === "region"
                    ? `${prodCount} тов.`
                    : row.kind === "grand_total"
                      ? ""
                      : (row.product_name ?? "")}
                </td>
                {groups.map((g) => (
                  <PeriodCells key={`${row.region_key}-${row.product_id}-${g.id}`} row={row} group={g} showYoy={showYoy} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YearPairHeads({
  group,
  showYoy,
  year,
  compareYear
}: {
  group: PeriodGroup;
  showYoy: boolean;
  year: number;
  compareYear: number;
}) {
  return (
    <>
      {group.ly ? (
        <th
          colSpan={3}
          className="border-b border-l border-border bg-slate-200 px-1 py-1 text-center text-[11px] font-semibold tabular-nums text-slate-700"
        >
          {compareYear}
        </th>
      ) : null}
      {group.cy ? (
        <th
          colSpan={3}
          className="border-b border-l border-border bg-sky-100 px-1 py-1 text-center text-[11px] font-semibold tabular-nums text-sky-900"
        >
          {year}
        </th>
      ) : null}
      {showYoy && group.cy ? (
        <th
          className="border-b border-l border-border bg-emerald-100 px-1 py-1 text-center text-[10px] font-medium leading-tight text-emerald-800"
          title="Процент к прошлому году: (текущий ÷ прошлый) − 1"
        >
          % к<br />
          пр. году
        </th>
      ) : null}
    </>
  );
}

function MetricHeads({ group, showYoy }: { group: PeriodGroup; showYoy: boolean }) {
  return (
    <>
      {group.ly ? <TripleMetricHeads tone="ly" /> : null}
      {group.cy ? <TripleMetricHeads tone="cy" /> : null}
      {showYoy && group.cy ? (
        <th
          className="border-b border-l border-border bg-emerald-50 px-1 py-0.5 font-normal text-[10px] text-muted-foreground"
          title="Динамика суммы к прошлому году"
        >
          %
        </th>
      ) : null}
    </>
  );
}

function TripleMetricHeads({ tone }: { tone: "ly" | "cy" }) {
  const bg = tone === "ly" ? "bg-slate-100" : "bg-sky-50";
  return (
    <>
      <th className={cn("border-b border-l border-border px-1.5 py-0.5 font-normal text-muted-foreground", bg)}>АКБ</th>
      <th className={cn("border-b border-border px-1.5 py-0.5 font-normal text-muted-foreground", bg)}>Кол-во</th>
      <th className={cn("border-b border-border px-1.5 py-0.5 font-normal text-muted-foreground", bg)}>Сумма</th>
    </>
  );
}

function PeriodCells({ row, group, showYoy }: { row: P1Row; group: PeriodGroup; showYoy: boolean }) {
  const yoyKey = group.cy?.key;
  return (
    <>
      {group.ly ? <MetricTriple cell={row.cells[group.ly.key]} tone="ly" /> : null}
      {group.cy ? <MetricTriple cell={row.cells[group.cy.key]} tone="cy" /> : null}
      {showYoy && group.cy ? (
        <td className="border-b border-l border-border bg-emerald-50/80 px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">
          {pct(yoyKey ? (row.yoy[yoyKey]?.total ?? null) : null)}
        </td>
      ) : null}
    </>
  );
}

function MetricTriple({ cell, tone }: { cell?: P1Metric; tone: "ly" | "cy" }) {
  const bg = tone === "ly" ? "bg-slate-50" : "bg-sky-50/80";
  return (
    <>
      <td className={cn("border-b border-l border-border px-1.5 py-1.5 text-right tabular-nums", bg)}>
        {cell ? cell.akb : "—"}
      </td>
      <td className={cn("border-b border-border px-1.5 py-1.5 text-right tabular-nums", bg)}>
        {cell ? qtyFmt(cell.qty) : "—"}
      </td>
      <td className={cn("border-b border-border px-1.5 py-1.5 text-right tabular-nums", bg)}>
        {cell ? money(cell.total) : "—"}
      </td>
    </>
  );
}
