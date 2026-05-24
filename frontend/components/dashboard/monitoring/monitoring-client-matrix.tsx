"use client";

import { MonitoringClientDayColumnTotalsChart } from "@/components/charts/analytics-charts-lazy";
import { MATRIX_DAYS_PER_WEEK } from "@/components/dashboard/monitoring/client-day-matrix";
import type { ClientDayMatrix } from "@/components/dashboard/monitoring/client-day-matrix";
import { MonitoringTablePager } from "@/components/dashboard/monitoring/monitoring-table-pager";
import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import {
  fmtMoney,
  matrixCellHeatStyle,
  matrixDayHeaderParts,
  num
} from "@/components/dashboard/monitoring/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const theadSticky = "sticky top-0 z-20 border-b border-border bg-muted/95 backdrop-blur-sm shadow-sm";
const tableWrap = "relative overflow-auto rounded-md border border-border";

export function MonitoringClientMatrix({ clientMatrix }: { clientMatrix: ClientDayMatrix }) {
  const [matrixClientSearch, setMatrixClientSearch] = useState("");
  const [matrixWeekIndex, setMatrixWeekIndex] = useState(0);
  const [matrixPage, setMatrixPage] = useState(0);
  const [matrixPageSize, setMatrixPageSize] = useState(10);

  const matrixStats = useMemo(() => {
    const colTotals = new Map<string, number>();
    const activeDays = new Map<number, number>();
    let maxCell = 0;
    for (const c of clientMatrix.clients) {
      let daysWithSale = 0;
      for (const day of clientMatrix.days) {
        const v = num(c.cells.get(day) ?? 0);
        if (v > 0) daysWithSale += 1;
        colTotals.set(day, (colTotals.get(day) ?? 0) + v);
        if (v > maxCell) maxCell = v;
      }
      activeDays.set(c.id, daysWithSale);
    }
    return { colTotals, activeDays, maxCell };
  }, [clientMatrix]);

  const matrixFilteredClients = useMemo(() => {
    const q = matrixClientSearch.trim().toLowerCase();
    if (!q) return clientMatrix.clients;
    return clientMatrix.clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientMatrix.clients, matrixClientSearch]);

  const matrixWeekCount = Math.max(1, Math.ceil(clientMatrix.days.length / MATRIX_DAYS_PER_WEEK));
  const matrixWeekSafe = Math.min(matrixWeekIndex, matrixWeekCount - 1);
  const matrixWeekDaySlice = useMemo(() => {
    const start = matrixWeekSafe * MATRIX_DAYS_PER_WEEK;
    return clientMatrix.days.slice(start, start + MATRIX_DAYS_PER_WEEK);
  }, [clientMatrix.days, matrixWeekSafe]);

  useEffect(() => {
    setMatrixWeekIndex((w) => Math.min(w, Math.max(0, matrixWeekCount - 1)));
  }, [clientMatrix.days.length, matrixWeekCount]);

  const matrixTotalRows = matrixFilteredClients.length;
  const matrixTotalPages = Math.max(1, Math.ceil(matrixTotalRows / matrixPageSize));
  const matrixPageSafe = Math.min(matrixPage, matrixTotalPages - 1);
  const matrixVisibleClients = useMemo(
    () => matrixFilteredClients.slice(matrixPageSafe * matrixPageSize, (matrixPageSafe + 1) * matrixPageSize),
    [matrixFilteredClients, matrixPageSafe, matrixPageSize]
  );

  const matrixWeekChartSeries = useMemo(
    () =>
      matrixWeekDaySlice.map((day) => {
        const { ddmm } = matrixDayHeaderParts(day);
        return {
          dayKey: day,
          label: ddmm,
          total: matrixStats.colTotals.get(day) ?? 0
        };
      }),
    [matrixWeekDaySlice, matrixStats.colTotals]
  );

  const matrixWeekColGrand = useMemo(
    () => matrixWeekDaySlice.reduce((s, day) => s + (matrixStats.colTotals.get(day) ?? 0), 0),
    [matrixWeekDaySlice, matrixStats.colTotals]
  );

  const matrixWeekGlobalMax = useMemo(() => {
    let m = 0;
    for (const c of matrixVisibleClients) {
      for (const day of matrixWeekDaySlice) {
        m = Math.max(m, num(c.cells.get(day) ?? 0));
      }
    }
    return m;
  }, [matrixVisibleClients, matrixWeekDaySlice]);

  const matrixMinW = 200 + Math.max(matrixWeekDaySlice.length, 1) * 76 + 92;

  return (
    <SalesSectionPanel
      className="sales-motion-delay-250"
      title="Клиент × день"
      subtitle="Тепловая карта продаж по неделям месяца"
      action={
        <div className="w-full sm:w-[min(100%,260px)]">
          <Label htmlFor="matrix-client-search" className="mb-1.5 block text-xs text-muted-foreground">
            Клиент
          </Label>
          <Input
            id="matrix-client-search"
            placeholder="Поиск по названию…"
            value={matrixClientSearch}
            onChange={(e) => {
              setMatrixClientSearch(e.target.value);
              setMatrixPage(0);
            }}
            className="h-9 text-sm"
            autoComplete="off"
          />
        </div>
      }
    >
      <p className="mb-3 text-[11px] text-muted-foreground">
        {clientMatrix.clients.length} клиентов · {clientMatrix.days.length} дн. · неделя {matrixWeekSafe + 1}/{matrixWeekCount}
      </p>

      {clientMatrix.clients.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Нет пар «клиент × день» за выбранный период.
        </div>
      ) : matrixFilteredClients.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          По запросу клиенты не найдены.
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 xl:grid-cols-2 xl:items-stretch">
          <div className="flex min-h-[min(420px,58vh)] flex-col overflow-hidden rounded-lg border border-border/80 bg-background p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Неделя {matrixWeekSafe + 1}</span>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={matrixWeekSafe <= 0} onClick={() => setMatrixWeekIndex((w) => Math.max(0, w - 1))}>←</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={matrixWeekSafe >= matrixWeekCount - 1} onClick={() => setMatrixWeekIndex((w) => Math.min(matrixWeekCount - 1, w + 1))}>→</Button>
              </div>
            </div>
            <div className={cn(tableWrap, "min-h-0 flex-1 max-h-[min(480px,55vh)]")}>
              <table className="border-collapse text-sm" style={{ minWidth: Math.max(matrixMinW, 520) }}>
                <thead className={theadSticky}>
                  <tr>
                    <th className="sticky left-0 z-30 min-w-[200px] border-r bg-muted/95 px-3 py-2 text-left text-xs font-medium">Клиент</th>
                    {matrixWeekDaySlice.map((day) => {
                      const { ddmm, weekday } = matrixDayHeaderParts(day);
                      return (
                        <th key={day} className="min-w-[76px] px-0.5 py-2 text-center text-[11px]">
                          <span className="block font-semibold">{ddmm}</span>
                          {weekday ? <span className="mt-0.5 block text-[9px] capitalize">{weekday}</span> : null}
                        </th>
                      );
                    })}
                    <th className="sticky right-0 z-30 min-w-[92px] border-l bg-muted/95 px-2 py-2 text-right text-[10px]">Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixVisibleClients.map((c) => {
                    const rowWeekTot = matrixWeekDaySlice.reduce((s, day) => s + num(c.cells.get(day) ?? 0), 0);
                    const rowWeekMax = matrixWeekDaySlice.reduce((m, day) => Math.max(m, num(c.cells.get(day) ?? 0)), 0);
                    return (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="sticky left-0 z-10 max-w-[200px] truncate border-r bg-background/95 px-3 py-1.5 font-medium" title={c.name}>
                          {c.name}
                        </td>
                        {matrixWeekDaySlice.map((day) => {
                          const cell = c.cells.get(day);
                          const n = cell ? num(cell) : 0;
                          return (
                            <td
                              key={day}
                              className={cn("px-0.5 py-1 text-right text-[10px] tabular-nums", n > 0 ? "font-medium" : "text-muted-foreground")}
                              style={matrixCellHeatStyle(n, rowWeekMax, Math.max(matrixWeekGlobalMax, 1e-9))}
                              title={n > 0 ? `${c.name} · ${fmtMoney(cell!)}` : undefined}
                            >
                              {cell ? fmtMoney(cell) : "—"}
                            </td>
                          );
                        })}
                        <td className="sticky right-0 z-10 border-l bg-muted/20 px-2 py-1.5 text-right text-xs font-semibold tabular-nums">
                          {fmtMoney(rowWeekTot)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MonitoringTablePager total={matrixTotalRows} page={matrixPageSafe} pageSize={matrixPageSize} onPageChange={setMatrixPage} onPageSizeChange={(s) => { setMatrixPageSize(s); setMatrixPage(0); }} />
          </div>
          <div className="flex min-h-[280px] flex-col justify-center rounded-lg border border-border/80 p-3">
            <MonitoringClientDayColumnTotalsChart daySeries={matrixWeekChartSeries} height={320} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Итого за неделю: {fmtMoney(matrixWeekColGrand)}</p>
          </div>
        </div>
      )}
    </SalesSectionPanel>
  );
}
