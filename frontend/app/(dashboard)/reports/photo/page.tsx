"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { cn } from "@/lib/utils";

type FilterOptions = {
  archive: Array<{ id: string; label: string }>;
  client_active: Array<{ id: string; label: string }>;
  user_roles: Array<{ id: string; label: string }>;
  users: Array<{ id: number; name: string; code: string; role: string }>;
  photo_categories: string[];
  client_categories: string[];
  territory_1: string[];
  territory_2: string[];
  territory_3: string[];
};

type ReportRow = {
  row_number: number;
  photo_id: number;
  client_id: number;
  client_code: string;
  client_name: string;
  created_at: string;
  client_category: string;
  territory: string;
  user_name: string;
  user_role: string;
  category: string;
  status_label: string;
  content_purged: boolean;
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
  archive: "active",
  client_active: "all",
  photo_categories: [] as string[],
  user_ids: [] as string[],
  user_roles: [] as string[],
  client_categories: [] as string[],
  territory_1_list: [] as string[],
  territory_2_list: [] as string[],
  territory_3_list: [] as string[],
  search: "",
  page: 1,
  limit: 50
});

function fmtDt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

export default function ReportPhotoPage() {
  const canExport = usePermissions().has("reports.fotootchyoty.export");
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
    queryKey: ["report-photo-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/photo/filter-options`);
      return data.data;
    }
  });

  const reportQ = useQuery({
    queryKey: ["report-photo", tenantSlug, applied],
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
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/photo?${p.toString()}`);
      return data.data;
    }
  });

  if (!hydrated || !tenantSlug) return <p className="p-6 text-sm text-muted-foreground">Загрузка...</p>;

  const opts = filtersQ.data;
  const userItems = (opts?.users ?? []).map((x) => ({
    id: String(x.id),
    title: x.name,
    searchText: [x.name, x.code, x.role].filter(Boolean).join(" ")
  }));
  const roleItems = (opts?.user_roles ?? []).map((x) => ({ id: x.id, title: x.label }));
  const categoryItems = (opts?.photo_categories ?? []).map((x) => ({ id: x, title: x }));
  const clientCategoryItems = (opts?.client_categories ?? []).map((x) => ({ id: x, title: x }));
  const territory1Items = (opts?.territory_1 ?? []).map((x) => ({ id: x, title: x }));
  const territory2Items = (opts?.territory_2 ?? []).map((x) => ({ id: x, title: x }));
  const territory3Items = (opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }));
  const totalPages = reportQ.data ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit)) : 1;
  const rows = (reportQ.data?.rows ?? []).filter((r) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return [r.client_name, r.client_code, r.user_name, r.category, r.territory].join(" ").toLowerCase().includes(q);
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
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/photo/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fotootchoty.xlsx";
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
        <h1 className="text-lg font-semibold">Фотоотчёты</h1>
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
        <FilterSelect
          emptyLabel="Статус"
          value={draft.archive}
          onChange={(e) => setDraft((d) => ({ ...d, archive: e.target.value || "active" }))}
        >
          {(opts?.archive ?? [{ id: "active", label: "Активные" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          emptyLabel="Активность"
          value={draft.client_active}
          onChange={(e) => setDraft((d) => ({ ...d, client_active: e.target.value || "all" }))}
        >
          {(opts?.client_active ?? [{ id: "all", label: "Все клиенты" }]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </FilterSelect>
        <Input
          className="h-9 max-w-xs"
          value={draft.search}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Клиент / код / пользователь"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MultiFilter placeholder="Категория фотоотчёта" items={categoryItems} selectedValues={draft.photo_categories} onChange={(v) => setDraft((d) => ({ ...d, photo_categories: v }))} />
        <MultiFilter placeholder="Роль" items={roleItems} selectedValues={draft.user_roles} onChange={(v) => setDraft((d) => ({ ...d, user_roles: v }))} />
        <MultiFilter placeholder="Пользователь" items={userItems} selectedValues={draft.user_ids} onChange={(v) => setDraft((d) => ({ ...d, user_ids: v }))} />
        <MultiFilter placeholder="Категория клиента" items={clientCategoryItems} selectedValues={draft.client_categories} onChange={(v) => setDraft((d) => ({ ...d, client_categories: v }))} />
        <MultiFilter placeholder="Зона" items={territory1Items} selectedValues={draft.territory_1_list} onChange={(v) => setDraft((d) => ({ ...d, territory_1_list: v }))} />
        <MultiFilter placeholder="Область" items={territory2Items} selectedValues={draft.territory_2_list} onChange={(v) => setDraft((d) => ({ ...d, territory_2_list: v }))} />
        <MultiFilter placeholder="Город" items={territory3Items} selectedValues={draft.territory_3_list} onChange={(v) => setDraft((d) => ({ ...d, territory_3_list: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Всего: {reportQ.data?.total ?? 0}</span>
        <Input className="ml-auto h-8 max-w-xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Фильтр в таблице…" />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {["#", "Клиент", "Дата", "Категория клиента", "Территория", "Пользователь", "Категория отчета", "Статус"].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reportQ.isLoading || rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={8}>
                  {reportQ.isLoading ? "Загрузка…" : "Нет данных"}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.photo_id} className="border-t">
                  <td className="p-2">{r.row_number}</td>
                  <td className="p-2 font-medium">{r.client_name}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDt(r.created_at)}</td>
                  <td className="p-2">{r.client_category || "—"}</td>
                  <td className="p-2">{r.territory || "—"}</td>
                  <td className="p-2">
                    {r.user_name || "—"}
                    {r.user_role ? <span className="text-muted-foreground"> ({r.user_role})</span> : null}
                  </td>
                  <td className="p-2">{r.category}</td>
                  <td className="p-2">{r.status_label}</td>
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
