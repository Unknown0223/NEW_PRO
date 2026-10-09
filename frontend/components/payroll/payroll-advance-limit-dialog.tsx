"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useTenant } from "@/lib/api-client";
import { currentYm, payrollApi, payrollErrorText, roleLabel, ymQuery } from "@/lib/payroll/payroll-api";
import { parseAmount } from "@/components/payroll/payroll-ui";
import {
  PAYROLL_MODAL_INPUT,
  PAYROLL_MODAL_LIST,
  PAYROLL_MODAL_SELECT,
  PayrollDeleteButton,
  PayrollModal,
  PayrollModalActions,
  PayrollModalField,
  PayrollModalNote,
  usePayrollConfirm
} from "@/components/payroll/kit/payroll-kit-modal";

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
  const { confirm, dialog } = usePayrollConfirm();
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
    <>
      <PayrollModal open={target != null} onClose={onClose} title={existing ? `Лимит: ${limitWhom(existing)}` : "Новый лимит аванса"}>
        <div className="space-y-3.5">
          <PayrollModalField label="Тип" select>
            <select className={PAYROLL_MODAL_SELECT} value={d.scope} disabled={locked || !canEdit} onChange={(e) => setD({ ...d, scope: e.target.value as LimitScope })}>
              {Object.entries(LIMIT_SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </PayrollModalField>
          {d.scope === "role" ? (
            <PayrollModalField label="Роль" select>
              <select className={PAYROLL_MODAL_SELECT} value={d.role} disabled={locked || !canEdit} onChange={(e) => setD({ ...d, role: e.target.value })}>
                <option value="">— выберите —</option>
                {[...new Set([...roles, ...(d.role ? [d.role] : [])])].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </PayrollModalField>
          ) : null}
          {d.scope === "user" ? (
            locked ? (
              <PayrollModalField label="Сотрудник">
                <input className={PAYROLL_MODAL_INPUT} value={existing?.user_fio ?? ""} disabled />
              </PayrollModalField>
            ) : (
              <div className="space-y-1.5">
                <PayrollModalField label="Сотрудник">
                  <input className={PAYROLL_MODAL_INPUT} placeholder="Поиск по ФИО или коду" value={empQ} onChange={(e) => setEmpQ(e.target.value)} />
                </PayrollModalField>
                <select className={PAYROLL_MODAL_LIST} aria-label="Сотрудник" value={d.user_id} size={6} onChange={(e) => setD({ ...d, user_id: e.target.value })}>
                  {filteredEmp.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fio}{e.code ? ` (${e.code})` : ""} · {roleLabel(e.role)}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : null}
          <PayrollModalField label="Лимит в месяц">
            <GroupedNumberInput value={d.amount} placeholder="0" disabled={!canEdit} onValueChange={(v) => setD({ ...d, amount: v })} className={PAYROLL_MODAL_INPUT} />
          </PayrollModalField>
          <PayrollModalField label="Комментарий">
            <input className={PAYROLL_MODAL_INPUT} value={d.comment} disabled={!canEdit} onChange={(e) => setD({ ...d, comment: e.target.value })} />
          </PayrollModalField>
          {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
          <PayrollModalActions
            onCancel={onClose}
            onSubmit={canEdit ? () => save.mutate() : undefined}
            busy={save.isPending}
            disabled={!valid}
            left={
              existing && canEdit ? (
                <PayrollDeleteButton
                  disabled={remove.isPending}
                  onClick={async () => {
                    const ok = await confirm({ title: "Удаление записи", message: "Вы действительно хотите удалить этот лимит?", detail: `«${limitWhom(existing)}»`, confirmLabel: "Удалить", cancelLabel: "Отмена", destructive: true });
                    if (ok) remove.mutate(existing.id);
                  }}
                />
              ) : null
            }
          />
        </div>
      </PayrollModal>
      {dialog}
    </>
  );
}
