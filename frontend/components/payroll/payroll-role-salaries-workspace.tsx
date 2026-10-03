"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileSpreadsheet, Save, Upload } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { money, payrollApi, roleLabel } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { FIELD_LABEL, parseAmount, useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollEmployeeConfigs, roleAllowanceColumns, type EmployeeConfig } from "@/components/payroll/payroll-employee-configs";
import { PayrollPageTitle, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import { PAYROLL_CARD, PAYROLL_SECONDARY_BTN } from "@/components/payroll/kit/payroll-kit-table";

type RoleConfig = {
  role: string;
  base_amount: number;
  currency: string;
  allowance_item_ids: number[];
  deduction_item_ids: number[];
  comment: string | null;
  item_amounts: Record<string, number>;
  employees: number;
};

type RoleDraft = { base: string; allowance: number[]; deduction: number[]; comment: string; parts: Record<string, string> };

const draftOf = (r: RoleConfig): RoleDraft => ({
  base: String(r.base_amount || ""),
  allowance: r.allowance_item_ids,
  deduction: r.deduction_item_ids,
  comment: r.comment ?? "",
  parts: Object.fromEntries(Object.entries(r.item_amounts ?? {}).map(([k, v]) => [k, String(v)]))
});

const partsPatch = (parts: Record<string, string>, columns: PayrollItem[]) =>
  Object.fromEntries(
    columns.map((c) => {
      const raw = parts[String(c.id)]?.trim() ?? "";
      return [String(c.id), raw === "" ? null : parseAmount(raw)];
    })
  );

function ItemChips({ items, value, onChange, disabled }: { items: PayrollItem[]; value: number[]; onChange: (v: number[]) => void; disabled: boolean }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">Нет статей</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = value.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== it.id) : [...value, it.id])}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

function RoleConfigCard({
  config,
  items,
  columns,
  onNotice
}: {
  config: RoleConfig;
  items: PayrollItem[];
  columns: PayrollItem[];
  onNotice: ReturnType<typeof useNotice>;
}) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const [d, setD] = useState<RoleDraft>(() => draftOf(config));
  const [open, setOpen] = useState(false);
  useEffect(() => setD(draftOf(config)), [config]);

  const dirty =
    parseAmount(d.base || "0") !== config.base_amount ||
    d.comment !== (config.comment ?? "") ||
    d.allowance.join() !== config.allowance_item_ids.join() ||
    d.deduction.join() !== config.deduction_item_ids.join() ||
    columns.some((c) => (d.parts[String(c.id)]?.trim() ? parseAmount(d.parts[String(c.id)]!) : undefined) !== config.item_amounts?.[String(c.id)]);

  const save = useMutation({
    mutationFn: () =>
      api.send("PUT", `/role-configs/${encodeURIComponent(config.role)}`, {
        base_amount: parseAmount(d.base || "0") || 0,
        allowance_item_ids: d.allowance,
        deduction_item_ids: d.deduction,
        comment: d.comment.trim() || null,
        item_amounts: partsPatch(d.parts, columns)
      }),
    onSuccess: () => {
      onNotice.ok(`Оклад роли «${roleLabel(config.role)}» сохранён. Зарплаты пересчитаются автоматически.`);
      void qc.invalidateQueries({ queryKey: ["payroll-role-configs", tenant] });
      void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
    },
    onError: onNotice.fail
  });

  const manual = items.filter((i) => !i.system_key && i.is_active);
  return (
    <div className={PAYROLL_CARD}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-foreground">Оклад роли «{roleLabel(config.role)}»</span>
          <span className="tabular-nums text-muted-foreground">{config.base_amount > 0 ? money(config.base_amount) : "не задан"}</span>
          <span className="text-muted-foreground">Надбавки: {config.allowance_item_ids.length || "все"}</span>
          <span className="text-muted-foreground">Удержания: {config.deduction_item_ids.length}</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-[var(--pr-line)] px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Применяется ко всем сотрудникам роли без индивидуального оклада. Делится по отработанным дням: {money(3000000)} × 20 из 26 ={" "}
              {money(Math.round((3000000 * 20) / 26))}. Выбранные надбавки — колонки таблицы ниже.
            </p>
            {canEdit ? (
              <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                <Save className="mr-1 size-4" /> Сохранить
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-[200px_1fr_1fr_220px]">
            <label className="grid content-start gap-1.5">
              <span className={FIELD_LABEL}>Оклад ({config.currency || "UZS"})</span>
              <GroupedNumberInput value={d.base} disabled={!canEdit} placeholder="0" onValueChange={(v) => setD((s) => ({ ...s, base: v }))} />
            </label>
            <div className="grid content-start gap-1.5">
              <span className={FIELD_LABEL}>Надбавки</span>
              <ItemChips items={manual.filter((i) => i.type === "allowance")} value={d.allowance} disabled={!canEdit} onChange={(v) => setD((s) => ({ ...s, allowance: v }))} />
            </div>
            <div className="grid content-start gap-1.5">
              <span className={FIELD_LABEL}>Удержания</span>
              <ItemChips items={manual.filter((i) => i.type === "deduction")} value={d.deduction} disabled={!canEdit} onChange={(v) => setD((s) => ({ ...s, deduction: v }))} />
            </div>
            <label className="grid content-start gap-1.5">
              <span className={FIELD_LABEL}>Комментарий</span>
              <Input value={d.comment} disabled={!canEdit} onChange={(e) => setD((s) => ({ ...s, comment: e.target.value }))} />
            </label>
          </div>
          {columns.length ? (
            <div className="mt-4 grid gap-1.5">
              <span className={FIELD_LABEL}>Суммы надбавок по умолчанию (если у сотрудника не задано своё)</span>
              <div className="flex flex-wrap gap-3">
                {columns.map((c) => (
                  <label key={c.id} className="grid w-[150px] gap-1">
                    <span className="truncate text-xs text-muted-foreground" title={c.name}>
                      {c.name}
                    </span>
                    <GroupedNumberInput
                      value={d.parts[String(c.id)] ?? ""}
                      disabled={!canEdit}
                      placeholder="—"
                      onValueChange={(v) => setD((s) => ({ ...s, parts: { ...s.parts, [String(c.id)]: v } }))}
                      className="h-8 text-right"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PayrollRoleSalariesWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const notice = useNotice();
  const [role, setRole] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const rolesQ = useQuery({ queryKey: ["payroll-role-configs", tenant], enabled: Boolean(tenant), queryFn: () => api.get<RoleConfig[]>("/role-configs") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const roles = useMemo(() => rolesQ.data ?? [], [rolesQ.data]);
  useEffect(() => {
    if (!role && roles.length) setRole(roles[0]!.role);
  }, [role, roles]);
  const config = roles.find((r) => r.role === role);
  const columns = useMemo(() => roleAllowanceColumns(itemsQ.data ?? [], config?.allowance_item_ids), [itemsQ.data, config?.allowance_item_ids]);

  const downloadTemplate = async () => {
    try {
      const list = await api.get<EmployeeConfig[]>("/employee-configs");
      const rows = list
        .filter((r) => !role || r.role === role)
        .map((r) => [r.code ?? "", r.fio, r.branch ?? "", r.cash_desk_name ?? "", r.base_amount ?? "", ...columns.map((c) => r.item_amounts[String(c.id)] ?? "")]);
      await downloadXlsx(
        `oklady-${role || "shablon"}.xlsx`,
        ["Код", "ФИО", "Филиал", "Касса", "Базовый оклад", ...columns.map((c) => c.name)],
        rows,
        "Оклады"
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="role-salaries" />
      <PayrollPageTitle
        title="Базовые оклады"
        description="Здесь задаются части оклада: по умолчанию для роли и индивидуально для сотрудника. В формулах значение доступно как «Оклад - <надбавка>» или «Оклад статьи» (сумма той статьи, для которой считается формула); статья с расчётом «Формула» без формулы не начисляется, «Вручную» — начисляется как есть."
        actions={
          <>
            <button type="button" className={PAYROLL_SECONDARY_BTN} onClick={() => void downloadTemplate()}>
              <FileSpreadsheet className="size-4 text-emerald-600" /> Шаблон
            </button>
            {canEdit ? (
              <Button onClick={() => setImportOpen(true)}>
                <Upload className="mr-1.5 size-4" /> Импорт из Excel
              </Button>
            ) : null}
          </>
        }
      />
      {roles.length ? (
        <PayrollSegmentedTabs tabs={roles.map((r) => ({ id: r.role, label: roleLabel(r.role), count: r.employees }))} value={role} onChange={setRole} />
      ) : null}
      {notice.element}
      {config ? <RoleConfigCard config={config} items={itemsQ.data ?? []} columns={columns} onNotice={notice} /> : null}
      <PayrollEmployeeConfigs role={role} columns={columns} importOpen={importOpen} onImportOpenChange={setImportOpen} onNotice={notice} />
    </PageShell>
  );
}
