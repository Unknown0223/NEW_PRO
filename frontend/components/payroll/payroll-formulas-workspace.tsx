"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { fmtDateTime, payrollApi, roleLabel, STATUS_TONE } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { TonePill, useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { FORMULA_SCOPES, PayrollFormulaEditor, type FormulaDraft } from "@/components/payroll/payroll-formula-editor";
import { PayrollPageTitle, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollIconAction,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

export type Formula = FormulaDraft & { id: number; target_item_name: string | null; assignments: number; updated_at: string };
type Tab = "write" | "saved";

const SCOPE_LABEL = Object.fromEntries(FORMULA_SCOPES.map((s) => [s.v, s.label])) as Record<string, string>;
const EMPTY: FormulaDraft = { name: "", scope: "bonus", text: "", role: null, target_item_id: null, priority: 100, is_active: true };

export function PayrollFormulasWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.hasAny("staff.zarplaty.update", "staff.zarplaty.create");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [tab, setTab] = useState<Tab>("write");
  const [draft, setDraft] = useState<FormulaDraft>({ ...EMPTY });
  const [q, setQ] = useState("");
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.formulas", defaultColumnOrder: ["name"], defaultPageSize: 20 });

  const listQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Formula[]>("/formulas") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const empQ = useQuery({
    queryKey: ["payroll-employee-configs", tenant, false],
    enabled: Boolean(tenant),
    queryFn: () => api.get<Array<{ user_id: number; fio: string; role: string }>>("/employee-configs")
  });
  const roles = [...new Set((empQ.data ?? []).map((e) => e.role))].sort();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((f) => !s || `${f.name} ${f.text} ${f.target_item_name ?? ""}`.toLowerCase().includes(s));
  }, [listQ.data, q]);
  const paged = usePagedRows(rows, prefs.pageSize, q);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["payroll-formulas", tenant] });

  const save = useMutation({
    mutationFn: (d: FormulaDraft) => {
      const body = {
        name: d.name.trim(),
        scope: d.scope,
        text: d.text,
        role: d.role,
        target_item_id: d.scope === "salary" ? null : d.target_item_id,
        priority: d.priority,
        is_active: d.is_active
      };
      return d.id ? api.send("PATCH", `/formulas/${d.id}`, body) : api.send("POST", "/formulas", body);
    },
    onSuccess: () => {
      setDraft({ ...EMPTY });
      setTab("saved");
      notice.ok("Формула сохранена. Зарплаты пересчитаются автоматически.");
      invalidate();
    },
    onError: notice.fail
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/formulas/${id}`),
    onSuccess: () => {
      notice.ok("Формула удалена");
      invalidate();
    },
    onError: notice.fail
  });

  const preset = useMutation({
    mutationFn: () =>
      api.send<{
        items_created: string[];
        formulas_created: string[];
        roles_updated: string[];
        kpi: { year: number; month: number; assigned: number; users: number; no_groups: number; extra_groups: number } | null;
      }>("POST", "/presets/res", {}),
    onSuccess: (r) => {
      const k = r.kpi;
      const parts = [
        `статьи — ${r.items_created.length}`,
        `формулы — ${r.formulas_created.length}`,
        k ? `KPI назначено: ${k.assigned} (сотрудников — ${k.users}) за ${String(k.month).padStart(2, "0")}.${k.year}` : null,
        k?.no_groups ? `без KPI-групп: ${k.no_groups}` : null,
        k?.extra_groups ? `больше 4 групп: ${k.extra_groups} — проверьте в «Настройках бонусов»` : null
      ].filter(Boolean);
      notice.ok(`Шаблон РЕС применён: ${parts.join("; ")}.`);
      setTab("saved");
      invalidate();
      void qc.invalidateQueries({ queryKey: ["payroll-items", tenant] });
      void qc.invalidateQueries({ queryKey: ["payroll-role-configs", tenant] });
    },
    onError: notice.fail
  });

  const applyPreset = async () => {
    const ok = await confirm({
      title: "Шаблон РЕС (из Excel)",
      message:
        "Будут созданы статьи «Дорожные», «Ноллаш», «KPI 1–4», «Общий KPI», «Доп бонус», «Учр бонус» и формулы: оклад и дорожные — по отработанным дням; KPI — 0 при выполнении ниже 60,9%, иначе выполнение (не более 120%) × сумма KPI сотрудника; для СВР — факт команды / план команды. Оклады ролей: ТП 2 000 000 / дорожные 1 000 000 / ноллаш 600 000, СВР 3 000 000 / 2 000 000 / 1 000 000 (если не заданы). Сотрудникам текущего месяца назначаются их KPI-группы → «KPI 1–4» (по порядку групп). Суммы KPI задайте в «Базовых окладах». Существующие статьи, формулы и назначения не изменяются.",
      confirmLabel: "Применить",
      cancelLabel: "Отмена"
    });
    if (ok) preset.mutate();
  };

  const edit = (f: Formula) => {
    setDraft({ id: f.id, name: f.name, scope: f.scope, text: f.text, role: f.role, target_item_id: f.target_item_id, priority: f.priority, is_active: f.is_active });
    setTab("write");
  };

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="formulas" />
      <PayrollPageTitle
        title="Формулы"
        description="Формулы бонусов, надбавок и оклада. Значения — в квадратных скобках, разделитель аргументов — «;», десятичная — «.»."
        actions={
          canEdit ? (
            <Button variant="outline" disabled={preset.isPending} onClick={() => void applyPreset()}>
              <FileSpreadsheet className="mr-1.5 size-4 text-emerald-600" /> Шаблон РЕС
            </Button>
          ) : null
        }
      />
      <PayrollSegmentedTabs<Tab>
        tabs={[
          { id: "write", label: draft.id ? "Изменить формулу" : "Написать формулу" },
          { id: "saved", label: "Готовые формулы", count: listQ.data?.length }
        ]}
        value={tab}
        onChange={setTab}
      />
      {notice.element}

      {tab === "write" ? (
        <PayrollFormulaEditor
          draft={draft}
          onChange={setDraft}
          onSave={() => save.mutate(draft)}
          onClear={() => setDraft({ ...EMPTY })}
          saving={save.isPending}
          canEdit={canEdit}
          items={itemsQ.data ?? []}
          roles={roles}
          employees={empQ.data ?? []}
        />
      ) : (
        <PayrollTableCard>
          <PayrollTableToolbar
            pageSize={prefs.pageSize}
            onPageSize={prefs.setPageSize}
            search={q}
            onSearch={setQ}
            searchPlaceholder="Поиск формулы"
            onRefresh={invalidate}
            refreshing={listQ.isFetching}
          />
          <div className="overflow-x-auto">
            <table className={PAYROLL_TABLE}>
              <thead className={PAYROLL_THEAD}>
                <tr>
                  <th className={TH}>Название</th>
                  <th className={TH}>Раздел</th>
                  <th className={TH}>Роль</th>
                  <th className={TH}>Статья</th>
                  <th className={TH}>Формула</th>
                  <th className={cn(TH, "text-right")}>Назначений</th>
                  <th className={TH}>Статус</th>
                  <th className={TH}>Изменена</th>
                  <th className={cn(TH, "w-24 text-center")}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {listQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={9} loading={listQ.isLoading} text="Формул пока нет" /> : null}
                {paged.pageRows.map((f) => (
                  <tr key={f.id} className={cn(PAYROLL_TR, !f.is_active && "opacity-60")}>
                    <td className={cn(TD, "font-medium text-foreground")}>{f.name}</td>
                    <td className={TD}>{SCOPE_LABEL[f.scope] ?? f.scope}</td>
                    <td className={cn(TD, "text-muted-foreground")}>{f.role ? roleLabel(f.role) : "—"}</td>
                    <td className={cn(TD, "text-muted-foreground")}>{f.target_item_name ?? "—"}</td>
                    <td className={cn(TD, "max-w-md truncate font-mono text-xs")} title={f.text}>{f.text}</td>
                    <td className={cn(TD, "text-right tabular-nums")}>{f.assignments}</td>
                    <td className={TD}>
                      <TonePill {...(f.is_active ? STATUS_TONE.emerald : STATUS_TONE.zinc)}>{f.is_active ? "Активна" : "Отключена"}</TonePill>
                    </td>
                    <td className={cn(TD, "text-xs text-muted-foreground")}>{fmtDateTime(f.updated_at)}</td>
                    <td className={cn(TD, "text-center")}>
                      {canEdit ? (
                        <div className="inline-flex gap-1.5">
                          <PayrollIconAction label="Изменить" tone="edit" onClick={() => edit(f)}>
                            <Pencil className="size-3.5" />
                          </PayrollIconAction>
                          <PayrollIconAction
                            label="Удалить"
                            tone="danger"
                            onClick={async () => {
                              const ok = await confirm({ title: "Удалить формулу", message: `Удалить «${f.name}»?`, confirmLabel: "Удалить", cancelLabel: "Отмена", destructive: true });
                              if (ok) remove.mutate(f.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </PayrollIconAction>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
        </PayrollTableCard>
      )}
      {dialog}
    </PageShell>
  );
}
