"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, fmtDateTime, money, payrollApi, roleLabel, ymQuery } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { parseAmount, useNotice } from "@/components/payroll/payroll-ui";
import {
  PAYROLL_FILTER_CONTROL,
  PayrollEmptyRow,
  PayrollFilterField,
  PayrollFiltersSection,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Limit = { id: number; scope: "global" | "role" | "user"; role: string | null; user_id: number | null; user_fio: string | null; max_amount: number; is_exception: boolean; comment: string | null; updated_at: string };
type Employee = { id: number; fio: string; code: string | null; role: string; branch: string | null };
type Draft = { scope: "global" | "role" | "user"; role: string; user_id: string; amount: string; comment: string };

const SCOPE_LABEL = { global: "Для всех", role: "По роли", user: "Исключение для сотрудника" };
const TH = "px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5";

const whom = (l: Limit) => (l.scope === "global" ? "Все сотрудники" : l.scope === "role" ? roleLabel(l.role) : l.user_fio ?? `#${l.user_id}`);

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
  const [q, setQ] = useState("");
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.advance-limits", defaultColumnOrder: ["scope"], defaultPageSize: 20 });

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
  const limits = useMemo(() => limitsQ.data ?? [], [limitsQ.data]);
  const global = limits.find((l) => l.scope === "global");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return limits.filter((l) => !s || `${whom(l)} ${l.comment ?? ""}`.toLowerCase().includes(s));
  }, [limits, q]);
  const paged = usePagedRows(rows, prefs.pageSize, q);

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
    onSuccess: () => {
      notice.ok("Лимит удалён");
      refresh();
    },
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
        actions={
          <span className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
            Общий лимит: <b>{global ? money(global.max_amount) : "не задан"}</b>
          </span>
        }
      />
      {canEdit ? (
        <PayrollFiltersSection>
          <PayrollFilterField label="Тип">
            <select className={filterPanelSelectClassName} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft["scope"] })}>
              {Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </PayrollFilterField>
          {draft.scope === "role" ? (
            <PayrollFilterField label="Роль">
              <select className={filterPanelSelectClassName} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                <option value="">— выберите —</option>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </PayrollFilterField>
          ) : null}
          {draft.scope === "user" ? (
            <PayrollFilterField label="Сотрудник">
              <div className="flex gap-1.5">
                <Input placeholder="Поиск" value={empQ} onChange={(e) => setEmpQ(e.target.value)} className={cn(PAYROLL_FILTER_CONTROL, "w-32")} />
                <select className={filterPanelSelectClassName} value={draft.user_id} onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}>
                  <option value="">— выберите —</option>
                  {filteredEmp.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fio}
                      {e.code ? ` (${e.code})` : ""} · {roleLabel(e.role)}
                    </option>
                  ))}
                </select>
              </div>
            </PayrollFilterField>
          ) : null}
          <PayrollFilterField label="Лимит в месяц">
            <GroupedNumberInput value={draft.amount} placeholder="0" onValueChange={(v) => setDraft({ ...draft, amount: v })} className={cn(PAYROLL_FILTER_CONTROL, "w-44")} />
          </PayrollFilterField>
          <PayrollFilterField label="Комментарий">
            <Input value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} className={cn(PAYROLL_FILTER_CONTROL, "w-56")} />
          </PayrollFilterField>
          <Button className="h-10 min-w-[132px] sm:ml-auto" disabled={!validDraft || save.isPending} onClick={() => save.mutate(draft)}>
            Сохранить
          </Button>
        </PayrollFiltersSection>
      ) : null}
      {notice.element}

      <PayrollTableCard>
        <PayrollTableToolbar pageSize={prefs.pageSize} onPageSize={prefs.setPageSize} search={q} onSearch={setQ} onRefresh={refresh} refreshing={limitsQ.isFetching} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className={TH}>Тип</th>
                <th className={TH}>Кому</th>
                <th className={cn(TH, "text-right")}>Лимит</th>
                <th className={TH}>Комментарий</th>
                <th className={TH}>Изменён</th>
                <th className={cn(TH, "w-20 text-center")}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {limitsQ.isLoading || rows.length === 0 ? (
                <PayrollEmptyRow colSpan={6} loading={limitsQ.isLoading} text="Лимиты не заданы — авансы без ограничения" />
              ) : null}
              {paged.pageRows.map((l) => (
                <tr key={l.id} className="border-b border-border/60 hover:bg-muted/40">
                  <td className={TD}>{SCOPE_LABEL[l.scope]}</td>
                  <td className={cn(TD, "font-medium text-foreground")}>{whom(l)}</td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums")}>{money(l.max_amount)}</td>
                  <td className={cn(TD, "text-muted-foreground")}>{l.comment ?? ""}</td>
                  <td className={cn(TD, "text-xs text-muted-foreground")}>{fmtDateTime(l.updated_at)}</td>
                  <td className={cn(TD, "text-center")}>
                    {canEdit ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Удалить"
                        onClick={async () => {
                          if (await confirm({ title: "Удалить лимит", message: "Лимит будет удалён.", confirmLabel: "Удалить", cancelLabel: "Отмена" })) remove.mutate(l.id);
                        }}
                      >
                        <Trash2 className="size-4 text-red-600" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
      </PayrollTableCard>
      {dialog}
    </PageShell>
  );
}
