"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  Inbox,
  RefreshCw,
  RotateCcw,
  Search
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateRangePopover, formatDateRangeButton, localYmd } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";

type AccessHistoryRow = {
  id: number;
  created_at: string;
  action_type: string;
  actor_user_id?: number | null;
  actor_login: string | null;
  actor_name: string | null;
  actor_code: string | null;
  actor_display: string;
  target_user_id?: number | null;
  target_login: string | null;
  target_name: string | null;
  target_code: string | null;
  target_display: string;
  entity_type: string;
  entity_id: string;
  old_value?: unknown;
  new_value?: unknown;
  operation_label: string;
  action_type_label: string;
};

type AccessHistoryUserOption = {
  value: string;
  label: string;
};

/** Макет: акцент #00897B, тёмный фон ~#121212 */
const tplPrimaryBtn =
  "bg-[#00897B] text-white shadow-sm hover:bg-[#00695c] focus-visible:ring-2 focus-visible:ring-[#4db6ac]/70 dark:bg-[#00897B] dark:hover:bg-[#00695c]";
const tplDateCell = "font-mono text-[14px] font-medium text-[#00897B]";
const tplPageActive =
  "border-[#00897B] bg-[#00897B] text-white hover:bg-[#00695c] hover:text-white";
const tplHeaderCell = "h-12 px-4 py-0 text-left text-sm font-semibold text-slate-700 dark:text-zinc-100";
const tplControl40 = "h-10";
const tplIcon40 = "h-10 w-10";
const DEFAULT_VISIBLE_COLS = {
  date: true,
  operation: true,
  actor: true,
  target: true,
  action: true
} as const;
const COLUMN_OPTIONS: Array<{ key: keyof typeof DEFAULT_VISIBLE_COLS; label: string }> = [
  { key: "date", label: "Дата" },
  { key: "operation", label: "Операции" },
  { key: "actor", label: "Исполнитель" },
  { key: "target", label: "Пользователь" },
  { key: "action", label: "Тип действия" }
];

function humanizeActionTypeKey(value: string): string {
  const t = value.trim().toLowerCase();
  if (!t) return "Событие";
  if (t.includes("permissions.bulk_updated")) return "Массовое обновление прав";
  if (t.includes("permissions.updated")) return "Права доступа изменены";
  if (t.includes("scope.updated")) return "Область доступа изменена";
  if (t.includes("access.updated")) return "Доступ обновлен";
  if (t.includes("access.cloned")) return "Доступ скопирован";
  if (t.includes("user.profile.updated")) return "Профиль пользователя изменен";
  if (t.includes("supervisees.updated")) return "Подчиненные обновлены";
  const normalized = t.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: localYmd(from), to: localYmd(to) };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTableDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function actionTypeLabelPresentation(label: string): { className: string; isBadge: boolean } {
  const t = label.toLowerCase();
  if (t.includes("предоставлен") || t.includes("granted")) {
    return {
      isBadge: true,
      className:
        "inline-flex h-7 items-center rounded-lg bg-[#22C55E]/18 px-3 text-[12px] font-medium text-[#86efac]"
    };
  }
  if (t.includes("удален") || t.includes("снят") || t.includes("отозван") || t.includes("removed")) {
    return {
      isBadge: true,
      className:
        "inline-flex h-7 items-center rounded-lg bg-[#EF4444]/18 px-3 text-[12px] font-medium text-[#fca5a5]"
    };
  }
  return { isBadge: false, className: "text-[14px] text-foreground/80" };
}

function buildPageList(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const want = new Set<number>([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
  for (const p of [...want]) {
    if (p < 1 || p > totalPages) want.delete(p);
  }
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border/50">
          <td className="px-3 py-2">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2">
            <div className="h-3 w-full max-w-[12rem] animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2">
            <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function AccessHistoryWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const def = useMemo(() => defaultDateRange(), []);
  const [draftActionType, setDraftActionType] = useState("");
  const [actionType, setActionType] = useState("");
  const [draftActorUserId, setDraftActorUserId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [draftTargetUserId, setDraftTargetUserId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [draftFrom, setDraftFrom] = useState(def.from);
  const [draftTo, setDraftTo] = useState(def.to);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(20);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [exportBusy, setExportBusy] = useState<null | "csv" | "xlsx">(null);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<keyof typeof DEFAULT_VISIBLE_COLS, boolean>>({
    ...DEFAULT_VISIBLE_COLS
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortDir]);

  const visibleColumnCount = Object.values(visibleCols).filter(Boolean).length;
  const columnOrder = useMemo(() => COLUMN_OPTIONS.map((o) => o.key), []);
  const hiddenColumnIds = useMemo(
    () => new Set(columnOrder.filter((id) => !visibleCols[id])),
    [columnOrder, visibleCols]
  );

  const metaQ = useQuery({
    queryKey: ["access-history-meta", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.get<{ action_types: { action_type: string; count: number }[] }>(
        `/api/${tenantSlug}/access/history/meta`
      );
      return data;
    }
  });

  const usersQ = useQuery({
    queryKey: ["access-history-users", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; full_name?: string | null; login?: string | null; code?: string | null }>;
      }>(`/api/${tenantSlug}/access/users?include_counts=false`);
      return data.data ?? [];
    }
  });

  const userOptions = useMemo<AccessHistoryUserOption[]>(() => {
    return (usersQ.data ?? []).map((u) => {
      const name = (u.full_name ?? "").trim();
      const login = (u.login ?? "").trim();
      const code = (u.code ?? "").trim();
      const base = name || login || `ID ${u.id}`;
      const suffix = code ? ` [${code}]` : "";
      return { value: String(u.id), label: `${base}${suffix}` };
    });
  }, [usersQ.data]);

  const queryKey = useMemo(
    () => ["access-history", tenantSlug, actionType, actorUserId, targetUserId, from, to, page, limit, debouncedSearch, sortDir],
    [tenantSlug, actionType, actorUserId, targetUserId, from, to, page, limit, debouncedSearch, sortDir]
  );

  const q = useQuery({
    queryKey,
    enabled: Boolean(tenantSlug),
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (actionType.trim()) params.set("action_type", actionType.trim());
      if (actorUserId.trim()) params.set("actor_user_id", actorUserId.trim());
      if (targetUserId.trim()) params.set("target_user_id", targetUserId.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("sort_dir", sortDir);
      const { data } = await api.get<{ data: AccessHistoryRow[]; total: number; page: number; limit: number }>(
        `/api/${tenantSlug}/access/history?${params.toString()}`
      );
      return data;
    }
  });

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;
  const rangeStart = q.data && q.data.total > 0 ? (page - 1) * limit + 1 : 0;
  const rangeEnd = q.data ? Math.min(page * limit, q.data.total) : 0;
  const rows = q.data?.data ?? [];

  const actionTypeOptions = useMemo(() => {
    const rowsMeta = metaQ.data?.action_types ?? [];
    return rowsMeta.map((r) => ({
      value: r.action_type,
      label: `${humanizeActionTypeKey(r.action_type)} (${r.count})`
    }));
  }, [metaQ.data?.action_types]);

  const filtersDirty = useMemo(
    () =>
      draftActionType !== actionType ||
      draftActorUserId !== actorUserId ||
      draftTargetUserId !== targetUserId ||
      draftFrom !== from ||
      draftTo !== to,
    [draftActionType, actionType, draftActorUserId, actorUserId, draftTargetUserId, targetUserId, draftFrom, from, draftTo, to]
  );

  const resetHistoryFilters = () => {
    const d = defaultDateRange();
    setDraftActionType("");
    setDraftActorUserId("");
    setDraftTargetUserId("");
    setDraftFrom(d.from);
    setDraftTo(d.to);
    setActionType("");
    setActorUserId("");
    setTargetUserId("");
    setFrom(d.from);
    setTo(d.to);
    setSearchInput("");
    setDebouncedSearch("");
    setSortDir("desc");
    setPage(1);
  };

  const applyFilters = () => {
    setActionType(draftActionType);
    setActorUserId(draftActorUserId);
    setTargetUserId(draftTargetUserId);
    setFrom(draftFrom);
    setTo(draftTo);
    setPage(1);
  };

  const buildExportParams = (kind: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "2000");
    params.set("export", kind);
    if (actionType.trim()) params.set("action_type", actionType.trim());
    if (actorUserId.trim()) params.set("actor_user_id", actorUserId.trim());
    if (targetUserId.trim()) params.set("target_user_id", targetUserId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("sort_dir", sortDir);
    return params.toString();
  };

  const exportFile = async (kind: "csv" | "xlsx") => {
    setExportBusy(kind);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/access/history?${buildExportParams(kind)}`, {
        responseType: "blob"
      });
      downloadBlob(res.data as Blob, kind === "csv" ? "istoriya-dostupa.csv" : "istoriya-dostupa.xlsx");
    } finally {
      setExportBusy(null);
    }
  };

  const pageItems = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  return (
    <div className="access-surface access-history-tpl space-y-0 pt-1">
      {q.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">Не удалось загрузить историю</p>
          <p className="mt-1 text-xs opacity-90">Проверьте соединение и попробуйте снова.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-8 text-xs"
            onClick={() => void q.refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#e5e7eb] bg-card p-3 shadow-sm dark:border-[#1e3a36] dark:bg-[#121212]">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-xs font-normal text-muted-foreground">Тип действия</label>
                <FilterSearchableSelect
                  id="access-history-action-type"
                  emptyLabel="Все типы действий"
                  value={draftActionType}
                  onValueChange={(v) => setDraftActionType(v ?? "")}
                  options={actionTypeOptions}
                  searchable
                  className={`${tplControl40} w-full text-xs`}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-normal text-muted-foreground">Исполнитель</label>
                <FilterSearchableSelect
                  id="access-history-actor-user"
                  emptyLabel="Все исполнители"
                  value={draftActorUserId}
                  onValueChange={(v) => setDraftActorUserId(v ?? "")}
                  options={userOptions}
                  searchable
                  className={`${tplControl40} w-full text-xs`}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-normal text-muted-foreground">Пользователь</label>
                <FilterSearchableSelect
                  id="access-history-target-user"
                  emptyLabel="Все пользователи"
                  value={draftTargetUserId}
                  onValueChange={(v) => setDraftTargetUserId(v ?? "")}
                  options={userOptions}
                  searchable
                  className={`${tplControl40} w-full text-xs`}
                />
              </div>
            </div>
            {metaQ.isError || usersQ.isError ? (
              <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                Часть фильтров временно недоступна - используйте поиск по таблице.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              ref={dateAnchorRef}
              type="button"
              className={`inline-flex ${tplControl40} w-[260px] shrink-0 items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-xs shadow-sm`}
              onClick={() => setDateRangeOpen((v) => !v)}
            >
              <span className="truncate">{formatDateRangeButton(draftFrom, draftTo)}</span>
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`${tplIcon40} shrink-0 text-muted-foreground`}
              title="Сбросить фильтры"
              onClick={resetHistoryFilters}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(
                `${tplControl40} w-[120px] px-4 text-xs`,
                tplPrimaryBtn,
                filtersDirty && "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-background dark:ring-amber-500/50"
              )}
              onClick={applyFilters}
            >
              Применить
              {filtersDirty ? <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-amber-200" aria-hidden /> : null}
            </Button>
          </div>
        </div>
        {filtersDirty ? (
          <p className="mt-1.5 text-[10px] text-amber-800 dark:text-amber-300/90">
            Есть несохранённые фильтры — нажмите «Применить», чтобы обновить таблицу.
          </p>
        ) : null}

      </div>

      <div className="mx-1 hidden h-[2px] bg-[hsl(var(--background))] sm:block" />

      <TableColumnSettingsDialog
        open={colMenuOpen}
        onOpenChange={setColMenuOpen}
        title="Управление столбцами"
        columns={COLUMN_OPTIONS.map((o) => ({ id: o.key, label: o.label }))}
        columnOrder={columnOrder}
        hiddenColumnIds={hiddenColumnIds}
        onReset={() => setVisibleCols({ ...DEFAULT_VISIBLE_COLS })}
        onSave={({ hiddenColumnIds: nextHidden }) => {
          const hiddenSet = new Set(nextHidden as (keyof typeof DEFAULT_VISIBLE_COLS)[]);
          const nextVisible = columnOrder.reduce<Record<keyof typeof DEFAULT_VISIBLE_COLS, boolean>>(
            (acc, id) => {
              acc[id] = !hiddenSet.has(id);
              return acc;
            },
            { ...DEFAULT_VISIBLE_COLS } as Record<keyof typeof DEFAULT_VISIBLE_COLS, boolean>
          );
          setVisibleCols(nextVisible);
        }}
      />

      <DateRangePopover
        open={dateRangeOpen}
        onOpenChange={setDateRangeOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draftFrom}
        dateTo={draftTo}
        onApply={({ dateFrom, dateTo }) => {
          setDraftFrom(dateFrom);
          setDraftTo(dateTo);
        }}
      />

      <div className="mt-1 hidden rounded-xl border border-[#e5e7eb] bg-card shadow-sm sm:block dark:border-[#1e3a36] dark:bg-[#121212]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f4] px-3 py-2.5 dark:border-[#1e3a36]">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`${tplIcon40} text-muted-foreground`}
                title="Настройка столбцов"
                aria-label="Настройка столбцов"
                onClick={() => {
                  setColMenuOpen((v) => !v);
                }}
              >
                <Columns3 className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                setLimit(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className={`${tplControl40} w-[5.5rem] text-xs`} aria-label="Строк на странице">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-0 w-[240px] max-w-full">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Поиск"
                className={`${tplControl40} border-border/80 pl-8 text-xs`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setDebouncedSearch(searchInput.trim());
                }}
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`${tplControl40} w-[100px] gap-1 border-[#CBD5E1] text-xs`}
                disabled={q.isFetching || exportBusy !== null}
                onClick={() => void exportFile("xlsx")}
              >
                <FileSpreadsheet
                  className={`h-3.5 w-3.5 text-[#1d7a6e] dark:text-[#4db6ac] ${exportBusy === "xlsx" ? "animate-pulse" : ""}`}
                  aria-hidden
                />
                Excel
              </Button>
              <button
                type="button"
                className="hidden text-[10px] text-muted-foreground underline-offset-2 hover:text-[#00897B] hover:underline disabled:cursor-not-allowed disabled:opacity-40 sm:inline"
                disabled={q.isFetching || exportBusy !== null}
                title="Выгрузка CSV"
                onClick={() => void exportFile("csv")}
              >
                CSV
              </button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                title="Обновить"
                disabled={q.isFetching}
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ["access-history", tenantSlug] });
                  void queryClient.invalidateQueries({ queryKey: ["access-history-meta", tenantSlug] });
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="max-w-[14rem] text-right text-[10px] leading-tight text-muted-foreground">
              Выгрузка: до 2000 записей по периоду, типу и поиску
            </p>
          </div>
        </div>

        <div className="access-right-panel access-table-scroll">
        <table className="w-full min-w-[1040px] table-fixed text-sm">
          <colgroup>
            {visibleCols.date ? <col style={{ width: "180px" }} /> : null}
            {visibleCols.operation ? <col style={{ width: "280px" }} /> : null}
            {visibleCols.actor ? <col style={{ width: "200px" }} /> : null}
            {visibleCols.target ? <col style={{ width: "200px" }} /> : null}
            {visibleCols.action ? <col style={{ width: "180px" }} /> : null}
          </colgroup>
          <thead className="app-table-thead sticky top-0 z-10 border-b border-border bg-muted">
            <tr className="h-12">
              {visibleCols.date ? (
                <th className={tplHeaderCell} aria-sort={sortDir === "desc" ? "descending" : "ascending"}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-0.5 text-left font-semibold text-foreground hover:text-[#00897B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00897B]/40 dark:hover:text-[#4db6ac]"
                  title={sortDir === "desc" ? "Сначала новые — нажмите для старых сверху" : "Сначала старые — нажмите для новых сверху"}
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                >
                  Дата
                  {sortDir === "desc" ? (
                    <ArrowDownWideNarrow className="h-3.5 w-3.5 shrink-0 text-[#00897B] opacity-90 dark:text-[#4db6ac]" aria-hidden />
                  ) : (
                    <ArrowUpWideNarrow className="h-3.5 w-3.5 shrink-0 text-[#00897B] opacity-90 dark:text-[#4db6ac]" aria-hidden />
                  )}
                </button>
                </th>
              ) : null}
              {visibleCols.operation ? <th className={tplHeaderCell}>Операции</th> : null}
              {visibleCols.actor ? <th className={tplHeaderCell}>Исполнитель</th> : null}
              {visibleCols.target ? <th className={tplHeaderCell}>Пользователь</th> : null}
              {visibleCols.action ? <th className={tplHeaderCell}>Тип действия</th> : null}
            </tr>
          </thead>
          <tbody
            className={cn(
              "transition-opacity duration-200",
              q.isFetching && q.data && "opacity-[0.72]"
            )}
          >
            {q.isLoading && !q.data ? <TableSkeletonRows /> : null}
            {!q.isLoading &&
              rows.map((row) => {
                const actionPres = actionTypeLabelPresentation(row.action_type_label);
                return (
                  <tr
                    key={row.id}
                    className="h-14 border-b border-border transition-colors hover:bg-muted dark:hover:bg-muted"
                  >
                    {visibleCols.date ? (
                      <td className={cn("h-14 whitespace-nowrap px-4 py-0", tplDateCell)}>
                        {formatTableDate(row.created_at)}
                      </td>
                    ) : null}
                    {visibleCols.operation ? (
                      <td className="h-14 px-4 py-0 text-sm">
                      <span className="line-clamp-2" title={row.operation_label}>
                        {row.operation_label}
                      </span>
                      </td>
                    ) : null}
                    {visibleCols.actor ? (
                      <td className="h-14 px-4 py-0 text-sm">
                      <span className="line-clamp-2" title={row.actor_display}>
                        {row.actor_display}
                      </span>
                      </td>
                    ) : null}
                    {visibleCols.target ? (
                      <td className="h-14 px-4 py-0 text-sm">
                      <span className="line-clamp-2" title={row.target_display}>
                        {row.target_display}
                      </span>
                      </td>
                    ) : null}
                    {visibleCols.action ? (
                      <td className="h-14 px-4 py-0">
                      <span
                        className={cn(actionPres.isBadge ? actionPres.className : "line-clamp-2", !actionPres.isBadge && actionPres.className)}
                        title={row.action_type_label}
                      >
                        {row.action_type_label}
                      </span>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            {!q.isLoading && !q.isError && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnCount || 1}
                  className="px-3 py-14 text-center text-xs text-muted-foreground"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <Inbox className="h-10 w-10 text-teal-600/50 dark:text-teal-400/40" aria-hidden />
                    <p className="font-medium text-foreground/80">
                      {debouncedSearch
                        ? "Ничего не найдено по поиску и фильтрам"
                        : "За выбранный период записей нет"}
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      {debouncedSearch
                        ? "Измените текст поиска, тип действия или период и нажмите «Применить»."
                        : "Расширьте диапазон дат или сбросьте фильтры."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#eef2f4] px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-3 dark:border-[#1e3a36]">
          <p className="text-muted-foreground">
            Показано {rangeStart} - {rangeEnd} / <span className="tabular-nums">{q.data?.total ?? 0}</span>
            {q.isFetching && q.data ? (
              <span className="ml-2 inline-flex items-center gap-1 text-[#4db6ac]">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                обновление…
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 dark:border-[#1e3a36]"
              disabled={page <= 1 || q.isFetching}
              aria-label="Предыдущая страница"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`e-${idx}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === page ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 min-w-8 px-2 text-xs dark:border-[#1e3a36]",
                    item === page ? tplPageActive : ""
                  )}
                  onClick={() => setPage(item)}
                >
                  {item}
                </Button>
              )
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 dark:border-[#1e3a36]"
              disabled={page >= totalPages || q.isFetching}
              aria-label="Следующая страница"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 sm:hidden">
        {rows.map((row) => {
          const actionPres = actionTypeLabelPresentation(row.action_type_label);
          return (
            <div
              key={`card-${row.id}`}
              className="w-full rounded-xl border border-[#1e3a36] bg-[#121212] p-3 text-left"
            >
              <p className={tplDateCell}>{formatTableDate(row.created_at)}</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">{row.operation_label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.actor_display} {"→"} {row.target_display}
              </p>
              <p className="mt-2">
                <span className={cn(actionPres.isBadge ? actionPres.className : actionPres.className)}>{row.action_type_label}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-[#e5e7eb] bg-card px-2 py-2 text-xs sm:hidden sm:flex-row sm:items-center sm:justify-between sm:px-3 dark:border-[#1e3a36] dark:bg-[#141414]">
        <p className="text-zinc-300">
          Показано {rangeStart} - {rangeEnd} / <span className="tabular-nums">{q.data?.total ?? 0}</span>
          {q.isFetching && q.data ? (
            <span className="ml-2 inline-flex items-center gap-1 text-[#4db6ac]">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
              обновление…
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 dark:border-[#1e3a36]"
            disabled={page <= 1 || q.isFetching}
            aria-label="Предыдущая страница"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageItems.map((item, idx) =>
            item === "ellipsis" ? (
              <span key={`e-${idx}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === page ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 min-w-8 px-2 text-xs dark:border-[#1e3a36]",
                  item === page ? tplPageActive : ""
                )}
                onClick={() => setPage(item)}
              >
                {item}
              </Button>
            )
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 dark:border-[#1e3a36]"
            disabled={page >= totalPages || q.isFetching}
            aria-label="Следующая страница"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </div>
  );
}
