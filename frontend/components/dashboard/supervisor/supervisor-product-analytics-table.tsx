"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { formatNumberGrouped } from "@/lib/format-numbers";
import {
  SupervisorEnterpriseTableWrap,
  SupervisorEnterpriseToolbar
} from "./supervisor-enterprise-ui";
import * as XLSX from "xlsx";

export type ProductAnalyticsRow = {
  dimension: string;
  share_pct: number;
  revenue: string;
  quantity: string;
  akb: number;
};

export function SupervisorProductAnalyticsTable({
  rows,
  dimensionLabel
}: {
  rows: ProductAnalyticsRow[];
  /** Sarlavha ustuni: «Категория» / «Группа» / «Бренд» */
  dimensionLabel: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.dimension.toLowerCase().includes(q));
  }, [rows, search]);

  const exportExcel = () => {
    const aoa = [
      [dimensionLabel, "Доля %", "Сумма", "Объем", "АКБ"],
      ...filtered.map((r) => [r.dimension, r.share_pct, r.revenue, r.quantity, r.akb])
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Показатели");
    XLSX.writeFile(wb, "klyuchevye-pokazateli.xlsx");
  };

  return (
    <div className="space-y-0">
      <SupervisorEnterpriseToolbar
        search={search}
        onSearchChange={setSearch}
        onExcel={exportExcel}
        totalCount={filtered.length}
      />
      <SupervisorEnterpriseTableWrap>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {dimensionLabel}
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Доля
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Сумма
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Объем
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                АКБ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border">
            {filtered.map((row, i) => (
              <tr
                key={`${row.dimension}-${i}`}
                className="transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/20"
              >
                <td className="px-5 py-3.5 font-medium text-foreground">{row.dimension}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className="inline-flex rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                    {row.share_pct}%
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                  {formatNumberGrouped(row.revenue, { maxFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                  {formatNumberGrouped(row.quantity, { maxFractionDigits: 3 })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <Users className="h-3 w-3" aria-hidden />
                    {row.akb}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  Нет данных
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </SupervisorEnterpriseTableWrap>
    </div>
  );
}

export function analyticsDimensionLabel(tab: string): string {
  if (tab === "group") return "Группа";
  if (tab === "brand") return "Бренд";
  return "Категория";
}
