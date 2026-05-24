"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import type { SalesTableColumn } from "@/components/dashboard/sales/sales-data-table";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { useMemo } from "react";

type CategoryRow = SalesDashboardSnapshot["category_performance_table"][number];
type TerritoryRow = SalesDashboardSnapshot["territory_analytics"][number];
type AgentRow = SalesDashboardSnapshot["agent_analytics"][number];

export function useSalesCategoryColumns(data: CategoryRow[]) {
  return useMemo(() => {
    const totals = {
      sales: data.reduce((s, i) => s + Number(i.sales_sum), 0),
      quantity: data.reduce((s, i) => s + Number(i.sold_qty), 0),
      volume: data.reduce((s, i) => s + Number(i.volume), 0),
      akb: data.reduce((s, i) => s + i.akb, 0)
    };
    const cols: SalesTableColumn<CategoryRow>[] = [
      {
        id: "category",
        header: "Названия",
        footer: "Итого",
        searchText: (r) => r.category,
        cell: (r) => <span className="font-medium text-slate-800">{r.category}</span>
      },
      {
        id: "sales_sum",
        header: "Сумма продаж",
        footer: fmtMoney(totals.sales),
        cell: (r) => <span className="tabular-nums">{fmtMoney(r.sales_sum)}</span>
      },
      {
        id: "sold_qty",
        header: "Кол-во",
        footer: fmtCount(totals.quantity),
        cell: (r) => fmtCount(r.sold_qty)
      },
      {
        id: "volume",
        header: "Объем",
        footer: fmtCount(totals.volume),
        cell: (r) => fmtCount(r.volume)
      },
      {
        id: "akb",
        header: "АКБ",
        footer: fmtCount(totals.akb),
        cell: (r) => fmtCount(r.akb)
      },
      {
        id: "share_pct",
        header: "Доля",
        footer: "100 %",
        cell: (r) => `${r.share_pct.toFixed(2)} %`
      }
    ];
    return cols;
  }, [data]);
}

export function useSalesCoverageColumns(data: CategoryRow[]) {
  return useMemo(() => {
    const cols: SalesTableColumn<CategoryRow>[] = [
      {
        id: "category",
        header: "По категориям",
        searchText: (r) => r.category,
        cell: (r) => <span className="font-semibold">{r.category}</span>
      },
      {
        id: "akb",
        header: "АКБ",
        cell: (r) => fmtCount(r.akb)
      },
      {
        id: "share_pct",
        header: "Процент",
        cell: (r) => `${r.share_pct.toFixed(1)} %`
      },
      {
        id: "sales_sum",
        header: "Сумма продаж",
        cell: (r) => fmtMoney(r.sales_sum)
      }
    ];
    return cols;
  }, [data]);
}

export function useSalesTerritoryColumns(resolveTerritory: (t: string) => string) {
  return useMemo(() => {
    const cols: SalesTableColumn<TerritoryRow>[] = [
      {
        id: "territory",
        header: "Название",
        searchText: (r) => resolveTerritory(r.territory),
        cell: (r) => (
          <span className="font-semibold text-slate-800">{resolveTerritory(r.territory)}</span>
        )
      },
      {
        id: "sales_sum",
        header: "Сумма продаж",
        cell: (r) => fmtMoney(r.sales_sum)
      },
      {
        id: "akb",
        header: "АКБ",
        cell: (r) => fmtCount(r.akb)
      },
      {
        id: "okb",
        header: "ОКБ",
        cell: (r) => fmtCount(r.okb)
      },
      {
        id: "coverage_pct",
        header: "Процент ОКБ",
        cell: (r) => `${r.coverage_pct.toFixed(1)} %`
      }
    ];
    return cols;
  }, [resolveTerritory]);
}

export function useSalesAgentColumns() {
  return useMemo(() => {
    const cols: SalesTableColumn<AgentRow>[] = [
      {
        id: "agent_name",
        header: "Агент",
        searchText: (r) => `${r.agent_name} ${r.agent_code ?? ""}`,
        cell: (r) => (
          <span className="block max-w-[260px] whitespace-normal font-medium leading-5 text-slate-800">
            {r.agent_name}
          </span>
        )
      },
      {
        id: "agent_code",
        header: "Код агента",
        cell: (r) => <span className="font-mono text-xs text-slate-600">{r.agent_code ?? "—"}</span>
      },
      {
        id: "sales_sum",
        header: "Сумма продаж",
        cell: (r) => fmtMoney(r.sales_sum)
      },
      {
        id: "akb",
        header: "АКБ",
        cell: (r) => fmtCount(r.akb)
      },
      {
        id: "okb",
        header: "ОКБ",
        cell: (r) => fmtCount(r.okb)
      }
    ];
    return cols;
  }, []);
}
