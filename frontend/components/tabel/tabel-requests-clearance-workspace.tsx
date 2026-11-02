"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { timesheetRoleLabel } from "@/components/timesheet/timesheet-shared";

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

function uniqueById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

const REQ_TYPE_LABEL: Record<string, string> = {
  vacation: "Ежегодный отпуск",
  sick: "Больничный лист",
  trip: "Командировка",
  unpaid_leave: "Отпуск без содержания",
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
  const [statusFilter, setStatusFilter] = useState("");

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

  const hoursNum = Number(hours);
  const hoursOk = mode !== "overtime" || (Number.isFinite(hoursNum) && hoursNum > 0 && hoursNum <= 24);
  const reasonOk = reason.trim().length >= 3;
  const rangeOk = Boolean(fromDate) && Boolean(toDate) && toDate >= fromDate;

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
        hours: mode === "overtime" ? hoursNum : null,
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
              {uniqueById(filtersQ.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fio}
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
                  <option value="unpaid_leave">Без содержания</option>
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
          <div className={mode === "overtime" ? "sm:col-span-2" : undefined}>
            <label className="mb-1 block text-xs font-medium">{mode === "overtime" ? "Часов и причина" : "Причина"}</label>
            <div className="flex gap-2">
              {mode === "overtime" ? (
                <Input type="number" min={0.5} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
              ) : null}
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина" />
              <Button
                size="sm"
                disabled={
                  !canCreate ||
                  !userId ||
                  createMut.isPending ||
                  !rangeOk ||
                  !reasonOk ||
                  !hoursOk
                }
                onClick={() => void createMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-end border-b px-3 py-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="approved">Утверждено</option>
            <option value="rejected">Отклонено</option>
          </select>
        </div>
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
            {(reqsQ.data ?? []).filter((r) => !statusFilter || r.status === statusFilter).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Заявок пока нет
                </td>
              </tr>
            ) : (
              (reqsQ.data ?? []).filter((r) => !statusFilter || r.status === statusFilter).map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{r.user_fio}</div>
                    <div className="text-[11px] text-muted-foreground">{timesheetRoleLabel(r.user_role)}</div>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {REQ_TYPE_LABEL[r.type] ?? r.type}
                    {r.hours ? ` (${r.hours} ч)` : ""}
                    {r.reason ? <div className="text-[11px] font-normal text-muted-foreground">{r.reason}</div> : null}
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
                    {canApprove && r.status === "pending" ? (
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

type ClearanceItem = { code: string; detail?: string };

function detailCount(row: ClearanceRow, code: string): number | null {
  const raw = (row.items_json ?? []).find((item) => item.code === code)?.detail ?? "";
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function clearanceNotes(row: ClearanceRow): Array<{ title: string; ok: boolean; text: string }> {
  const warehouses = detailCount(row, "warehouse");
  const payments = detailCount(row, "cash");
  const orders = detailCount(row, "consignment");
  const slots = detailCount(row, "work_slot");
  return [
    {
      title: "Склад",
      ok: row.warehouse_cleared,
      text: row.warehouse_cleared
        ? "Склад не привязан."
        : `Привязано складов: ${warehouses ?? "есть"}. Один и тот же склад считается один раз. Снимите склад у сотрудника и нажмите «Сформировать и проверить».`
    },
    {
      title: "Касса",
      ok: row.cash_cleared,
      text: row.cash_cleared
        ? "Неподтверждённых оплат нет."
        : `Неподтверждённых оплат: ${payments ?? "есть"}. Пока кассир их не подтвердит, лист не подписывается.`
    },
    {
      title: "Консигнация",
      ok: row.consignment_cleared,
      text: row.consignment_cleared
        ? "Открытых заказов нет."
        : `Открытых заказов: ${orders ?? "есть"}. Их нужно закрыть или передать другому сотруднику.`
    },
    {
      title: "Планшет",
      ok: row.equipment_cleared,
      text: row.equipment_cleared
        ? "Планшет отмечен как сданный."
        : "Планшет программа сама не видит. Когда его вернули, отметьте галочку в этой строке."
    },
    {
      title: "Рабочий слот",
      ok: row.work_slot_cleared,
      text: row.work_slot_cleared
        ? "Активного рабочего места нет."
        : `Активных рабочих мест: ${slots ?? "есть"}. Закройте место в разделе «Рабочее место», затем проверьте лист снова.`
    }
  ];
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
  items_json?: ClearanceItem[];
};

export function TabelClearanceWorkspace() {
  const { tenantSlug } = useAuthStore();
  const perms = usePermissions();
  const canCreate = perms.hasAny("tabel.obhodnye.create");
  const canUpdate = perms.hasAny("tabel.obhodnye.update", "tabel.obhodnye.approve");
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [comment, setComment] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

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
              {uniqueById(filtersQ.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fio}
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
            disabled={!canCreate || !userId || comment.trim().length < 3 || createMut.isPending}
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
            {(sheetsQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Листов пока нет
                </td>
              </tr>
            ) : null}
            {(sheetsQ.data ?? []).map((s) => {
              const detailOf = (code: string) => (s.items_json ?? []).find((item) => item.code === code)?.detail ?? "";
              const open = openId === s.id;
              const notes = open ? clearanceNotes(s) : [];
              return (
              <Fragment key={s.id}>
              <tr
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setOpenId((current) => (current === s.id ? null : s.id))}
              >
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{s.user_fio}</div>
                  <div className="text-[11px] text-muted-foreground">{timesheetRoleLabel(s.user_role)}</div>
                  {s.comment ? <div className="text-[11px] text-muted-foreground">{s.comment}</div> : null}
                </td>
                {(
                  [
                    ["warehouse_cleared", "warehouse", s.warehouse_cleared, false],
                    ["cash_cleared", "cash", s.cash_cleared, false],
                    ["consignment_cleared", "consignment", s.consignment_cleared, false],
                    ["equipment_cleared", "equipment", s.equipment_cleared, true],
                    ["work_slot_cleared", "work_slot", s.work_slot_cleared, false]
                  ] as const
                ).map(([field, code, val, manual]) => (
                  <td key={field} className="px-3 py-2.5">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={val}
                        disabled={!manual || !canUpdate}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void patchMut.mutateAsync({ id: s.id, patch: { [field]: e.target.checked } })}
                      />
                      <span>
                        <span className={val ? "font-medium text-emerald-700" : "text-amber-700"}>
                          {val ? "Сдано" : "Не сдано"}
                        </span>
                        {detailOf(code) ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{detailOf(code)}</span> : null}
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
              {open ? (
                <tr className="bg-muted/30">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {notes.map((note) => (
                        <div key={note.title} className="rounded-md border bg-card px-3 py-2">
                          <div className={note.ok ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>{note.title}</div>
                          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{note.text}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
