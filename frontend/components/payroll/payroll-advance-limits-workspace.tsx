"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, fmtDateTime, money, payrollApi, roleLabel, ymQuery } from "@/lib/payroll/payroll-api";
import { EmptyRow, Field, NATIVE_SELECT, parseAmount, useNotice } from "@/components/payroll/payroll-ui";

type Limit = { id: number; scope: "global" | "role" | "user"; role: string | null; user_id: number | null; user_fio: string | null; max_amount: number; is_exception: boolean; comment: string | null; updated_at: string };
type Employee = { id: number; fio: string; code: string | null; role: string; branch: string | null };
type Draft = { scope: "global" | "role" | "user"; role: string; user_id: string; amount: string; comment: string };

const SCOPE_LABEL = { global: "Для всех", role: "По роли", user: "Исключение для сотрудника" };

export function PayrollAdvanceLimitsWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.avans_limity.update");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [draft, setDraft] = useState<Draft>({ scope: "role", role: "", user_id: "", amount: "", comment: "" });
  const [empQ, setEmpQ] = useState("");

  const limitsQ = useQuery({ queryKey: ["payroll-advance-limits", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Limit[]>("/advance-limits") });
  const employeesQ = useQuery({
    queryKey: ["payroll-advance-employees", tenant, "limits"],
    enabled: Boolean(tenant),
    queryFn: () => api.get<Employee[]>(`/advances/employees?${ymQuery(currentYm())}`)
  });
  const employees = useMemo(() => employeesQ.data ?? [], [employeesQ.data]);
  const roles = useMemo(() => [...new Set(employees.map((e) => e.role))].sort(), [employees]);
  const filteredEmp = useMemo(() => {
    const s = empQ.trim().toLowerCase();
    return employees.filter((e) => !s || `${e.fio} ${e.code ?? ""}`.toLowerCase().includes(s)).slice(0, 200);
  }, [employees, empQ]);
  const limits = limitsQ.data ?? [];
  const global = limits.find((l) => l.scope === "global");

  const refresh = () => void qc.invalidateQueries({ queryKey: ["payroll-advance-limits", tenant] });
  const save = useMutation({
    mutationFn: (d: Draft) =>
      api.send("PUT", "/advance-limits", {
        scope: d.scope,
        role: d.scope === "role" ? d.role : null,
        user_id: d.scope === "user" ? Number(d.user_id) : null,
        max_amount: parseAmount(d.amount),
        is_exception: d.scope === "user",
        comment: d.comment.trim() || null
      }),
    onSuccess: () => {
      notice.ok("Лимит сохранён");
      setDraft((s) => ({ ...s, amount: "", comment: "", user_id: "" }));
      refresh();
    },
    onError: notice.fail
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/advance-limits/${id}`),
    onSuccess: () => { notice.ok("Лимит удалён"); refresh(); },
    onError: notice.fail
  });

  const validDraft =
    draft.amount.trim() !== "" &&
    Number.isFinite(parseAmount(draft.amount)) &&
    (draft.scope !== "role" || draft.role) &&
    (draft.scope !== "user" || draft.user_id);

  return (
    <PageShell>
      <PageHeader
        title="Лимиты авансов"
        description="Максимальная сумма авансов на сотрудника за месяц. Приоритет: исключение для сотрудника → лимит роли → общий лимит."
      />
      {notice.element}
      <div className="rounded-lg border bg-card p-4 text-sm">
        Общий лимит: <b>{global ? money(global.max_amount) : "не задан (без ограничения)"}</b>
      </div>

      {canEdit ? (
        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[180px_1fr_180px_1fr_auto] sm:items-end">
          <Field label="Тип">
            <select className={NATIVE_SELECT} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft["scope"] })}>
              {Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {draft.scope === "role" ? (
            <Field label="Роль">
              <select className={NATIVE_SELECT} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                <option value="">— выберите —</option>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
          ) : draft.scope === "user" ? (
            <Field label="Сотрудник">
              <div className="flex gap-1">
                <Input placeholder="Поиск" value={empQ} onChange={(e) => setEmpQ(e.target.value)} className="h-9 w-28" />
                <select className={NATIVE_SELECT} value={draft.user_id} onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}>
                  <option value="">— выберите —</option>
                  {filteredEmp.map((e) => <option key={e.id} value={e.id}>{e.fio}{e.code ? ` (${e.code})` : ""} · {roleLabel(e.role)}</option>)}
                </select>
              </div>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Лимит в месяц">
            <GroupedNumberInput value={draft.amount} placeholder="0" onValueChange={(v) => setDraft({ ...draft, amount: v })} />
          </Field>
          <Field label="Комментарий">
            <Input value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} className="h-9" />
          </Field>
          <Button size="sm" disabled={!validDraft || save.isPending} onClick={() => save.mutate(draft)}>Сохранить</Button>
        </div>
      ) : null}

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3">Кому</th>
              <th className="px-3 text-right">Лимит</th>
              <th className="px-3">Комментарий</th>
              <th className="px-3">Изменён</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {limitsQ.isLoading ? <EmptyRow colSpan={6} text="Загрузка…" /> : null}
            {!limitsQ.isLoading && limits.length === 0 ? <EmptyRow colSpan={6} text="Лимиты не заданы — авансы без ограничения" /> : null}
            {limits.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">{SCOPE_LABEL[l.scope]}</td>
                <td className="px-3">{l.scope === "global" ? "Все сотрудники" : l.scope === "role" ? roleLabel(l.role) : l.user_fio ?? `#${l.user_id}`}</td>
                <td className="px-3 text-right font-medium tabular-nums">{money(l.max_amount)}</td>
                <td className="px-3 text-muted-foreground">{l.comment ?? ""}</td>
                <td className="px-3 text-xs text-muted-foreground">{fmtDateTime(l.updated_at)}</td>
                <td className="px-2 text-right">
                  {canEdit ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Удалить"
                      onClick={async () => {
                        if (await confirm({ title: "Удалить лимит", message: "Лимит будет удалён.", confirmLabel: "Удалить", cancelLabel: "Отмена" })) remove.mutate(l.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </PageShell>
  );
}
