"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, History, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { ATTENDANCE_STATUSES, STATUS_META, type AttendanceStatus } from "@/components/timesheet/timesheet-shared";

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
            <label className="mb-1 block text-xs font-medium">Роль (необязательно)</label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="agent, operator..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Филиал (необязательно)</label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Все филиалы" />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              По умолчанию
            </label>
            <Button
              size="sm"
              disabled={saveMut.isPending}
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
                  {s.role || "Все роли"} · {s.branch || "Все филиалы"}
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

export function TabelCorrectionsWorkspace() {
  const { tenantSlug } = useAuthStore();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<AttendanceStatus>("worked");
  const [comment, setComment] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const filtersQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: Array<{ id: number; fio: string; role: string; branch: string | null }> } }>(
        `/api/${tenantSlug}/timesheet/filters`
      );
      return data.data.employees ?? [];
    }
  });

  const auditQ = useQuery({
    queryKey: ["tabel", "audit", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { records: Array<{ id: string; title: string; subtitle: string; oldValue: string; newValue: string; comment: string; changedBy: string; changedAt: string }> } }>(
        `/api/${tenantSlug}/tabel-audit`
      );
      return data.data.records ?? [];
    }
  });

  const patchMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/${tenantSlug}/timesheet/batch`, {
        entries: [{ userId: Number(userId), date, status, source: "manual", comment }]
      });
    },
    onSuccess: async () => {
      setSavedMsg("Корректировка сохранена и записана в историю.");
      await qc.invalidateQueries({ queryKey: ["tabel", "audit", tenantSlug] });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold">Корректировка табеля и история изменений</h1>
        <p className="text-xs text-muted-foreground">
          Ручное изменение статуса дня сотрудника с обязательным комментарием и фиксацией в журнале аудита.
        </p>
        {savedMsg ? <div className="mt-2 rounded bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">{savedMsg}</div> : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Сотрудник</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Выберите сотрудника...</option>
              {(filtersQ.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fio} ({emp.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Дата</label>
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
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
                  {STATUS_META[s].label} ({STATUS_META[s].short})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Комментарий</label>
            <div className="flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Причина..." />
              <Button
                size="sm"
                disabled={!userId || patchMut.isPending}
                onClick={() => void patchMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
              >
                <Save className="size-4" />
              </Button>
            </div>
          </div>
        </div>
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
              {(auditQ.data ?? []).slice(0, 50).map((r) => (
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
                    <span className="text-muted-foreground">{r.oldValue}</span> → <span className="font-semibold text-teal-700">{r.newValue}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
