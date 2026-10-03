"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useTenant } from "@/lib/api-client";
import { currentYm, payrollApi, payrollErrorText, roleLabel, ymQuery } from "@/lib/payroll/payroll-api";
import { Field, NATIVE_SELECT, parseAmount } from "@/components/payroll/payroll-ui";

export type LimitScope = "global" | "role" | "user";
export type AdvanceLimit = {
  id: number;
  scope: LimitScope;
  role: string | null;
  user_id: number | null;
  user_fio: string | null;
  max_amount: number;
  is_exception: boolean;
  comment: string | null;
  updated_at: string;
};
type Employee = { id: number; fio: string; code: string | null; role: string; branch: string | null };
type Draft = { scope: LimitScope; role: string; user_id: string; amount: string; comment: string };

export const LIMIT_SCOPE_LABEL: Record<LimitScope, string> = { global: "Для всех", role: "По роли", user: "Исключение для сотрудника" };
export const limitWhom = (l: AdvanceLimit) => (l.scope === "global" ? "Все сотрудники" : l.scope === "role" ? roleLabel(l.role) : l.user_fio ?? `#${l.user_id}`);

const EMPTY: Draft = { scope: "role", role: "", user_id: "", amount: "", comment: "" };

export function PayrollAdvanceLimitDialog({
  target,
  canEdit,
  onClose,
  onSaved
}: {
  target: AdvanceLimit | "new" | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const { confirm, dialog } = useAppConfirm();
  const isNew = target === "new";
  const existing = target && target !== "new" ? target : null;
  const [d, setD] = useState<Draft>(EMPTY);
  const [empQ, setEmpQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setEmpQ("");
    if (existing) {
      setD({ scope: existing.scope, role: existing.role ?? "", user_id: existing.user_id ? String(existing.user_id) : "", amount: String(existing.max_amount), comment: existing.comment ?? "" });
    } else if (isNew) setD(EMPTY);
  }, [existing, isNew]);

  const employeesQ = useQuery({
    queryKey: ["payroll-advance-employees", tenant, "limits"],
    enabled: Boolean(tenant) && target != null,
    queryFn: () => api.get<Employee[]>(`/advances/employees?${ymQuery(currentYm())}`)
  });
  const employees = useMemo(() => employeesQ.data ?? [], [employeesQ.data]);
  const roles = useMemo(() => [...new Set(employees.map((e) => e.role))].sort(), [employees]);
  const filteredEmp = useMemo(() => {
    const s = empQ.trim().toLowerCase();
    return employees.filter((e) => !s || `${e.fio} ${e.code ?? ""}`.toLowerCase().includes(s)).slice(0, 200);
  }, [employees, empQ]);

  const save = useMutation({
    mutationFn: () =>
      api.send("PUT", "/advance-limits", {
        scope: d.scope,
        role: d.scope === "role" ? d.role : null,
        user_id: d.scope === "user" ? Number(d.user_id) : null,
        max_amount: parseAmount(d.amount),
        is_exception: d.scope === "user",
        comment: d.comment.trim() || null
      }),
    onSuccess: () => {
      onSaved("Лимит сохранён");
      onClose();
    },
    onError: (e) => setError(payrollErrorText(e))
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/advance-limits/${id}`),
    onSuccess: () => {
      onSaved("Лимит удалён");
      onClose();
    },
    onError: (e) => setError(payrollErrorText(e))
  });

  const valid =
    d.amount.trim() !== "" && Number.isFinite(parseAmount(d.amount)) && (d.scope !== "role" || d.role) && (d.scope !== "user" || d.user_id);
  const locked = Boolean(existing);

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="payroll-template sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Лимит: ${limitWhom(existing)}` : "Новый лимит аванса"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Тип">
            <select className={NATIVE_SELECT} value={d.scope} disabled={locked || !canEdit} onChange={(e) => setD({ ...d, scope: e.target.value as LimitScope })}>
              {Object.entries(LIMIT_SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {d.scope === "role" ? (
            <Field label="Роль">
              <select className={NATIVE_SELECT} value={d.role} disabled={locked || !canEdit} onChange={(e) => setD({ ...d, role: e.target.value })}>
                <option value="">— выберите —</option>
                {[...new Set([...roles, ...(d.role ? [d.role] : [])])].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
          ) : null}
          {d.scope === "user" ? (
            <Field label="Сотрудник">
              {locked ? (
                <Input value={existing?.user_fio ?? ""} disabled className="h-9" />
              ) : (
                <>
                  <Input placeholder="Поиск по ФИО или коду" value={empQ} onChange={(e) => setEmpQ(e.target.value)} className="h-9" />
                  <select className={NATIVE_SELECT} value={d.user_id} size={6} onChange={(e) => setD({ ...d, user_id: e.target.value })}>
                    {filteredEmp.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fio}{e.code ? ` (${e.code})` : ""} · {roleLabel(e.role)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </Field>
          ) : null}
          <Field label="Лимит в месяц">
            <GroupedNumberInput value={d.amount} placeholder="0" disabled={!canEdit} onValueChange={(v) => setD({ ...d, amount: v })} />
          </Field>
          <Field label="Комментарий">
            <Input value={d.comment} disabled={!canEdit} onChange={(e) => setD({ ...d, comment: e.target.value })} className="h-9" />
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex items-center justify-between gap-2 pt-2">
            {existing && canEdit ? (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={remove.isPending}
                onClick={async () => {
                  const ok = await confirm({ title: "Удалить лимит", message: `Удалить лимит «${limitWhom(existing)}»?`, confirmLabel: "Удалить", cancelLabel: "Отмена", destructive: true });
                  if (ok) remove.mutate(existing.id);
                }}
              >
                <Trash2 className="mr-1 size-4" /> Удалить
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
              <Button size="sm" disabled={!canEdit || !valid || save.isPending} onClick={() => save.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        </div>
        {dialog}
      </DialogContent>
    </Dialog>
  );
}
