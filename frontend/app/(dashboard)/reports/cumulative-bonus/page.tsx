"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";

type FilterOptions = {
  date_types: Array<{ id: string; label: string }>;
  group_by: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  bonus_rules: Array<{ id: number; name: string; active: boolean }>;
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
};

type ReportRow = {
  row_number: number;
  group_key: string;
  name: string;
  agent_name: string;
  client_name: string;
  rule_name: string;
  purchase_sum: string;
  bonus_qty: string;
  bonus_sum: string;
  order_count: number;
  akb: number;
  rules_count: number;
};

type ReportData = {
  rows: ReportRow[];
  totals: { purchase_sum: string; bonus_qty: string; bonus_sum: string; order_count: number; akb: number };
  page: number;
  limit: number;
  total: number;
  group_by: string;
};

type MultiItem = { id: string; title: string; searchText?: string };

function MultiFilter(props: {
  placeholder: string;
  items: MultiItem[];
  selectedValues: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <SearchableMultiSelectPanel
      label={props.placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={props.placeholder}
      items={props.items}
      selected={new Set(props.selectedValues)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(props.selectedValues)) : next;
        props.onChange(Array.from(resolved));
      }}
      searchable
      searchPlaceholder={props.placeholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
    />
  );
}

const emptyDraft = (from: string, to: string) => ({
  from,
  to,
  date_type: "created_at",
  group_by: "client",
  statuses: [] as string[],
  agent_ids: [] as string[],
  bonus_rule_ids: [] as string[],
  client_categories: [] as string[],
  territory_1_list: [] as string[],
  territory_2_list: [] as string[],
  territory_3_list: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

function fmtNum(v: string | number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return formatNumberGrouped(n, { maxFractionDigits: 3 });
}

export default function ReportCumulativeBonusPage() {
  const canExport = usePermissions().has("reports.nakopitelnyy_bonus.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(from0, to0));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-cumulative-bonus-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/cumulative-bonus/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-cumulative-bonus", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) p.set(k, v.join(","));
          return;
        }
        if (v === "" || v === "all") return;
        p.set(k, String(v));
      });
      const { data } = await api.get<{ data: ReportData }>(
        `/api/${tenantSlug}/reports/cumulative-bonus?${p.toString()}`
      );
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const ruleItems = (opts?.bonus_rules ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: x.name
  }));
  const clientCatItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const t1 = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const t2 = (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  const t3 = (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.agent_name, r.client_name, r.rule_name].join(" ").toLowerCase().includes(q);
  });
  const groupBy = reportQ.data?.group_by ?? applied.group_by;
  const headers =
    groupBy === "rule"
      ? ["#", "Правило", "Заказов", "АКБ"]
      : groupBy === "agent"
        ? ["#", "Агент", "Сумма закупа", "Бонус кол-во", "Общий бонус", "Заказов", "АКБ", "Правил"]
        : ["#", "Клиент", "Агент", "Сумма закупа", "Бонус кол-во", "Общий бонус", "Заказов", "Правил"];

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) p.set(k, v.join(","));
          return;
        }
        if (v === "" || v === "all") return;
        p.set(k, String(v));
      });
      p.set("export_limit", "5000");
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/cumulative-bonus/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nakopitelnyy-bonus.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Накопительный бонус</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = emptyDraft(from0, to0);
              setDraft(next);
              setApplied(next);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {canExport ? (
            <Button disabled={exporting || reportQ.isFetching} onClick={() => void exportXlsx()}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setApplied({ ...draft, page: 1 });
              setDraft((s) => ({ ...s, page: 1 }));
            }}
          >
            Применить
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={dateAnchorRef}
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs",
            dateOpen && "border-primary/60 bg-primary/5"
          )}
          onClick={() => setDateOpen((o) => !o)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{formatDateRangeButton(draft.from, draft.to)}</span>
        </button>
        <DateRangePopover
          open={dateOpen}
          onOpenChange={setDateOpen}
          anchorRef={dateAnchorRef}
          dateFrom={draft.from}
          dateTo={draft.to}
          onApply={({ dateFrom, dateTo }) => setDraft((d) => ({ ...d, from: dateFrom, to: dateTo }))}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          value={draft.date_type}
          onChange={(e) => setDraft((d) => ({ ...d, date_type: e.target.value }))}
        >
          {(opts?.date_types ?? [{ id: "created_at", label: "Дата заявки" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          value={draft.group_by}
          onChange={(e) => setDraft((d) => ({ ...d, group_by: e.target.value }))}
        >
          {(opts?.group_by ?? [{ id: "client", label: "По клиентам" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Клиент / агент"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} />
        <MultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} />
        <MultiFilter placeholder="Бонус-правило" items={ruleItems} selectedValues={draft.bonus_rule_ids} onChange={(v) => setDraft((d) => ({ ...d, bonus_rule_ids: v }))} />
        <MultiFilter placeholder="Категория клиента" items={clientCatItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} />
        <MultiFilter placeholder="Территория 1" items={t1} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v }))} />
        <MultiFilter placeholder="Территория 2" items={t2} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v }))} />
        <MultiFilter placeholder="Территория 3" items={t3} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        <span>Закуп: {fmtNum(reportQ.data?.totals.purchase_sum ?? "0")}</span>
        <span>Бонус: {fmtNum(reportQ.data?.totals.bonus_qty ?? "0")}</span>
        <span>АКБ: {reportQ.data?.totals.akb ?? 0}</span>
        <Input className="ml-auto h-8 max-w-xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Фильтр в таблице…" />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {headers.map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={headers.length}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.group_key} className="border-t">
                  <td className="p-2">{r.row_number}</td>
                  <td className="p-2 font-medium">{r.name}</td>
                  {groupBy === "client" ? <td className="p-2">{r.agent_name || "—"}</td> : null}
                  {groupBy !== "rule" ? (
                    <>
                      <td className="p-2 text-right">{fmtNum(r.purchase_sum)}</td>
                      <td className="p-2 text-right">{fmtNum(r.bonus_qty)}</td>
                      <td className="p-2 text-right">{fmtNum(r.bonus_sum)}</td>
                    </>
                  ) : null}
                  <td className="p-2 text-right">{r.order_count}</td>
                  {groupBy !== "client" ? <td className="p-2 text-right">{r.akb}</td> : null}
                  {groupBy !== "rule" ? <td className="p-2 text-right">{r.rules_count}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={applied.page <= 1 || reportQ.isFetching}
          onClick={() => {
            const page = Math.max(1, applied.page - 1);
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        >
          Назад
        </Button>
        <span className="text-sm">
          {applied.page} / {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={applied.page >= totalPages || reportQ.isFetching}
          onClick={() => {
            const page = applied.page + 1;
            setDraft((s) => ({ ...s, page }));
            setApplied((s) => ({ ...s, page }));
          }}
        >
          Далее
        </Button>
      </div>
    </div>
  );
}
