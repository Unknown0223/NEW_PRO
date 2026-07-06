"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  RotateCcw,
  Truck,
  PackageCheck,
  Undo2,
  Wallet,
  AlertTriangle
} from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

type ExpeditorRow = {
  expeditor_user_id: number;
  expeditor_name: string;
  expeditor_code: string | null;
  total_orders: number;
  delivered_orders: number;
  delivered_sum: string;
  returned_orders: number;
  returned_sum: string;
  payments_collected: string;
  debt: string;
};

type DashboardPayload = {
  date_from: string;
  date_to: string;
  rows: ExpeditorRow[];
  totals: {
    expeditors_count: number;
    total_orders: number;
    delivered_orders: number;
    delivered_sum: string;
    returned_orders: number;
    returned_sum: string;
    payments_collected: string;
    debt: string;
  };
  expeditors: Array<{ id: number; name: string; code: string | null }>;
};

function money(v: string | number) {
  return formatNumberGrouped(String(v), { maxFractionDigits: 0 });
}

type SortKey =
  | "delivered_sum"
  | "delivered_orders"
  | "returned_sum"
  | "payments_collected"
  | "debt"
  | "expeditor_name";

export default function ExpeditorsDashboardPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const today = new Date();
  const to0 = today.toISOString().slice(0, 10);
  const from0 = new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);

  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const [draft, setDraft] = useState({ from: from0, to: to0, expeditor_ids: [] as string[] });
  const [applied, setApplied] = useState({ from: from0, to: to0, expeditor_ids: [] as string[] });
  const [sortBy, setSortBy] = useState<SortKey>("delivered_sum");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const dashQ = useQuery({
    queryKey: ["dashboard-expeditors", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("date_from", applied.from);
      p.set("date_to", applied.to);
      if (applied.expeditor_ids.length) p.set("expeditor_ids", applied.expeditor_ids.join(","));
      const { data } = await api.get<DashboardPayload>(
        `/api/${tenantSlug}/dashboard/expeditors?${p.toString()}`
      );
      return data;
    }
  });

  const data = dashQ.data;
  const expeditorItems = (data?.expeditors ?? []).map((x) => ({
    id: String(x.id),
    title: `${x.name}${x.code ? ` (${x.code})` : ""}`
  }));

  const sortedRows = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    rows.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortBy === "expeditor_name") {
        av = a.expeditor_name.toLowerCase();
        bv = b.expeditor_name.toLowerCase();
        return av < bv ? -1 * sortDir : av > bv ? 1 * sortDir : 0;
      }
      av = Number(a[sortBy] ?? 0);
      bv = Number(b[sortBy] ?? 0);
      return (av - bv) * sortDir;
    });
    return rows;
  }, [data?.rows, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortBy(key);
      setSortDir(key === "expeditor_name" ? 1 : -1);
    }
  };

  const applyDraft = () => setApplied({ ...draft });
  const resetAll = () => {
    const reset = { from: from0, to: to0, expeditor_ids: [] as string[] };
    setDraft(reset);
    setApplied(reset);
  };

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  const periodBtn = formatDateRangeButton(draft.from, draft.to);
  const t = data?.totals;

  const kpis = [
    {
      label: "Доставщиков",
      value: String(t?.expeditors_count ?? 0),
      icon: Truck,
      color: "text-sky-600",
      bg: "bg-sky-50"
    },
    {
      label: "Доставлено (сумма)",
      value: money(t?.delivered_sum ?? 0),
      sub: `${t?.delivered_orders ?? 0} заказ(ов)`,
      icon: PackageCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      label: "Возвраты (сумма)",
      value: money(t?.returned_sum ?? 0),
      sub: `${t?.returned_orders ?? 0} заказ(ов)`,
      icon: Undo2,
      color: "text-orange-600",
      bg: "bg-orange-50"
    },
    {
      label: "Собрано оплат",
      value: money(t?.payments_collected ?? 0),
      icon: Wallet,
      color: "text-violet-600",
      bg: "bg-violet-50"
    },
    {
      label: "Долг (доставлено)",
      value: money(t?.debt ?? 0),
      icon: AlertTriangle,
      color: "text-rose-600",
      bg: "bg-rose-50"
    }
  ];

  const headers: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
    { key: "expeditor_name", label: "Доставщик" },
    { key: "delivered_orders", label: "Доставлено (шт)", numeric: true },
    { key: "delivered_sum", label: "Доставлено (сумма)", numeric: true },
    { key: "returned_sum", label: "Возврат (сумма)", numeric: true },
    { key: "payments_collected", label: "Собрано оплат", numeric: true },
    { key: "debt", label: "Долг", numeric: true }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Доставщики</h1>
          <p className="text-xs text-muted-foreground">
            Данные по доставщикам: доставка, возвраты, оплаты, долги
          </p>
        </div>
        <button
          ref={dateAnchorRef}
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-9 shrink-0 gap-2 font-normal",
            dateOpen && "border-primary/60 bg-primary/5"
          )}
          aria-expanded={dateOpen}
          aria-haspopup="dialog"
          onClick={() => setDateOpen((o) => !o)}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium tabular-nums">{periodBtn}</span>
        </button>
      </div>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.from}
        dateTo={draft.to}
        onApply={({ dateFrom, dateTo }) => setDraft((d) => ({ ...d, from: dateFrom, to: dateTo }))}
      />

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Фильтр</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2 pt-0">
          <div className="min-w-[220px] max-w-xs flex-1">
            <SearchableMultiSelectPanel
              label="Доставщик"
              hideOuterLabel
              hidePopoverHeader
              triggerPlaceholder="Все доставщики"
              items={expeditorItems}
              selected={new Set(draft.expeditor_ids)}
              onSelectedChange={(next) => {
                const resolved =
                  typeof next === "function" ? next(new Set(draft.expeditor_ids)) : next;
                setDraft((d) => ({ ...d, expeditor_ids: Array.from(resolved) }));
              }}
              searchable
              searchPlaceholder="Доставщик"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetAll}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Сброс
          </Button>
          <Button type="button" size="sm" className="h-8 min-w-[120px] text-xs" onClick={applyDraft}>
            Применить
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", k.bg)}>
                <k.icon className={cn("h-5 w-5", k.color)} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-muted-foreground">{k.label}</p>
                <p className="truncate text-lg font-semibold tabular-nums">{k.value}</p>
                {k.sub ? <p className="truncate text-[11px] text-muted-foreground">{k.sub}</p> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
          <CardTitle className="text-base">По доставщикам</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => void dashQ.refetch()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          {dashQ.isError ? (
            <p className="text-sm text-destructive">Ошибка загрузки</p>
          ) : dashQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : sortedRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Нет данных за период</p>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead className="app-table-thead">
                  <tr>
                    {headers.map((h) => (
                      <th
                        key={h.key}
                        className={cn(
                          "cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium hover:bg-muted/40",
                          h.numeric ? "text-right" : "text-left"
                        )}
                        onClick={() => toggleSort(h.key)}
                      >
                        {h.label}
                        {sortBy === h.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.expeditor_user_id} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.expeditor_name}</div>
                        {r.expeditor_code ? (
                          <div className="text-[11px] text-muted-foreground">{r.expeditor_code}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.delivered_orders}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.delivered_sum)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-orange-600">
                        {money(r.returned_sum)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-violet-600">
                        {money(r.payments_collected)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          Number(r.debt) > 0 ? "font-medium text-rose-600" : "text-muted-foreground"
                        )}
                      >
                        {money(r.debt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {t ? (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-3 py-2">Итого</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.delivered_orders}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(t.delivered_sum)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(t.returned_sum)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(t.payments_collected)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(t.debt)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
