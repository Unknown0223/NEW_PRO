"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";

type AbsenceReqRow = {
  id: number;
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  type: string;
  from_ymd: string;
  to_ymd: string;
  hours: number | null;
  reason: string | null;
  status: string;
  decision_comment: string | null;
};

const REQ_TYPE_LABEL: Record<string, string> = {
  vacation: "Ежегодный отпуск",
  sick: "Больничный лист",
  trip: "Командировка",
  unpaid_leave: "Отпуск без содержания (БС)",
  overtime: "Сверхурочная работа",
  weekend_work: "Работа в выходной"
};

export function TabelRequestsWorkspace({ mode }: { mode: "absence" | "overtime" }) {
  const { tenantSlug } = useAuthStore();
  const perms = usePermissions();
  const canCreate = perms.hasAny("tabel.zayavki.create");
  const canApprove = perms.hasAny("tabel.zayavki.approve");
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState(mode === "overtime" ? "overtime" : "vacation");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [hours, setHours] = useState("4");
  const [reason, setReason] = useState("");

  const filtersQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: Array<{ id: number; fio: string; role: string }> } }>(
        `/api/${tenantSlug}/timesheet/filters`
      );
      return data.data.employees ?? [];
    }
  });

  const reqsQ = useQuery({
    queryKey: ["tabel", "absence-requests", tenantSlug, mode],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: AbsenceReqRow[] } }>(`/api/${tenantSlug}/tabel/absence-requests`, {
        params: { only_overtime: mode === "overtime" ? "true" : "false" }
      });
      return data.data.items ?? [];
    }
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/${tenantSlug}/tabel/absence-requests`, {
        user_id: Number(userId),
        type,
        from_date: fromDate,
        to_date: toDate,
        hours: mode === "overtime" ? Number(hours) || 4 : null,
        reason
      });
    },
    onSuccess: async () => {
      setReason("");
      await qc.invalidateQueries({ queryKey: ["tabel", "absence-requests", tenantSlug] });
    }
  });

  const decideMut = useMutation({
    mutationFn: async (vars: { id: number; action: "approve" | "reject" }) => {
      await api.post(`/api/${tenantSlug}/tabel/absence-requests/${vars.id}/${vars.action}`, {});
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "absence-requests", tenantSlug] });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold">
          {mode === "overtime" ? "Сверхурочные и работа в выходной" : "Заявки на отпуск, больничный и командировку"}
        </h1>
        <p className="text-xs text-muted-foreground">
          При утверждении заявки система автоматически проставляет соответствующий статус в Табеле и учитывает его в расчёте Зарплаты.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Сотрудник</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Выберите сотрудника...</option>
              {(filtersQ.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fio} ({emp.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Тип заявки</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {mode === "overtime" ? (
                <>
                  <option value="overtime">Сверхурочные часы</option>
                  <option value="weekend_work">Работа в выходной</option>
                </>
              ) : (
                <>
                  <option value="vacation">Ежегодный отпуск</option>
                  <option value="sick">Больничный</option>
                  <option value="trip">Командировка</option>
                  <option value="unpaid_leave">Без содержания (БС)</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">С даты</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">По дату</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{mode === "overtime" ? "Часов" : "Причина"}</label>
            <div className="flex gap-2">
              {mode === "overtime" ? (
                <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
              ) : (
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Комментарий" />
              )}
              <Button
                size="sm"
                disabled={!canCreate || !userId || createMut.isPending}
                onClick={() => void createMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Сотрудник</th>
              <th className="px-3 py-2.5">Вид</th>
              <th className="px-3 py-2.5">Период</th>
              <th className="px-3 py-2.5">Статус</th>
              <th className="px-3 py-2.5 text-right">Решение</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(reqsQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Заявок пока нет
                </td>
              </tr>
            ) : (
              (reqsQ.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{r.user_fio}</div>
                    <div className="text-[11px] text-muted-foreground">{r.user_role}</div>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {REQ_TYPE_LABEL[r.type] ?? r.type}
                    {r.hours ? ` (${r.hours} ч)` : ""}
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    {r.from_ymd} — {r.to_ymd}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        r.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status === "approved" ? "Утверждено" : r.status === "rejected" ? "Отклонено" : "Ожидает"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canApprove ? (
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-700" onClick={() => void decideMut.mutateAsync({ id: r.id, action: "approve" })}>
                        <Check className="mr-1 size-3" /> Утвердить
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-rose-700" onClick={() => void decideMut.mutateAsync({ id: r.id, action: "reject" })}>
                        <X className="mr-1 size-3" /> Отклонить
                      </Button>
                    </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ClearanceRow = {
  id: number;
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  status: string;
  warehouse_cleared: boolean;
  cash_cleared: boolean;
  consignment_cleared: boolean;
  equipment_cleared: boolean;
  work_slot_cleared: boolean;
  comment: string | null;
};

export function TabelClearanceWorkspace() {
  const { tenantSlug } = useAuthStore();
  const perms = usePermissions();
  const canCreate = perms.hasAny("tabel.obhodnye.create");
  const canUpdate = perms.hasAny("tabel.obhodnye.update", "tabel.obhodnye.approve");
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [comment, setComment] = useState("");

  const filtersQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: Array<{ id: number; fio: string; role: string }> } }>(
        `/api/${tenantSlug}/timesheet/filters`
      );
      return data.data.employees ?? [];
    }
  });

  const sheetsQ = useQuery({
    queryKey: ["tabel", "clearance-sheets", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: ClearanceRow[] } }>(`/api/${tenantSlug}/tabel/clearance-sheets`);
      return data.data.items ?? [];
    }
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/${tenantSlug}/tabel/clearance-sheets`, { user_id: Number(userId), comment });
    },
    onSuccess: async () => {
      setComment("");
      await qc.invalidateQueries({ queryKey: ["tabel", "clearance-sheets", tenantSlug] });
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; patch: Record<string, unknown> }) => {
      await api.patch(`/api/${tenantSlug}/tabel/clearance-sheets/${vars.id}`, vars.patch);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "clearance-sheets", tenantSlug] });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold">Обходные листы (Увольнение и проверка долгов)</h1>
        <p className="text-xs text-muted-foreground">
          Автоматическая сверка остатков склада, неподтверждённых оплат кассы, открытых заказов/консигнации, планшета и рабочего места (слота) перед увольнением.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs font-medium">Сотрудник</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Выберите сотрудника...</option>
              {(filtersQ.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fio} ({emp.role})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium">Примечание</label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Причина увольнения..." />
          </div>
          <Button
            size="sm"
            disabled={!canCreate || !userId || createMut.isPending}
            onClick={() => void createMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
          >
            <RefreshCw className="mr-1.5 size-4" /> Сформировать и проверить
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Сотрудник</th>
              <th className="px-3 py-2.5">Склад</th>
              <th className="px-3 py-2.5">Касса</th>
              <th className="px-3 py-2.5">Консигнация</th>
              <th className="px-3 py-2.5">Планшет / ИТ</th>
              <th className="px-3 py-2.5">Рабочий слот</th>
              <th className="px-3 py-2.5">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(sheetsQ.data ?? []).map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2.5 font-semibold">
                  {s.user_fio} <span className="text-muted-foreground">({s.user_role})</span>
                </td>
                {(
                  [
                    ["warehouse_cleared", s.warehouse_cleared],
                    ["cash_cleared", s.cash_cleared],
                    ["consignment_cleared", s.consignment_cleared],
                    ["equipment_cleared", s.equipment_cleared],
                    ["work_slot_cleared", s.work_slot_cleared]
                  ] as const
                ).map(([field, val]) => (
                  <td key={field} className="px-3 py-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={val} disabled={!canUpdate} onChange={(e) => void patchMut.mutateAsync({ id: s.id, patch: { [field]: e.target.checked } })} />
                      <span className={val ? "font-medium text-emerald-700" : "text-amber-700"}>
                        {val ? "Сдано" : "Долг/Не сдано"}
                      </span>
                    </label>
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${s.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {s.status === "approved" ? "Подписан" : "В процессе"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
