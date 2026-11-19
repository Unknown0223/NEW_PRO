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
  agents: Array<{ id: number; name: string; code: string }>;
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
  balance_filters: Array<{ value: string; label: string }>;
};

type ReportRow = {
  row_number: number;
  client_id: number;
  client_name: string;
  agent_name: string;
  client_category: string;
  territory: string;
  balance: string;
  period_sales: string;
  period_payments: string;
  debt_flag: string;
  debt_flag_label: string;
};

type ReportData = {
  rows: ReportRow[];
  totals: {
    client_count: number;
    balance_sum: string;
    period_sales_sum: string;
    period_payments_sum: string;
  };
  page: number;
  limit: number;
  total: number;
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
  agent_ids: [] as string[],
  client_categories: [] as string[],
  territory_1_list: [] as string[],
  territory_2_list: [] as string[],
  territory_3_list: [] as string[],
  balance_filter: "all",
  search: "",
  page: 1,
  limit: 50
});

function fmtNum(v: string | number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return formatNumberGrouped(n, { maxFractionDigits: 2 });
}

const HEADERS = [
  "#",
  "Клиент",
  "Агент",
  "Категория",
  "Территория",
  "Баланс",
  "Продажи",
  "Оплаты",
  "Тип"
];

export default function ReportBalanceControlPage() {
  const canExport = usePermissions().has("reports.kontrol_balansov.export");
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
    queryKey: ["report-balance-control-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/balance-control/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-balance-control", tenantSlug, applied],
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
        `/api/${tenantSlug}/reports/balance-control?${p.toString()}`
      );
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const clientCatItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const t1 = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const t2 = (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  const t3 = (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
  const balanceItems = (opts?.balance_filters ?? []).map((x) => ({ id: x.value, title: x.label }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.client_name, r.agent_name, r.client_category, r.territory, r.debt_flag_label]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/balance-control/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kontrol-balansov.xlsx";
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
        <h1 className="text-lg font-semibold">Контроль балансов</h1>
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
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Клиент / агент"
        />
        <SearchableMultiSelectPanel
          label="Баланс"
          hideOuterLabel
          hidePopoverHeader
          triggerPlaceholder="Баланс"
          items={balanceItems}
          selected={new Set(draft.balance_filter === "all" ? [] : [draft.balance_filter])}
          onSelectedChange={(next) => {
            const resolved = typeof next === "function" ? next(new Set()) : next;
            const picked = Array.from(resolved)[0] ?? "all";
            setDraft((d) => ({ ...d, balance_filter: picked }));
          }}
          searchable={false}
          minPopoverWidth={200}
          maxListHeightClass="max-h-44"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Агент" items={agentItems} selectedValues={draft.agent_ids} onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))} />
        <MultiFilter placeholder="Категория клиента" items={clientCatItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} />
        <MultiFilter placeholder="Территория 1" items={t1} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v }))} />
        <MultiFilter placeholder="Территория 2" items={t2} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v }))} />
        <MultiFilter placeholder="Территория 3" items={t3} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        <span>Баланс: {fmtNum(reportQ.data?.totals.balance_sum ?? "0")}</span>
        <span>Продажи: {fmtNum(reportQ.data?.totals.period_sales_sum ?? "0")}</span>
        <span>Оплаты: {fmtNum(reportQ.data?.totals.period_payments_sum ?? "0")}</span>
        <Input className="ml-auto h-8 max-w-xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Фильтр в таблице…" />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {HEADERS.map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={HEADERS.length}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.client_id}-${r.row_number}`} className="border-t">
                  <td className="p-2">{r.row_number}</td>
                  <td className="p-2 font-medium">{r.client_name || "—"}</td>
                  <td className="p-2">{r.agent_name || "—"}</td>
                  <td className="p-2">{r.client_category || "—"}</td>
                  <td className="p-2">{r.territory || "—"}</td>
                  <td className="p-2 text-right">{fmtNum(r.balance)}</td>
                  <td className="p-2 text-right">{fmtNum(r.period_sales)}</td>
                  <td className="p-2 text-right">{fmtNum(r.period_payments)}</td>
                  <td className="p-2">{r.debt_flag_label}</td>
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