"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Info,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
  Zap
} from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTabelAudit } from "@/lib/tabel/tabel-api";
import { TimesheetStatCards } from "@/components/timesheet/timesheet-stat-cards";
import { TimesheetTable } from "@/components/timesheet/timesheet-table";
import { TimesheetEditToolbar } from "@/components/timesheet/timesheet-edit-toolbar";
import { TimesheetExportDialog } from "@/components/timesheet/timesheet-export-dialog";
import { TimesheetLegend } from "@/components/timesheet/timesheet-legend";
import { TimesheetCellModal, type CellTarget } from "@/components/timesheet/timesheet-cell-modal";
import {
  WORK_STATUS_BY_VALUE,
  canEditTimesheet,
  fmtMonthLabel,
  fmtRuDate,
  isAfterSlotLeave,
  monthNow,
  referenceDate,
  shiftMonth,
  statusWorkValue,
  todayIso,
  type AttendanceStatus,
  type TimesheetCell,
  type TimesheetRow
} from "@/components/timesheet/timesheet-shared";
import { buildTimesheetCommentMap, exportTimesheetXlsx } from "@/components/timesheet/timesheet-export";

type FiltersDto = { roles: string[]; employees: Array<{ id: number; fio: string; role: string; login: string }> };
type MatrixDto = { month: string; days: number[]; rows: TimesheetRow[]; locked: boolean };

const PAGE_SIZES = [10, 25, 50];

export function TimesheetWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const effectiveRole = useEffectiveRole();
  const auditQ = useTabelAudit();

  const [month, setMonth] = useState(monthNow());

  // Фильтры по паттерну «черновик → Применить» (как в макете).
  const [draft, setDraft] = useState({ role: "", branch: "", direction: "" });
  const [applied, setApplied] = useState({ role: "", branch: "", direction: "" });
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const [modalTarget, setModalTarget] = useState<CellTarget | null>(null);
  const [editDays, setEditDays] = useState<number[]>([]);
  const [pending, setPending] = useState<Record<string, AttendanceStatus>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const canEdit = canEditTimesheet(effectiveRole);
  const canOverrideSlotLeave = effectiveRole === "admin";

  const filtersQ = useQuery({
    queryKey: ["timesheet-filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FiltersDto }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data;
    }
  });

  const matrixQ = useQuery({
    queryKey: ["timesheet-matrix", tenantSlug, month, applied.role],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("month", month);
      if (applied.role) p.set("role", applied.role);
      const { data } = await api.get<{ data: MatrixDto }>(`/api/${tenantSlug}/timesheet?${p.toString()}`);
      return data.data;
    }
  });

  const locked = Boolean(matrixQ.data?.locked);
  const days = matrixQ.data?.days ?? [];
  const editing = canEdit && !locked;

  type BatchEntry = { userId: number; date: string; status: AttendanceStatus; comment?: string };

  // Единая мутация для всех правок табеля: и массовое «Сохранить», и правка одной
  // ячейки в модалке шлют ОДИН запрос /timesheet/batch (вместо N параллельных PATCH).
  const patchMut = useMutation({
    mutationFn: async (entries: BatchEntry[]) => {
      const { data } = await api.patch<{ ok: true; applied: number; changed: number }>(
        `/api/${tenantSlug}/timesheet/batch`,
        { entries: entries.map((e) => ({ ...e, source: "manual" })) }
      );
      return data;
    }
  });

  // Роль (Должность) фильтруется на сервере; поиск + сортировка — на клиенте.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let src = matrixQ.data?.rows ?? [];
    if (q) src = src.filter((r) => `${r.fio} ${r.role} ${r.login}`.toLowerCase().includes(q));
    if (sortDir) {
      src = [...src].sort((a, b) => {
        const cmp = a.fio.localeCompare(b.fio, "ru");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return src;
  }, [matrixQ.data?.rows, search, sortDir]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const refDate = referenceDate(month, days);
  const refLabel = fmtRuDate(refDate);
  const singleDay = editDays.length === 1 ? editDays[0] : null;

  const dateOf = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const effectiveStatus = (uid: number, cell: TimesheetCell): AttendanceStatus => pending[`${uid}:${cell.date}`] ?? cell.status;
  const workedTotal = (r: TimesheetRow): number => r.cells.reduce((acc, c) => acc + statusWorkValue(effectiveStatus(r.user_id, c)), 0);
  const pendingCount = Object.keys(pending).length;

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedRows.has(r.user_id));
  const filtersDirty = draft.role !== applied.role || draft.branch !== applied.branch || draft.direction !== applied.direction;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }

  function resetEdit() {
    setEditDays([]);
    setPending({});
  }

  function changeMonth(delta: number) {
    setMonth((m) => shiftMonth(m, delta));
    resetEdit();
    setPage(1);
  }

  function applyFilters() {
    setApplied(draft);
    setPage(1);
    setSelectedRows(new Set());
    showToast("Фильтры применены");
  }

  function clearFilters() {
    setDraft({ role: "", branch: "", direction: "" });
    setApplied({ role: "", branch: "", direction: "" });
    setSearch("");
    setPage(1);
  }

  function toggleRow(uid: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function toggleAll() {
    setSelectedRows((prev) => {
      if (filteredRows.every((r) => prev.has(r.user_id))) return new Set();
      return new Set(filteredRows.map((r) => r.user_id));
    });
  }

  function toggleSort() {
    setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
  }

  function toggleDay(d: number) {
    setEditDays((prev) => {
      if (prev.includes(d)) {
        setPending((p) => {
          const np = { ...p };
          for (const k of Object.keys(np)) if (k.endsWith(`:${dateOf(d)}`)) delete np[k];
          return np;
        });
        return prev.filter((x) => x !== d);
      }
      return [...prev, d].sort((a, b) => a - b);
    });
  }

  function selectRange(from: number, to: number) {
    const a = Math.max(1, Math.min(from, to));
    const b = Math.min(days.length, Math.max(from, to));
    const list = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    setEditDays(list);
    setPending((p) => {
      const np: Record<string, AttendanceStatus> = {};
      for (const [k, v] of Object.entries(p)) {
        const day = Number(k.split(":")[1]?.slice(8, 10));
        if (list.includes(day)) np[k] = v;
      }
      return np;
    });
    showToast(`Выбрано дней: ${list.length}`);
  }

  // Клик по заголовку дня раскрывает ТОЛЬКО эту колонку (как на макете TabelERP).
  // Клик по другому дню — переключает раскрытие на него (предыдущий сворачивается),
  // повторный клик по уже раскрытому дню — сворачивает. Мультивыбор для массового
  // ввода делается через панель «Дни» (диапазон), а не кликом по заголовку.
  function headerDayClick(d: number) {
    if (!editing) return;
    setEditDays((prev) => (prev.length === 1 && prev[0] === d ? [] : [d]));
  }

  function setWorkValue(r: TimesheetRow, cell: TimesheetCell, value: number) {
    if (!canOverrideSlotLeave && isAfterSlotLeave(r, cell.date)) {
      showToast("День после ухода со слота — только admin");
      return;
    }
    const status = WORK_STATUS_BY_VALUE[String(value)];
    setPending((p) => {
      const key = `${r.user_id}:${cell.date}`;
      const np = { ...p };
      if (cell.status === status) delete np[key];
      else np[key] = status;
      return np;
    });
  }

  function bulkApply(value: number) {
    if (editDays.length === 0) {
      showToast("Сначала выберите дни в «Дни»");
      return;
    }
    const status = WORK_STATUS_BY_VALUE[String(value)];
    const today = todayIso();
    const targets = selectedRows.size > 0 ? filteredRows.filter((r) => selectedRows.has(r.user_id)) : filteredRows;
    setPending((p) => {
      const np = { ...p };
      for (const r of targets) {
        for (const d of editDays) {
          const date = dateOf(d);
          if (date > today) continue;
          if (!canOverrideSlotLeave && isAfterSlotLeave(r, date)) continue;
          const cell = r.cells.find((c) => c.date === date);
          if (!cell) continue;
          const key = `${r.user_id}:${date}`;
          if (cell.status === status) delete np[key];
          else np[key] = status;
        }
      }
      return np;
    });
    const scope = selectedRows.size > 0 ? `${targets.length} сотр.` : "всем видимым";
    showToast(`«${value}» проставлен за ${editDays.length} дн. (${scope}) — нажмите «Сохранить»`);
  }

  function handleCellClick(r: TimesheetRow, c: TimesheetCell) {
    setModalTarget({
      userId: r.user_id,
      fio: r.fio,
      role: r.role,
      login: r.login,
      day: c.day,
      date: c.date,
      status: effectiveStatus(r.user_id, c),
      source: c.source
    });
  }

  async function saveEdits() {
    const pairs = Object.entries(pending);
    if (pairs.length === 0) {
      resetEdit();
      return;
    }
    const entries: BatchEntry[] = pairs.map(([key, status]) => {
      const [uid, date] = key.split(":");
      return { userId: Number(uid), date, status, comment: "Массовое редактирование в табеле" };
    });
    try {
      await patchMut.mutateAsync(entries);
      void qc.invalidateQueries({ queryKey: ["timesheet-matrix", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["tabel-audit", tenantSlug] });
      resetEdit();
      showToast(`Сохранено ячеек: ${entries.length}`);
    } catch {
      showToast("Не удалось сохранить");
    }
  }

  async function saveSingle(status: AttendanceStatus, comment: string) {
    if (!modalTarget) return;
    const prev = modalTarget.status;
    try {
      await patchMut.mutateAsync([
        {
          userId: modalTarget.userId,
          date: modalTarget.date,
          status,
          comment: comment.trim() || "Изменено в табеле"
        }
      ]);
      void qc.invalidateQueries({ queryKey: ["timesheet-matrix", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["tabel-audit", tenantSlug] });
      setModalTarget(null);
      showToast(prev !== status ? "Сохранено" : "Без изменений");
    } catch {
      showToast("Ошибка сохранения");
    }
  }

  const cellHistory = useMemo(() => {
    if (!modalTarget) return [];
    return (auditQ.data ?? []).filter(
      (a) => a.module === "timesheet" && a.title === modalTarget.fio && a.subtitle === modalTarget.date
    );
  }, [auditQ.data, modalTarget]);

  // Комментарии по ячейкам → Excel-примечания (ключ `${fio}:${date}`).
  const cellComments = useMemo(() => buildTimesheetCommentMap(auditQ.data), [auditQ.data]);

  // При смене страницы держим её в допустимых границах.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  return (
    <div className="tabel-theme space-y-3">
      {/* Заголовок + выбор месяца */}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Табель</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ежемесячный табель посещаемости сотрудников — интеграция KPI и зарплаты
          </p>
        </div>
        <div className="ml-auto">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Месяц и год</div>
          <div className="flex items-center overflow-hidden rounded-lg border bg-card shadow-sm">
            <button className="px-2.5 py-2 text-muted-foreground transition hover:bg-muted" onClick={() => changeMonth(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft className="size-4" />
            </button>
            <span className="flex min-w-[140px] items-center justify-center gap-2 px-3 text-center text-sm font-semibold">
              <CalendarDays className="size-3.5 text-primary" /> {fmtMonthLabel(month)}
            </span>
            <button className="px-2.5 py-2 text-muted-foreground transition hover:bg-muted" onClick={() => changeMonth(1)} aria-label="Следующий месяц">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <TimesheetStatCards rows={filteredRows} refDate={refDate} refLabel={refLabel} />

      {/* Фильтры */}
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Должность</label>
            <FilterSelect
              className="w-full"
              emptyLabel="Все"
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
            >
              {(filtersQ.data?.roles ?? []).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </FilterSelect>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Филиал</label>
            <FilterSelect
              className="w-full"
              emptyLabel="Все"
              value={draft.branch}
              onChange={(e) => setDraft((d) => ({ ...d, branch: e.target.value }))}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Направление продаж</label>
            <FilterSelect
              className="w-full"
              emptyLabel="Все"
              value={draft.direction}
              onChange={(e) => setDraft((d) => ({ ...d, direction: e.target.value }))}
            />
          </div>
          <Button
            variant={filtersDirty ? "default" : "secondary"}
            size="sm"
            onClick={applyFilters}
          >
            <Filter className="mr-1 size-3.5" /> Применить
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={clearFilters} title="Сбросить фильтры" aria-label="Сбросить фильтры">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-xs"
            placeholder="Поиск: имя или код..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Записей на странице"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400" onClick={() => setExportOpen(true)}>
          <FileSpreadsheet className="mr-1 size-3.5" /> Excel
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => void matrixQ.refetch()} title="Обновить" aria-label="Обновить">
          <RefreshCw className={cn("size-4 text-primary", matrixQ.isFetching && "animate-spin")} />
        </Button>

        {editing ? (
          <TimesheetEditToolbar
            month={month}
            days={days}
            editDays={editDays}
            onToggleDay={toggleDay}
            onSelectRange={selectRange}
            onClearDays={() => { setEditDays([]); setPending({}); }}
            onToday={() => setEditDays([Number(todayIso().slice(8, 10))])}
            onBulk={bulkApply}
          />
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={resetEdit} disabled={pendingCount === 0 && editDays.length === 0}>
                <X className="mr-1 size-3.5" /> Отменить
              </Button>
              <Button size="sm" disabled={patchMut.isPending || pendingCount === 0} onClick={() => void saveEdits()}>
                <Save className="mr-1 size-3.5" /> Сохранить
                {pendingCount > 0 ? <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[10px] font-bold">{pendingCount}</span> : null}
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Режим просмотра</span>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          <Zap className="size-3.5 shrink-0" />
          {editDays.length === 0 ? (
            <span>
              Нажмите на <b>заголовок дня</b> в таблице — раскроется только эта колонка с кнопками <b className="font-mono">0</b> / <b className="font-mono">0.5</b> / <b className="font-mono">1</b> по каждому сотруднику; спец-статус — через <span className="inline-flex align-middle"><Info className="size-3" /></span>. Для массового ввода за несколько дней выберите их в «Дни».
            </span>
          ) : editDays.length === 1 ? (
            <span>
              День <b className="font-mono">{String(editDays[0]).padStart(2, "0")}</b> открыт: в ячейках этой колонки нажимайте <b className="font-mono">0 / 0.5 / 1</b>, спец-статус — через <span className="inline-flex align-middle"><Info className="size-3" /></span>. Другой день — кликните его заголовок. В конце нажмите «Сохранить».
            </span>
          ) : (
            <span>
              Выбрано дней: <b className="font-mono">{editDays.length}</b>. Кнопки <b className="font-mono">0 / 0.5 / 1</b> на панели проставят значение{" "}
              {selectedRows.size > 0 ? <>выбранным <b>{selectedRows.size}</b> сотрудникам</> : <b>всем видимым</b>} за выбранные дни. Затем нажмите «Сохранить».
            </span>
          )}
        </div>
      ) : null}

      {locked ? <p className="text-xs text-amber-600">Период заблокирован для редактирования (payroll lock).</p> : null}

      <TimesheetTable
        rows={pageRows}
        days={days}
        month={month}
        editMode={editing}
        canEdit={editing}
        canOverrideSlotLeave={canOverrideSlotLeave}
        editDays={editDays}
        singleDay={singleDay}
        loading={matrixQ.isLoading}
        selectedRows={selectedRows}
        allSelected={allSelected}
        sortDir={sortDir}
        effectiveStatus={effectiveStatus}
        isPending={(uid, date) => `${uid}:${date}` in pending}
        workedTotal={workedTotal}
        onCellClick={handleCellClick}
        onWorkValue={setWorkValue}
        onHeaderClick={headerDayClick}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        onToggleSort={toggleSort}
      />

      {/* Пагинация */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm">
        <div className="text-xs text-muted-foreground">
          Показано{" "}
          <b className="text-foreground">
            {total === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)}
          </b>{" "}
          / {total}
          {selectedRows.size > 0 ? <span className="ml-2 text-primary">Выбрано: {selectedRows.size}</span> : null}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="rounded-md border p-1.5 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            aria-label="Назад"
          >
            <ChevronLeft className="size-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={cn(
                "grid size-8 place-items-center rounded-md text-xs font-bold transition",
                p === safePage ? "bg-primary text-primary-foreground shadow" : "border text-muted-foreground hover:bg-muted"
              )}
            >
              {p}
            </button>
          ))}
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            className="rounded-md border p-1.5 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            aria-label="Вперёд"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <TimesheetLegend canEdit={canEdit} />

      <TimesheetCellModal
        target={modalTarget}
        canEdit={canEdit}
        locked={locked}
        saving={patchMut.isPending}
        history={cellHistory}
        onSave={(s, c) => void saveSingle(s, c)}
        onClose={() => setModalTarget(null)}
      />

      <TimesheetExportDialog
        open={exportOpen}
        count={total}
        period={fmtMonthLabel(month)}
        onExport={(mode) => {
          exportTimesheetXlsx(month, days, filteredRows, mode, cellComments)
            .then(() => showToast("Файл Excel скачан"))
            .catch(() => showToast("Ошибка экспорта"));
          setExportOpen(false);
        }}
        onClose={() => setExportOpen(false)}
      />

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-2xl">
          <Check className="size-4 shrink-0 text-emerald-400" /> {toast}
        </div>
      ) : null}
    </div>
  );
}
