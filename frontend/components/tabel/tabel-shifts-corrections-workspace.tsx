"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, History, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { branchVisibleName, isOpaqueBranchToken } from "@/lib/branch-options";
import { ATTENDANCE_STATUSES, STATUS_META, timesheetRoleLabel, type AttendanceStatus } from "@/components/timesheet/timesheet-shared";

const SHIFT_ROLES = [
  { value: "agent", label: "Агент" },
  { value: "cashier", label: "Кассир" },
  { value: "manager", label: "Менеджер" },
  { value: "merchandiser", label: "Мерчендайзер" },
  { value: "operator", label: "Оператор" },
  { value: "skladchik", label: "Складчик" },
  { value: "supervisor", label: "Супервайзер" },
  { value: "expeditor", label: "Экспедитор" }
] as const;

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function shiftRoleLabel(role: string | null): string {
  const raw = (role ?? "").trim().toLowerCase();
  if (!raw) return "Все роли";
  const hit = SHIFT_ROLES.find((r) => r.value === raw || r.label.toLowerCase() === raw);
  return hit?.label ?? timesheetRoleLabel(role ?? "");
}

function shiftBranchLabel(raw: string | null, names: string[]): string {
  if (!raw?.trim()) return "Все филиалы";
  const lookup = new Map(names.map((n) => [n.trim().toLowerCase(), n]));
  const visible = branchVisibleName(raw, lookup);
  if (visible) return visible;
  return isOpaqueBranchToken(raw) ? "Все филиалы" : raw.trim();
}

type ShiftRow = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_minutes: number;
  role: string | null;
  branch: string | null;
  is_default: boolean;
  is_active: boolean;
};

export function TabelShiftsWorkspace() {
  const { tenantSlug } = useAuthStore();
  const qc = useQueryClient();
  const [name, setName] = useState("Дневная смена");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [role, setRole] = useState("");
  const [branch, setBranch] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const branchesQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { branches: string[] } }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data.branches ?? [];
    }
  });

  const shiftsQ = useQuery({
    queryKey: ["tabel", "shifts", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: ShiftRow[] } }>(`/api/${tenantSlug}/tabel/shifts`);
      return data.data.items ?? [];
    }
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/${tenantSlug}/tabel/shifts`, {
        name,
        start_time: startTime,
        end_time: endTime,
        break_minutes: Number(breakMinutes) || 60,
        grace_minutes: Number(graceMinutes) || 15,
        role: role.trim() || null,
        branch: branch.trim() || null,
        is_default: isDefault
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "shifts", tenantSlug] });
    }
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/tabel/shifts/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "shifts", tenantSlug] });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold">Смены и расписание (Часы работы)</h1>
        <p className="text-xs text-muted-foreground">
          Настройка времени начала и окончания смен (например 08:00–17:00, 09:00–18:00), обеда и допустимых минут опоздания (grace period).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Название смены</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Дневная 09:00–18:00" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Начало</label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Окончание</label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Обед (мин)</label>
            <Input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Льгота опоздания (мин)</label>
            <Input type="number" value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Роль</label>
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Все роли</option>
              {SHIFT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Филиал</label>
            <select className={selectClass} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Все филиалы</option>
              {(branchesQ.data ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              По умолчанию
            </label>
            <Button
              size="sm"
              disabled={saveMut.isPending || !name.trim() || !startTime || !endTime}
              onClick={() => void saveMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
            >
              <Plus className="mr-1.5 size-4" /> Добавить смену
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Название</th>
              <th className="px-3 py-2.5">Часы работы</th>
              <th className="px-3 py-2.5">Обед / Льгота</th>
              <th className="px-3 py-2.5">Роль / Филиал</th>
              <th className="px-3 py-2.5 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(shiftsQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Смен пока нет
                </td>
              </tr>
            ) : null}
            {(shiftsQ.data ?? []).map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2.5 font-semibold">
                  {s.name} {s.is_default ? <span className="ml-1 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-800">По умолчанию</span> : null}
                </td>
                <td className="px-3 py-2.5 font-mono">
                  <Clock className="mr-1 inline size-3.5 text-muted-foreground" />
                  {s.start_time} – {s.end_time}
                </td>
                <td className="px-3 py-2.5">
                  Обед {s.break_minutes} мин · Льгота {s.grace_minutes} мин
                </td>
                <td className="px-3 py-2.5">
                  {shiftRoleLabel(s.role)} · {shiftBranchLabel(s.branch, branchesQ.data ?? [])}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-rose-600"
                    onClick={() => void delMut.mutateAsync(s.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MAX_CORRECTION_DAYS = 31;

function correctionDays(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cur.getTime() <= last.getTime() && out.length <= MAX_CORRECTION_DAYS) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

type AuditRow = {
  id: string;
  module?: string;
  kind?: string;
  title: string;
  subtitle?: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
  changedBy: string;
  changedAt: string;
};

export function TabelCorrectionsWorkspace() {
  const { tenantSlug } = useAuthStore();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [picked, setPicked] = useState("");
  const [userIds, setUserIds] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState<AttendanceStatus>("worked");
  const [comment, setComment] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const filtersQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: Array<{ id: number; fio: string }> } }>(
        `/api/${tenantSlug}/timesheet/filters`
      );
      return data.data.employees ?? [];
    }
  });

  const employees = filtersQ.data ?? [];
  const nameById = new Map(employees.map((e) => [e.id, e.fio]));
  const days = correctionDays(dateFrom, dateTo);
  const commentOk = comment.trim().length >= 3;
  const rangeOk = days.length > 0 && days.length <= MAX_CORRECTION_DAYS;
  const canSave = userIds.length > 0 && commentOk && rangeOk && !days.some((d) => d > today);

  const cellQ = useQuery({
    queryKey: ["timesheet-matrix", tenantSlug, "correction-preview", userIds[0], dateFrom.slice(0, 7)],
    enabled: Boolean(tenantSlug) && userIds.length === 1 && dateFrom === dateTo && /^\d{4}-\d{2}/.test(dateFrom),
    queryFn: async () => {
      const { data } = await api.get<{
        data: { rows: Array<{ user_id: number; cells: Array<{ date: string; status: AttendanceStatus }> }> };
      }>(`/api/${tenantSlug}/timesheet`, { params: { month: dateFrom.slice(0, 7), user_id: userIds[0] } });
      const row = (data.data.rows ?? []).find((r) => r.user_id === userIds[0]);
      return row?.cells.find((c) => c.date === dateFrom)?.status ?? null;
    }
  });

  const auditQ = useQuery({
    queryKey: ["tabel", "audit", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { records: AuditRow[] } }>(`/api/${tenantSlug}/tabel-audit`);
      return (data.data.records ?? []).filter((r) => r.module === "timesheet" && r.kind === "status");
    }
  });

  const patchMut = useMutation({
    mutationFn: async () => {
      const note = comment.trim();
      await api.patch(`/api/${tenantSlug}/timesheet/batch`, {
        entries: userIds.flatMap((id) => days.map((date) => ({ userId: id, date, status, source: "manual" as const, comment: note })))
      });
    },
    onSuccess: async () => {
      setComment("");
      setSavedMsg("Корректировка сохранена и записана в историю.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tabel", "audit", tenantSlug] }),
        qc.invalidateQueries({ queryKey: ["timesheet-matrix", tenantSlug] }),
        qc.invalidateQueries({ queryKey: ["timesheet-history", tenantSlug] })
      ]);
    }
  });

  function addEmployee(raw: string) {
    const id = Number(raw);
    setPicked("");
    setSavedMsg(null);
    if (!Number.isFinite(id) || id <= 0) return;
    setUserIds((curr) => (curr.includes(id) ? curr : [...curr, id]));
  }

  const history = (auditQ.data ?? []).slice(0, 50);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold">Корректировка табеля и история изменений</h1>
        <p className="text-xs text-muted-foreground">
          Один сотрудник или несколько, один день или диапазон. Комментарий обязателен и попадает в историю.
        </p>
        {savedMsg ? <div className="mt-2 rounded bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">{savedMsg}</div> : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium">Сотрудник</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={picked}
              onChange={(e) => addEmployee(e.target.value)}
            >
              <option value="">Выберите сотрудника...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fio}
                </option>
              ))}
            </select>
            {userIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {userIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="rounded-full border bg-muted px-2 py-0.5 text-xs"
                    onClick={() => setUserIds((curr) => curr.filter((x) => x !== id))}
                  >
                    {nameById.get(id) || "Сотрудник"} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Дата с</label>
            <Input type="date" value={dateFrom} max={today} onChange={(e) => { setDateFrom(e.target.value); setSavedMsg(null); }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Дата по</label>
            <Input type="date" value={dateTo} max={today} onChange={(e) => { setDateTo(e.target.value); setSavedMsg(null); }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Новый статус</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            >
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium">Комментарий</label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Почему меняется день" />
            {comment.trim().length > 0 && !commentOk ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Напишите хотя бы 3 символа.</p>
            ) : null}
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              disabled={!canSave || patchMut.isPending}
              onClick={() => void patchMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
            >
              <Save className="mr-1.5 size-4" />
              Сохранить
            </Button>
          </div>
        </div>
        {userIds.length === 1 && dateFrom === dateTo && cellQ.data ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Сейчас в ячейке: <span className="font-medium text-foreground">{STATUS_META[cellQ.data].label}</span>
          </p>
        ) : null}
        {!rangeOk && dateFrom && dateTo ? (
          <p className="mt-2 text-xs text-rose-600">Можно изменить не больше {MAX_CORRECTION_DAYS} дней за раз.</p>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
          <History className="size-4 text-muted-foreground" /> История корректировок табеля
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Когда / Кто</th>
                <th className="px-3 py-2">Сотрудник / Дата</th>
                <th className="px-3 py-2">Было → Стало</th>
                <th className="px-3 py-2">Комментарий</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Корректировок пока нет
                  </td>
                </tr>
              ) : (
                history.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.changedBy}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(r.changedAt).toLocaleString("ru-RU")}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">{r.subtitle}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground">{r.oldValue || "—"}</span> →{" "}
                      <span className="font-semibold text-teal-700">{r.newValue || "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.comment || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
