"use client";

import { formatNumberGrouped } from "@/lib/format-numbers";

export type P1Metric = { akb: number; qty: string; total: string };
export type P1MonthCol = { key: string; year: number; label: string; kind: "month" | "quarter" | "year" };
export type P1Row = {
  kind: "grand_total" | "region" | "product";
  region_key: string;
  region_label: string;
  product_id: number | null;
  product_name: string | null;
  cells: Record<string, P1Metric>;
  yoy: Record<string, { total: number | null }>;
};

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

export function P1ReportTable({
  rows,
  months,
  year,
  showYoy,
  loading,
  emptyHint
}: {
  rows: P1Row[];
  months: P1MonthCol[];
  year: number;
  showYoy: boolean;
  loading: boolean;
  emptyHint?: string;
}) {
  return (
    <div className="h-full min-h-[280px] overflow-auto">
      <table className="min-w-max border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/70">
            <th className="sticky left-0 z-20 border-b border-r bg-muted/70 px-2.5 py-2 text-left font-medium">
              Область
            </th>
            <th className="sticky left-[10rem] z-20 border-b border-r bg-muted/70 px-2.5 py-2 text-left font-medium">
              Продукт
            </th>
            {months.map((m) => (
              <th
                key={m.key}
                colSpan={showYoy && m.year === year ? 4 : 3}
                className="border-b border-l px-2 py-2 text-center font-medium"
              >
                {m.label}
              </th>
            ))}
          </tr>
          <tr className="bg-muted/40">
            <th className="sticky left-0 z-20 border-b border-r bg-muted/40 px-2 py-1" />
            <th className="sticky left-[10rem] z-20 border-b border-r bg-muted/40 px-2 py-1" />
            {months.map((m) => (
              <MetricHeads key={`${m.key}-h`} showYoy={showYoy && m.year === year} />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-10 text-muted-foreground" colSpan={40}>
                Загрузка…
              </td>
            </tr>
          ) : null}
          {!loading && !rows.length ? (
            <tr>
              <td className="px-4 py-10 text-muted-foreground" colSpan={40}>
                <div className="max-w-lg space-y-1">
                  <p className="font-medium text-foreground/80">Нет данных за период</p>
                  <p className="text-[11px] leading-relaxed">
                    {emptyHint ?? "Ослабьте фильтры или смените год / тип даты."}
                  </p>
                </div>
              </td>
            </tr>
          ) : null}
          {rows.map((row, idx) => (
            <tr
              key={`${row.kind}-${row.region_key}-${row.product_id ?? "r"}-${idx}`}
              className={
                row.kind === "grand_total"
                  ? "bg-amber-50/90 font-semibold"
                  : row.kind === "region"
                    ? "bg-slate-50/90 font-medium"
                    : "odd:bg-background even:bg-muted/20"
              }
            >
              <td className="sticky left-0 z-[1] w-40 max-w-[10rem] truncate border-b border-r bg-inherit px-2.5 py-1.5">
                {row.region_label}
              </td>
              <td className="sticky left-[10rem] z-[1] min-w-[12rem] border-b border-r bg-inherit px-2.5 py-1.5">
                {row.kind === "region" ? "Продукт" : (row.product_name ?? "")}
              </td>
              {months.map((m) => (
                <MetricCells
                  key={`${row.region_key}-${row.product_id}-${m.key}`}
                  cell={row.cells[m.key]}
                  yoyTotal={row.yoy[m.key]?.total ?? null}
                  showYoy={showYoy && m.year === year}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricHeads({ showYoy }: { showYoy: boolean }) {
  return (
    <>
      <th className="border-b border-l px-1.5 py-1 font-normal text-muted-foreground">АКБ</th>
      <th className="border-b px-1.5 py-1 font-normal text-muted-foreground">Кол-во</th>
      <th className="border-b px-1.5 py-1 font-normal text-muted-foreground">Сумма</th>
      {showYoy ? <th className="border-b px-1.5 py-1 font-normal text-muted-foreground">YoY</th> : null}
    </>
  );
}

function MetricCells({
  cell,
  yoyTotal,
  showYoy
}: {
  cell?: P1Metric;
  yoyTotal: number | null;
  showYoy: boolean;
}) {
  return (
    <>
      <td className="border-b border-l px-1.5 py-1.5 text-right tabular-nums">{cell ? cell.akb : "—"}</td>
      <td className="border-b px-1.5 py-1.5 text-right tabular-nums">{cell ? qtyFmt(cell.qty) : "—"}</td>
      <td className="border-b px-1.5 py-1.5 text-right tabular-nums">{cell ? money(cell.total) : "—"}</td>
      {showYoy ? (
        <td className="border-b px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">{pct(yoyTotal)}</td>
      ) : null}
    </>
  );
}
