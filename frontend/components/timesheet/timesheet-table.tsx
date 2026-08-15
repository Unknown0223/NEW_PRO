"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WORK_VALUES,
  fmtRuDate,
  fmtTotal,
  initialsOf,
  isSunday,
  isWorkStatus,
  statusMeta,
  todayIso,
  weekdayOf,
  WEEKDAY_SHORT_RU,
  WORK_STATUS_BY_VALUE,
  type AttendanceStatus,
  type TimesheetCell,
  type TimesheetRow,
  isAfterSlotLeave
} from "@/components/timesheet/timesheet-shared";

/** Смещения (px) для «липких» левых колонок: чекбокс · Должность · Сотрудник. */
const STICKY_CHECKBOX = 0;
const STICKY_ROLE = 40;
const STICKY_NAME = 148;

export function TimesheetTable({
  rows,
  days,
  month,
  editMode,
  canEdit,
  canOverrideSlotLeave,
  editDays,
  singleDay,
  loading,
  selectedRows,
  allSelected,
  sortDir,
  effectiveStatus,
  isPending,
  workedTotal,
  onCellClick,
  onWorkValue,
  onHeaderClick,
  onToggleRow,
  onToggleAll,
  onToggleSort
}: {
  rows: TimesheetRow[];
  days: number[];
  month: string;
  editMode: boolean;
  canEdit: boolean;
  /** Admin: slotdan keyingi kunlarni ham tahrirlash mumkin. */
  canOverrideSlotLeave?: boolean;
  editDays: number[];
  singleDay: number | null;
  loading: boolean;
  selectedRows: Set<number>;
  allSelected: boolean;
  sortDir: "asc" | "desc" | null;
  effectiveStatus: (userId: number, cell: TimesheetCell) => AttendanceStatus;
  isPending: (userId: number, date: string) => boolean;
  workedTotal: (r: TimesheetRow) => number;
  onCellClick: (r: TimesheetRow, cell: TimesheetCell) => void;
  onWorkValue: (r: TimesheetRow, cell: TimesheetCell, value: number) => void;
  onHeaderClick: (day: number) => void;
  onToggleRow: (userId: number) => void;
  onToggleAll: () => void;
  onToggleSort: () => void;
}) {
  const today = todayIso();
  const selectedDays = new Set(editDays);
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-30">
          <tr>
            <th
              className="sticky z-40 w-10 min-w-10 border-b border-r bg-muted px-0 py-2 text-center"
              style={{ left: STICKY_CHECKBOX }}
            >
              <input
                type="checkbox"
                aria-label="Выбрать всех"
                className="size-3.5 accent-primary"
                checked={allSelected}
                onChange={onToggleAll}
                disabled={rows.length === 0}
              />
            </th>
            <th
              className="sticky z-40 min-w-[108px] border-b border-r bg-muted px-3 py-2 text-left font-semibold"
              style={{ left: STICKY_ROLE }}
            >
              Должность
            </th>
            <th
              className="sticky z-40 min-w-[240px] border-b border-r bg-muted px-3 py-2 text-left"
              style={{ left: STICKY_NAME }}
            >
              <button type="button" onClick={onToggleSort} className="flex items-center gap-1 font-semibold hover:text-primary">
                Сотрудник <SortIcon className="size-3 opacity-70" />
              </button>
            </th>
            <th className="min-w-[54px] border-b border-r bg-muted px-2 py-2 text-center font-semibold">Итого</th>
            {days.map((d) => {
              const date = `${month}-${String(d).padStart(2, "0")}`;
              const sun = isSunday(date);
              const isToday = date === today;
              const sel = editMode && selectedDays.has(d);
              // expand: только выбранная (одиночная) колонка дня раскрывается в широкие ячейки с 0/0.5/1.
              const isSingleHeader = singleDay === d;
              return (
                <th
                  key={d}
                  onClick={canEdit ? () => onHeaderClick(d) : undefined}
                  title={
                    !canEdit
                      ? undefined
                      : isSingleHeader
                        ? `${String(d).padStart(2, "0")} — свернуть колонку`
                        : `${String(d).padStart(2, "0")} — открыть колонку дня для ввода 0 / 0.5 / 1`
                  }
                  className={cn(
                    "border-b border-r px-1 py-1.5 text-center transition-colors",
                    isSingleHeader ? "min-w-[150px]" : "min-w-[44px]",
                    sel ? "bg-primary text-primary-foreground" : sun ? "bg-blue-50 dark:bg-blue-950/40" : "bg-muted",
                    !sel && isToday && "bg-primary/10",
                    canEdit && "cursor-pointer",
                    !sel && canEdit && "hover:bg-primary/20"
                  )}
                >
                  <div className={cn("flex items-center justify-center gap-1 font-mono font-bold", !sel && sun && "text-blue-500", !sel && isToday && "text-primary")}>
                    {String(d).padStart(2, "0")}
                  </div>
                  <div className={cn("font-mono text-[9px] uppercase", sel ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {WEEKDAY_SHORT_RU[weekdayOf(date)]}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const checked = selectedRows.has(r.user_id);
            const departed = Boolean(r.is_departed);
            return (
              <tr key={r.user_id} className={cn("group", checked && "bg-primary/[0.04]", departed && "bg-red-50/40 dark:bg-red-950/10")}>
                <td
                  className="sticky z-20 w-10 border-b border-r bg-card px-0 py-1.5 text-center group-hover:bg-muted/60"
                  style={{ left: STICKY_CHECKBOX }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Выбрать ${r.fio}`}
                    className="size-3.5 accent-primary"
                    checked={checked}
                    onChange={() => onToggleRow(r.user_id)}
                  />
                </td>
                <td
                  className="sticky z-20 border-b border-r bg-card px-3 py-1.5 group-hover:bg-muted/60"
                  style={{ left: STICKY_ROLE }}
                >
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium",
                      departed ? "text-red-600 dark:text-red-400" : "text-foreground/80"
                    )}
                  >
                    {r.role || "—"}
                  </span>
                </td>
                <td
                  className="sticky z-20 border-b border-r bg-card px-3 py-1.5 group-hover:bg-muted/60"
                  style={{ left: STICKY_NAME }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                        departed ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-primary/10 text-primary"
                      )}
                    >
                      {initialsOf(r.fio)}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={cn("truncate text-xs font-semibold", departed && "text-red-600 dark:text-red-400")}
                        title={departed && r.slot_left_at ? `${r.fio} · ушёл ${r.slot_left_at}` : r.fio}
                      >
                        {r.fio}
                        {departed ? " · ушёл" : ""}
                      </div>
                      <div className={cn("truncate font-mono text-[10px]", departed ? "text-red-500/80" : "text-muted-foreground")}>
                        {r.login}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="border-b border-r bg-muted/40 text-center font-mono font-bold text-primary">{fmtTotal(workedTotal(r))}</td>
                {r.cells.map((c) => {
                  const s = effectiveStatus(r.user_id, c);
                  const meta = statusMeta(s);
                  const changed = isPending(r.user_id, c.date);
                  const sun = isSunday(c.date);
                  const future = c.date > today;
                  const leaveLocked = isAfterSlotLeave(r, c.date) && !canOverrideSlotLeave;
                  const showFuture = future && !changed;
                  const sel = editMode && selectedDays.has(c.day);
                  const isSingle = singleDay === c.day;
                  const special = !isWorkStatus(s);
                  const cellEditable = canEdit && !leaveLocked;

                  const tdClass = cn(
                    "border-b border-r p-1 text-center align-middle",
                    sel ? "bg-primary/10" : !sel && sun ? "bg-blue-50/40 dark:bg-blue-950/20" : "",
                    isSingle && !sel && "bg-primary/[0.06]",
                    changed && "ring-1 ring-inset ring-primary",
                    leaveLocked && "opacity-50"
                  );

                  // Будущие даты — только просмотр (ввод запрещён backend'ом).
                  if (showFuture) {
                    return (
                      <td key={c.date} className={tdClass}>
                        <div className="grid h-8 place-items-center rounded-md bg-muted/40 font-mono text-[11px] font-bold text-muted-foreground/40">
                          ·
                        </div>
                      </td>
                    );
                  }

                  if (leaveLocked) {
                    return (
                      <td key={c.date} className={tdClass}>
                        <div
                          title={`${r.fio} · ${fmtRuDate(c.date)} — день после ухода со слота (только admin)`}
                          className={cn("grid h-8 w-full place-items-center rounded-md font-mono text-[11px] font-bold", meta.cell)}
                        >
                          {meta.short}
                        </div>
                      </td>
                    );
                  }

                  // Раскрытый вид (как на макете TabelERP): ТОЛЬКО одна выбранная колонка дня
                  // (isSingle) показывает встроенный выбор 0 / 0.5 / 1 + ⓘ по каждому сотруднику.
                  if (cellEditable && isSingle) {
                    return (
                      <td key={c.date} className={tdClass}>
                        <div className="flex items-center justify-center gap-1">
                          {WORK_VALUES.map((v) => {
                            const active = !special && WORK_STATUS_BY_VALUE[String(v)] === s;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => onWorkValue(r, c, v)}
                                title={`Поставить «${v}» — ${r.fio}, ${fmtRuDate(c.date)}`}
                                className={cn(
                                  "grid h-8 min-w-[26px] place-items-center rounded-md border font-mono text-[11px] font-bold transition",
                                  active
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-input bg-background text-muted-foreground hover:border-primary/60 hover:text-primary"
                                )}
                              >
                                {v}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => onCellClick(r, c)}
                            title={special ? `${meta.label} — открыть / изменить` : "Спец-статус, комментарий и история"}
                            className={cn(
                              "grid size-8 place-items-center rounded-md border transition",
                              special
                                ? "border-transparent text-white shadow-sm"
                                : "border-input bg-background text-muted-foreground hover:border-primary/60 hover:text-primary"
                            )}
                            style={special ? { backgroundColor: meta.color, borderColor: meta.color, color: "#fff" } : undefined}
                          >
                            {special ? <span className="font-mono text-[10px] font-bold">{meta.short}</span> : <Info className="size-3.5" />}
                          </button>
                        </div>
                      </td>
                    );
                  }

                  // Компактный вид по умолчанию (и для просмотра, и в режиме правки для
                  // НЕраскрытых колонок): одиночный цветной чип. Клик — открыть карточку/историю.
                  return (
                    <td key={c.date} className={tdClass}>
                      <button
                        type="button"
                        onClick={() => onCellClick(r, c)}
                        title={`${r.fio} · ${fmtRuDate(c.date)} — ${meta.label}${changed ? " (не сохранено)" : ""}`}
                        className={cn(
                          "grid h-8 w-full place-items-center rounded-md font-mono text-[11px] font-bold transition hover:opacity-80",
                          meta.cell
                        )}
                      >
                        {meta.short}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={days.length + 4} className="py-10 text-center text-sm text-muted-foreground">
                {loading ? "Загрузка..." : "Сотрудники не найдены"}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
