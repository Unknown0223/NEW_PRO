"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Save } from "lucide-react";
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
import { PayrollEmployeeConfigs, type EmployeeConfig } from "@/components/payroll/payroll-employee-configs";
import { PayrollPageTitle, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";

type RoleConfig = {
  role: string;
  base_amount: number;
  currency: string;
  allowance_item_ids: number[];
  deduction_item_ids: number[];
  comment: string | null;
  employees: number;
};

type RoleDraft = { base: string; allowance: number[]; deduction: number[]; comment: string };

const draftOf = (r: RoleConfig): RoleDraft => ({
  base: String(r.base_amount || ""),
  allowance: r.allowance_item_ids,
  deduction: r.deduction_item_ids,
  comment: r.comment ?? ""
});

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

function RoleConfigCard({ config, items, onNotice }: { config: RoleConfig; items: PayrollItem[]; onNotice: ReturnType<typeof useNotice> }) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const [d, setD] = useState<RoleDraft>(() => draftOf(config));
  useEffect(() => setD(draftOf(config)), [config]);

  const dirty =
    parseAmount(d.base || "0") !== config.base_amount ||
    d.comment !== (config.comment ?? "") ||
    d.allowance.join() !== config.allowance_item_ids.join() ||
    d.deduction.join() !== config.deduction_item_ids.join();

  const save = useMutation({
    mutationFn: () =>
      api.send("PUT", `/role-configs/${encodeURIComponent(config.role)}`, {
        base_amount: parseAmount(d.base || "0") || 0,
        allowance_item_ids: d.allowance,
        deduction_item_ids: d.deduction,
        comment: d.comment.trim() || null
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
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Оклад роли «{roleLabel(config.role)}»</h2>
          <p className="text-xs text-muted-foreground">
            Применяется ко всем сотрудникам роли без индивидуального оклада. Делится по отработанным дням: {money(3000000)} × 20 из 26 = {money(Math.round((3000000 * 20) / 26))}.
          </p>
        </div>
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

  const downloadTemplate = async () => {
    try {
      const list = await api.get<EmployeeConfig[]>("/employee-configs");
      const rows = list.filter((r) => !role || r.role === role).map((r) => [r.code ?? "", r.base_amount ?? "", r.cash_desk_name ?? ""]);
      await downloadXlsx(`oklady-${role || "shablon"}.xlsx`, ["Код", "Оклад", "Касса"], rows, "Оклады");
    } catch (e) {
      notice.fail(e);
    }
  };

  return (
    <PageShell>
      <PayrollRelatedBar current="role-salaries" />
      <PayrollPageTitle
        title="Базовые оклады"
        description="Оклад по роли и индивидуальный оклад сотрудника (приоритетнее роли). Касса — откуда выдаётся зарплата."
        actions={
          <>
            <Button variant="outline" onClick={() => void downloadTemplate()}>
              <Download className="mr-1.5 size-4" /> Шаблон
            </Button>
            {canEdit ? (
              <Button onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="mr-1.5 size-4" /> Импорт из Excel
              </Button>
            ) : null}
          </>
        }
      />
      {roles.length ? (
        <PayrollSegmentedTabs tabs={roles.map((r) => ({ id: r.role, label: roleLabel(r.role), count: r.employees }))} value={role} onChange={setRole} />
      ) : null}
      {notice.element}
      {config ? <RoleConfigCard config={config} items={itemsQ.data ?? []} onNotice={notice} /> : null}
      <PayrollEmployeeConfigs role={role} importOpen={importOpen} onImportOpenChange={setImportOpen} onNotice={notice} />
    </PageShell>
  );
}
