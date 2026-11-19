"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumberGrouped } from "@/lib/format-numbers";

type FilterOptions = {
  visit_kinds: Array<{ id: string; label: string }>;
  months: Array<{ id: string; label: string }>;
  years: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
};

type ReportRow = {
  row_number: number;
  work_date: string;
  agent_id: number;
  agent_name: string;
  visited: number;
  planned: number;
  not_visited: number;
  orders_count: number;
  photo_reports: number;
  refusals: number;
  visit_pct: number;
};

type ReportData = {
  rows: ReportRow[];
  totals: {
    visited: number;
    planned: number;
    not_visited: number;
    orders_count: number;
    photo_reports: number;
    refusals: number;
  };
  page: number;
  limit: number;
  total: number;
  year: number;
  month: number;
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

function emptyDraft() {
  const n = new Date();
  return {
    year: String(n.getUTCFullYear()),
    month: String(n.getUTCMonth() + 1),
    agent_ids: [] as string[],
    visit_kinds: [] as string[],
    search: "",
    page: 1,
    limit: 50
  };
}

function fmtNum(v: string | number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return formatNumberGrouped(n, { maxFractionDigits: 1 });
}

const HEADERS = [
  "#",
  "Дата",
  "Агент",
  "Посещённые",
  "План",
  "Непосещенные",
  "Заказы",
  "Фотоотчёты",
  "Отказы",
  "% посещ."
];

export default function ReportDailyVisitsPage() {
  const canExport = usePermissions().has("reports.po_dnevnomu_poseshcheniyu.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-daily-visits-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/reports/daily-visits/filter-options`
      );
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-daily-visits", tenantSlug, applied],
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
        `/api/${tenantSlug}/reports/daily-visits?${p.toString()}`
      );
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const visitKindItems = (opts?.visit_kinds ?? []).map((x) => ({ id: x.id, title: x.label }));
  const agentItems = (opts?.agents ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const yearItems = opts?.years ?? [];
  const monthItems = opts?.months ?? [];
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.agent_name, r.work_date].join(" ").toLowerCase().includes(q);
  });
  const totals = reportQ.data?.totals;

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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/daily-visits/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dnevnoe-poseshchenie.xlsx";
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
        <h1 className="text-lg font-semibold">По дневному посещению</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = emptyDraft();
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
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          value={draft.year}
          onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))}
        >
          {yearItems.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          value={draft.month}
          onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))}
        >
          {monthItems.map((x) => (
            <option key={x.id} value={x.id}>
              Месяц {x.label}
            </option>
          ))}
        </select>
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Агент"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <MultiFilter
          placeholder="Агент"
          items={agentItems}
          selectedValues={draft.agent_ids}
          onChange={(v) => setDraft((d) => ({ ...d, agent_ids: v }))}
        />
        <MultiFilter
          placeholder="Тип визита"
          items={visitKindItems}
          selectedValues={draft.visit_kinds}
          onChange={(v) => setDraft((d) => ({ ...d, visit_kinds: v }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        <span>Посещ.: {totals?.visited ?? 0}</span>
        <span>План: {totals?.planned ?? 0}</span>
        <span>Заказы: {totals?.orders_count ?? 0}</span>
        <Input
          className="ml-auto h-8 max-w-xs"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          placeholder="Фильтр в таблице…"
        />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[980px] text-sm">
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
                <tr key={`${r.work_date}-${r.agent_id}`} className="border-t">
                  <td className="p-2">{r.row_number}</td>
                  <td className="p-2">{r.work_date}</td>
                  <td className="p-2 font-medium">{r.agent_name}</td>
                  <td className="p-2 text-right">{r.visited}</td>
                  <td className="p-2 text-right">{r.planned}</td>
                  <td className="p-2 text-right">{r.not_visited}</td>
                  <td className="p-2 text-right">{r.orders_count}</td>
                  <td className="p-2 text-right">{r.photo_reports}</td>
                  <td className="p-2 text-right">{r.refusals}</td>
                  <td className="p-2 text-right">{fmtNum(r.visit_pct)}</td>
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
