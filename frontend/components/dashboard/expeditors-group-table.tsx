"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { Download, RotateCcw } from "lucide-react";

export type ExpeditorGroupRow = {
  name: string;
  code: string | null;
  delivered_orders: number;
  delivered_sum: string;
  returned_sum: string;
  payments_collected: string;
  debt: string;
};

export type ExpeditorStatusRow = {
  name: string;
  code: string | null;
  delivered_orders: number;
  delivered_sum: string;
  by_status: Record<string, string>;
  by_status_days?: Record<string, number>;
};

export type ExpeditorDim = "filial" | "supervisor" | "agent" | "expeditor";

const DIMS: Array<{ id: ExpeditorDim; label: string; header: string }> = [
  { id: "filial", label: "По филиалам", header: "Филиал" },
  { id: "supervisor", label: "По СВР", header: "СВР" },
  { id: "agent", label: "По агентам", header: "Агент" },
  { id: "expeditor", label: "По доставщикам", header: "Доставщик" }
];

const STATUS_COLS = [
  { key: "new", label: "Новый" },
  { key: "confirmed", label: "Подтверждён" },
  { key: "picking", label: "Комплектация" },
  { key: "delivering", label: "Отгружен" },
  { key: "returned", label: "Возврат" },
  { key: "cancelled", label: "Отменён" }
];

function money(v: string | number) {
  return formatNumberGrouped(String(v), { maxFractionDigits: 0 });
}

function cell(amount: string | undefined, days: number | undefined) {
  const n = Number(amount) || 0;
  if (n <= 0) return "—";
  const d = days && days > 0 ? days : 1;
  return `${money(n)} · ${d} дн`;
}

function downloadCsv(title: string, header: string[], lines: string[][]) {
  const body = [header.join(";"), ...lines.map((l) => l.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function DeliveredTable({ header, rows }: { header: string; rows: ExpeditorGroupRow[] }) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.orders += r.delivered_orders;
      acc.sum += Number(r.delivered_sum) || 0;
      return acc;
    },
    { orders: 0, sum: 0 }
  );
  return (
    <div className="overflow-auto rounded border">
      <table className="w-full min-w-[480px] border-collapse text-xs">
        <thead className="app-table-thead">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{header}</th>
            <th className="px-3 py-2 text-right font-medium">Доставлено (шт)</th>
            <th className="px-3 py-2 text-right font-medium">Доставлено (сумма)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.name}-${r.code ?? ""}`} className="border-t border-border/60">
              <td className="px-3 py-2">
                <div className="font-medium">{r.name}</div>
                {r.code ? <div className="text-[11px] text-muted-foreground">{r.code}</div> : null}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.delivered_orders}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(r.delivered_sum)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/30 font-semibold">
            <td className="px-3 py-2">Итого</td>
            <td className="px-3 py-2 text-right tabular-nums">{totals.orders}</td>
            <td className="px-3 py-2 text-right tabular-nums">{money(totals.sum)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OverdueTable({ header, rows }: { header: string; rows: ExpeditorStatusRow[] }) {
  return (
    <div className="overflow-auto rounded border">
      <table className="w-full min-w-[980px] border-collapse text-xs">
        <thead className="app-table-thead">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{header}</th>
            {STATUS_COLS.map((c) => (
              <th key={c.key} className="px-3 py-2 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.name}-${r.code ?? ""}`} className="border-t border-border/60">
              <td className="px-3 py-2">
                <div className="font-medium">{r.name}</div>
                {r.code ? <div className="text-[11px] text-muted-foreground">{r.code}</div> : null}
              </td>
              {STATUS_COLS.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {cell(r.by_status[c.key], r.by_status_days?.[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExpeditorDimBoard({
  groups,
  statuses,
  loading,
  onRefresh
}: {
  groups: Record<ExpeditorDim, ExpeditorGroupRow[]>;
  statuses: Record<ExpeditorDim, ExpeditorStatusRow[]>;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Доставлено</h2>
        {onRefresh ? (
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {DIMS.map((d) => {
          const rows = groups[d.id] ?? [];
          return (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">{d.label}</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={rows.length === 0}
                  onClick={() =>
                    downloadCsv(
                      d.label,
                      [d.header, "Доставлено шт", "Доставлено сумма"],
                      rows.map((r) => [r.name, String(r.delivered_orders), String(Math.round(Number(r.delivered_sum) || 0))])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Excel
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Нет доставленных за период</p>
                ) : (
                  <DeliveredTable header={d.header} rows={rows} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="text-base font-semibold">Дольше 1 дня, не доставлено</h2>
      <p className="text-xs text-muted-foreground">Сумма и срок в днях с момента создания. Минимум — больше 1 дня.</p>
      <div className="grid gap-4">
        {DIMS.map((d) => {
          const rows = (statuses[d.id] ?? []).filter((r) =>
            STATUS_COLS.some((c) => Number(r.by_status[c.key]) > 0)
          );
          return (
            <Card key={`st-${d.id}`}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">{d.label}</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={rows.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `${d.label} старше 1 дня`,
                      [d.header, ...STATUS_COLS.flatMap((c) => [c.label, `${c.label} дни`])],
                      rows.map((r) => [
                        r.name,
                        ...STATUS_COLS.flatMap((c) => [
                          String(Math.round(Number(r.by_status[c.key]) || 0)),
                          String(r.by_status_days?.[c.key] ?? 0)
                        ])
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Excel
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Нет заказов старше 1 дня</p>
                ) : (
                  <OverdueTable header={d.header} rows={rows} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
