"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { ExpeditorDimBoard, type ExpeditorDim, type ExpeditorGroupRow, type ExpeditorStatusRow } from "@/components/dashboard/expeditors-group-table";

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
  agents?: Array<{ id: number; name: string; code: string | null }>;
  supervisors?: Array<{ id: number; name: string; code: string | null }>;
  branches?: string[];
  by_filial?: Array<{
    name: string;
    code: string | null;
    delivered_orders: number;
    delivered_sum: string;
    returned_sum: string;
    payments_collected: string;
    debt: string;
  }>;
  by_supervisor?: DashboardPayload["by_filial"];
  by_agent?: DashboardPayload["by_filial"];
  status_by?: Record<ExpeditorDim, ExpeditorStatusRow[]>;
};

function money(v: string | number) {
  return formatNumberGrouped(String(v), { maxFractionDigits: 0 });
}

export default function ExpeditorsDashboardPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const { from: from0, to: to0 } = monthToDateRange();

  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const emptyPick = { expeditor_ids: [] as string[], agent_ids: [] as string[], supervisor_ids: [] as string[], branches: [] as string[] };
  const [draft, setDraft] = useState({ from: from0, to: to0, ...emptyPick });
  const [applied, setApplied] = useState({ from: from0, to: to0, ...emptyPick });
  const dashQ = useQuery({
    queryKey: ["dashboard-expeditors", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("date_from", applied.from);
      p.set("date_to", applied.to);
      if (applied.expeditor_ids.length) p.set("expeditor_ids", applied.expeditor_ids.join(","));
      if (applied.agent_ids.length) p.set("agent_ids", applied.agent_ids.join(","));
      if (applied.supervisor_ids.length) p.set("supervisor_ids", applied.supervisor_ids.join(","));
      if (applied.branches.length) p.set("branches", applied.branches.join(","));
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

  const applyDraft = () => setApplied({ ...draft });
  const resetAll = () => {
    const reset = { from: from0, to: to0, ...emptyPick };
    setDraft(reset);
    setApplied(reset);
  };
  const staffItems = (rows: Array<{ id: number; name: string; code: string | null }> | undefined) =>
    (rows ?? []).map((x) => ({ id: String(x.id), title: `${x.name}${x.code ? ` (${x.code})` : ""}` }));

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  const periodBtn = formatDateRangeButton(draft.from, draft.to);
  const t = data?.totals;

  const overdueRows = data?.status_by?.expeditor ?? [];
  const overdueSum = overdueRows.reduce((sum, row) => {
    return sum + Object.values(row.by_status).reduce((s, v) => s + (Number(v) || 0), 0);
  }, 0);
  const overdueCount = overdueRows.reduce((sum, row) => sum + (row.delivered_orders || 0), 0);

  const kpis = [
    {
      label: "Доставлено",
      value: money(t?.delivered_sum ?? 0),
      sub: `${t?.delivered_orders ?? 0} заказ(ов) · ${t?.expeditors_count ?? 0} доставщиков`
    },
    {
      label: "Возвраты",
      value: money(t?.returned_sum ?? 0),
      sub: `${t?.returned_orders ?? 0} заказ(ов)`
    },
    {
      label: "Собрано оплат",
      value: money(t?.payments_collected ?? 0),
      sub: "По доставленным"
    },
    {
      label: "Долг",
      value: money(t?.debt ?? 0),
      sub: "По доставленным"
    },
    {
      label: "Дольше 1 дня",
      value: money(overdueSum),
      sub: `${overdueCount} заказ(ов), ещё не доставлено`
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Доставка заказов</h1>
          <p className="text-xs text-muted-foreground">
            Филиал, СВР, агент и доставщик: доставка, возвраты, оплаты, долги и статусы
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
        <CardContent className="grid grid-cols-1 gap-2 pt-0 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["Филиал", "branches", (data?.branches ?? []).map((b) => ({ id: b, title: b }))] as const,
              ["СВР", "supervisor_ids", staffItems(data?.supervisors)] as const,
              ["Агент", "agent_ids", staffItems(data?.agents)] as const,
              ["Доставщик", "expeditor_ids", expeditorItems] as const
            ]
          ).map(([label, key, items]) => (
            <SearchableMultiSelectPanel
              key={key}
              label={label}
              hideOuterLabel
              hidePopoverHeader
              triggerPlaceholder={label}
              items={[...items]}
              selected={new Set(draft[key])}
              onSelectedChange={(next) => {
                const resolved = typeof next === "function" ? next(new Set(draft[key])) : next;
                setDraft((d) => ({ ...d, [key]: Array.from(resolved) }));
              }}
              searchable
              searchPlaceholder={label}
            />
          ))}
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetAll}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Сброс
          </Button>
          <Button type="button" size="sm" className="h-8 min-w-[120px] text-xs" onClick={applyDraft}>
            Применить
          </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-[11px] font-medium text-slate-500">{k.label}</p>
            <p className="mt-1 text-xl font-semibold leading-tight tabular-nums text-slate-950">{k.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      <ExpeditorDimBoard
        loading={dashQ.isLoading}
        onRefresh={() => void dashQ.refetch()}
        groups={{
          filial: (data?.by_filial ?? []) as ExpeditorGroupRow[],
          supervisor: (data?.by_supervisor ?? []) as ExpeditorGroupRow[],
          agent: (data?.by_agent ?? []) as ExpeditorGroupRow[],
          expeditor: (data?.rows ?? []).map((r) => ({
            name: r.expeditor_name,
            code: r.expeditor_code,
            delivered_orders: r.delivered_orders,
            delivered_sum: r.delivered_sum,
            returned_sum: r.returned_sum,
            payments_collected: r.payments_collected,
            debt: r.debt
          }))
        }}
        statuses={{
          filial: data?.status_by?.filial ?? [],
          supervisor: data?.status_by?.supervisor ?? [],
          agent: data?.status_by?.agent ?? [],
          expeditor: data?.status_by?.expeditor ?? []
        }}
      />
    </div>
  );
}
