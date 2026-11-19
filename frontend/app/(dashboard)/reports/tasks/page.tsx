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
import { cn } from "@/lib/utils";

type FilterOptions = {
  statuses: Array<{ id: string; label: string }>;
  priorities: Array<{ id: string; label: string }>;
  assignees: Array<{ id: number; name: string; code: string; role: string }>;
  creators: Array<{ id: number; name: string; code: string; role: string }>;
  clients: Array<{ id: number; name: string; code: string }>;
  task_types: Array<{ id: string; name: string; code: string }>;
};

type ReportRow = {
  row_number: number;
  task_id: number;
  title: string;
  description: string;
  status_label: string;
  priority_label: string;
  task_type: string;
  assignee_name: string;
  created_by_name: string;
  client_name: string;
  created_at: string;
  due_at: string | null;
  completed_at: string | null;
  result_comment: string;
  photo_count: number;
};

type ReportData = { rows: ReportRow[]; page: number; limit: number; total: number };
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
  statuses: [] as string[],
  priorities: [] as string[],
  assignee_ids: [] as string[],
  created_by_ids: [] as string[],
  client_ids: [] as string[],
  task_type_refs: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

export default function ReportTasksPage() {
  const canExport = usePermissions().has("reports.otchet_po_zadacham.export");
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
    queryKey: ["report-tasks-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/tasks/filter-options`);
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-tasks", tenantSlug, applied],
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
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/tasks?${p.toString()}`);
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const priorityItems = (opts?.priorities ?? []).map((x) => ({ id: x.id, title: x.label }));
  const assigneeItems = (opts?.assignees ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code, x.role].filter(Boolean).join(" ")
  }));
  const creatorItems = (opts?.creators ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code, x.role].filter(Boolean).join(" ")
  }));
  const clientItems = (opts?.clients ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const typeItems = (opts?.task_types ?? []).map((x) => ({
    id: x.id,
    title: x.name,
    searchText: [x.name, x.code].filter(Boolean).join(" ")
  }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.title, r.description, r.result_comment, r.assignee_name, r.created_by_name, r.client_name, r.task_type]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const headers = ["#", "Задача", "Комментарий", "Статус", "Приоритет", "Тип", "Исполняющий", "Назначающий", "Клиент", "Создана", "Срок", "Результат", "Фото"];

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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/tasks/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "otchet-po-zadacham.xlsx";
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
        <h1 className="text-lg font-semibold">Отчёт по задачам</h1>
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
          placeholder="Задача / клиент / сотрудник"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Статус" items={statusItems} selectedValues={draft.statuses} onChange={(v) => setDraft((d) => ({ ...d, statuses: v }))} />
        <MultiFilter placeholder="Приоритет" items={priorityItems} selectedValues={draft.priorities} onChange={(v) => setDraft((d) => ({ ...d, priorities: v }))} />
        <MultiFilter placeholder="Тип задачи" items={typeItems} selectedValues={draft.task_type_refs} onChange={(v) => setDraft((d) => ({ ...d, task_type_refs: v }))} />
        <MultiFilter placeholder="Исполняющий" items={assigneeItems} selectedValues={draft.assignee_ids} onChange={(v) => setDraft((d) => ({ ...d, assignee_ids: v }))} />
        <MultiFilter placeholder="Назначающий" items={creatorItems} selectedValues={draft.created_by_ids} onChange={(v) => setDraft((d) => ({ ...d, created_by_ids: v }))} />
        <MultiFilter placeholder="Клиент" items={clientItems} selectedValues={draft.client_ids} onChange={(v) => setDraft((d) => ({ ...d, client_ids: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        <Input className="ml-auto h-8 max-w-xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Фильтр в таблице…" />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[1400px] text-sm">
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
                <tr key={r.task_id} className="border-t">
                  <td className="p-2">{r.row_number}</td>
                  <td className="p-2 font-medium">{r.title}</td>
                  <td className="p-2 max-w-[200px] truncate">{r.description || "—"}</td>
                  <td className="p-2">{r.status_label}</td>
                  <td className="p-2">{r.priority_label}</td>
                  <td className="p-2">{r.task_type}</td>
                  <td className="p-2">{r.assignee_name || "—"}</td>
                  <td className="p-2">{r.created_by_name || "—"}</td>
                  <td className="p-2">{r.client_name || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDt(r.created_at)}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDt(r.due_at)}</td>
                  <td className="p-2 max-w-[200px] truncate">{r.result_comment || "—"}</td>
                  <td className="p-2 text-right">{r.photo_count}</td>
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
