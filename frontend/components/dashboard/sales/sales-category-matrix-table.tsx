"use client";

import { fmtCount } from "@/components/dashboard/sales/format";
import { SalesDataTable, type SalesTableColumn } from "@/components/dashboard/sales/sales-data-table";
import type { CategoryMatrixRow, SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type Dim = "filial" | "supervisor" | "agent";

const DIMS: Array<{ id: Dim; label: string }> = [
  { id: "filial", label: "Филиал" },
  { id: "supervisor", label: "СВР" },
  { id: "agent", label: "Агент" }
];

function whole(v: string | number | undefined) {
  return fmtCount(Math.round(Number(v) || 0));
}

export function SalesCategoryMatrixTable({
  data,
  className
}: {
  data: SalesDashboardSnapshot;
  className?: string;
}) {
  const [dim, setDim] = useState<Dim>("filial");
  const matrix = data.category_matrix;
  const rows = matrix?.by_dimension[dim] ?? [];
  const categories = matrix?.categories ?? [];
  const dimLabel = DIMS.find((d) => d.id === dim)?.label ?? "Филиал";

  const columns = useMemo(() => {
    const cols: SalesTableColumn<CategoryMatrixRow>[] = [
      {
        id: "name",
        header: dimLabel,
        searchText: (r) => r.name,
        sortValue: (r) => r.name,
        cell: (r) => <span className="font-semibold text-slate-800">{r.name}</span>
      },
      {
        id: "smart_code",
        header: "Смарт-код",
        searchText: (r) => r.smart_code,
        sortValue: (r) => r.smart_code,
        cell: (r) => <span className="tabular-nums text-slate-600">{r.smart_code || "—"}</span>
      },
      {
        id: "total",
        header: "Общая сумма",
        sortValue: (r) => Number(r.total) || 0,
        cell: (r) => <span className="font-medium tabular-nums">{whole(r.total)}</span>
      },
      ...categories.map((cat) => ({
        id: `cat:${cat}`,
        header: cat,
        sortValue: (r: CategoryMatrixRow) => Number(r.amounts[cat]) || 0,
        searchText: (r: CategoryMatrixRow) => cat,
        cell: (r: CategoryMatrixRow) => <span className="tabular-nums">{whole(r.amounts[cat])}</span>
      })),
      {
        id: "akb",
        header: "АКБ",
        sortValue: (r) => r.akb,
        cell: (r) => <span className="tabular-nums">{fmtCount(r.akb)}</span>
      }
    ];
    return cols;
  }, [categories, dimLabel]);

  return (
    <SalesDataTable
      title="Продажи по категориям"
      className={className}
      data={rows}
      columns={columns}
      rowKey={(r) => r.key}
      initialPageSize={10}
      compact
      action={
        <div className="flex rounded-lg bg-muted/70 p-0.5" role="group" aria-label="Группировка">
          {DIMS.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={dim === d.id}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold",
                dim === d.id ? "bg-teal-700 text-white" : "text-slate-600 hover:text-slate-900"
              )}
              onClick={() => setDim(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
