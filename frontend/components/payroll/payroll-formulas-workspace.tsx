"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { fmtDateTime, payrollApi, roleLabel } from "@/lib/payroll/payroll-api";
import { EmptyRow, useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollFormulaEditor, type FormulaDraft } from "@/components/payroll/payroll-formula-editor";

type Formula = FormulaDraft & { id: number; target_item_name: string | null; assignments: number; updated_at: string };

const SCOPE_LABEL: Record<string, string> = { bonus: "Бонус (KPI)", allowance: "Надбавка по роли", salary: "Расчёт оклада", common: "Общая" };
const EMPTY: FormulaDraft = { name: "", scope: "bonus", text: "", role: null, target_item_id: null, priority: 100, is_active: true };

export function PayrollFormulasWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.hasAny("staff.zarplaty.update", "staff.zarplaty.create");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [draft, setDraft] = useState<FormulaDraft | null>(null);

  const listQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Formula[]>("/formulas") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const empQ = useQuery({
    queryKey: ["payroll-employee-configs", tenant, false],
    enabled: Boolean(tenant),
    queryFn: () => api.get<Array<{ user_id: number; fio: string; role: string }>>("/employee-configs")
  });
  const roles = [...new Set((empQ.data ?? []).map((e) => e.role))].sort();

  const save = useMutation({
    mutationFn: (d: FormulaDraft) => {
      const body = { name: d.name.trim(), scope: d.scope, text: d.text, role: d.role, target_item_id: d.scope === "salary" ? null : d.target_item_id, priority: d.priority, is_active: d.is_active };
      return d.id ? api.send("PATCH", `/formulas/${d.id}`, body) : api.send("POST", "/formulas", body);
    },
    onSuccess: () => {
      setDraft(null);
      notice.ok("Формула сохранена. Зарплаты пересчитаются автоматически.");
      void qc.invalidateQueries({ queryKey: ["payroll-formulas", tenant] });
    },
    onError: notice.fail
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/formulas/${id}`),
    onSuccess: () => {
      notice.ok("Формула удалена");
      void qc.invalidateQueries({ queryKey: ["payroll-formulas", tenant] });
    },
    onError: notice.fail
  });

  const rows = listQ.data ?? [];
  return (
    <PageShell>
      <PageHeader
        title="Конструктор формул"
        description="Формулы бонусов и надбавок. Переменные — в квадратных скобках, разделитель аргументов — «;», десятичная — «,» или «.»."
        actions={canEdit ? <Button size="sm" onClick={() => setDraft({ ...EMPTY })}><Plus className="mr-1 size-4" /> Новая формула</Button> : null}
      />
      {notice.element}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статья</TableHead>
              <TableHead>Формула</TableHead>
              <TableHead className="text-right">Назначений</TableHead>
              <TableHead>Изменена</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? <EmptyRow colSpan={8} text="Загрузка…" /> : rows.length === 0 ? <EmptyRow colSpan={8} text="Формул пока нет" /> : null}
            {rows.map((f) => (
              <TableRow key={f.id} className={f.is_active ? "" : "opacity-50"}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>{SCOPE_LABEL[f.scope] ?? f.scope}</TableCell>
                <TableCell>{f.role ? roleLabel(f.role) : "—"}</TableCell>
                <TableCell>{f.target_item_name ?? "—"}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={f.text}>{f.text}</TableCell>
                <TableCell className="text-right tabular-nums">{f.assignments}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(f.updated_at)}</TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setDraft({ ...f })} aria-label="Изменить"><Pencil className="size-4" /></Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Удалить"
                        onClick={async () => {
                          const ok = await confirm({ title: "Удалить формулу", message: `Удалить «${f.name}»?`, confirmLabel: "Удалить", cancelLabel: "Отмена", destructive: true });
                          if (ok) remove.mutate(f.id);
                        }}
                      >
                        <Trash2 className="size-4 text-red-600" />
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PayrollFormulaEditor
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={(d) => save.mutate(d)}
        saving={save.isPending}
        items={itemsQ.data ?? []}
        roles={roles}
        employees={empQ.data ?? []}
      />
      {dialog}
    </PageShell>
  );
}
