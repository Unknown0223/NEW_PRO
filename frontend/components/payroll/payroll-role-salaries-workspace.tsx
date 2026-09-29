"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { money, payrollApi, roleLabel } from "@/lib/payroll/payroll-api";
import { EmptyRow, parseAmount, useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollEmployeeConfigs } from "@/components/payroll/payroll-employee-configs";

type RoleConfig = {
  role: string;
  base_amount: number;
  currency: string;
  allowance_item_ids: number[];
  deduction_item_ids: number[];
  comment: string | null;
  employees: number;
};

type RowDraft = { base: string; allowance: number[]; deduction: number[]; comment: string };

function ItemChips({ items, value, onChange, disabled }: { items: PayrollItem[]; value: number[]; onChange: (v: number[]) => void; disabled: boolean }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => {
        const on = value.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== it.id) : [...value, it.id])}
            className={
              on
                ? "rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                : "rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/40"
            }
          >
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

function RoleConfigs() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const notice = useNotice();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  const rolesQ = useQuery({ queryKey: ["payroll-role-configs", tenant], enabled: Boolean(tenant), queryFn: () => api.get<RoleConfig[]>("/role-configs") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const manualItems = (itemsQ.data ?? []).filter((i) => !i.system_key && i.is_active);

  useEffect(() => {
    const next: Record<string, RowDraft> = {};
    for (const r of rolesQ.data ?? []) {
      next[r.role] = { base: String(r.base_amount || ""), allowance: r.allowance_item_ids, deduction: r.deduction_item_ids, comment: r.comment ?? "" };
    }
    setDrafts(next);
  }, [rolesQ.data]);

  const save = useMutation({
    mutationFn: (role: string) => {
      const d = drafts[role]!;
      return api.send("PUT", `/role-configs/${encodeURIComponent(role)}`, {
        base_amount: parseAmount(d.base || "0") || 0,
        allowance_item_ids: d.allowance,
        deduction_item_ids: d.deduction,
        comment: d.comment.trim() || null
      });
    },
    onSuccess: (_d, role) => {
      notice.ok(`Оклад роли «${roleLabel(role)}» сохранён. Зарплаты пересчитаются автоматически.`);
      void qc.invalidateQueries({ queryKey: ["payroll-role-configs", tenant] });
      void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
    },
    onError: notice.fail
  });

  const patch = (role: string, p: Partial<RowDraft>) => setDrafts((s) => ({ ...s, [role]: { ...s[role]!, ...p } }));

  return (
    <div className="grid gap-3">
      {notice.element}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Роль</TableHead>
              <TableHead className="text-right">Сотрудников</TableHead>
              <TableHead className="w-44">Оклад (UZS)</TableHead>
              <TableHead>Надбавки</TableHead>
              <TableHead>Удержания</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolesQ.isLoading ? <EmptyRow colSpan={7} text="Загрузка…" /> : null}
            {(rolesQ.data ?? []).map((r) => {
              const d = drafts[r.role];
              if (!d) return null;
              const dirty =
                parseAmount(d.base || "0") !== r.base_amount ||
                d.comment !== (r.comment ?? "") ||
                d.allowance.join() !== r.allowance_item_ids.join() ||
                d.deduction.join() !== r.deduction_item_ids.join();
              return (
                <TableRow key={r.role}>
                  <TableCell className="font-medium">{roleLabel(r.role)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.employees}</TableCell>
                  <TableCell>
                    <GroupedNumberInput value={d.base} onValueChange={(v) => patch(r.role, { base: v })} disabled={!canEdit} placeholder="0" />
                  </TableCell>
                  <TableCell>
                    <ItemChips items={manualItems.filter((i) => i.type === "allowance")} value={d.allowance} onChange={(v) => patch(r.role, { allowance: v })} disabled={!canEdit} />
                  </TableCell>
                  <TableCell>
                    <ItemChips items={manualItems.filter((i) => i.type === "deduction")} value={d.deduction} onChange={(v) => patch(r.role, { deduction: v })} disabled={!canEdit} />
                  </TableCell>
                  <TableCell>
                    <Input value={d.comment} onChange={(e) => patch(r.role, { comment: e.target.value })} disabled={!canEdit} className="h-8" />
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Button size="icon" variant={dirty ? "default" : "ghost"} disabled={!dirty || save.isPending} onClick={() => save.mutate(r.role)} aria-label="Сохранить">
                        <Save className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Оклад за месяц делится пропорционально отработанным дням по табелю: {money(3000000)} × 20 из 26 дней = {money(Math.round((3000000 * 20) / 26))}.
      </p>
    </div>
  );
}

export function PayrollRoleSalariesWorkspace() {
  const [tab, setTab] = useState<string | null>("roles");
  return (
    <PageShell>
      <PageHeader title="Базовые оклады" description="Оклад по роли и индивидуальный оклад сотрудника (приоритетнее роли)." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="self-start">
          <TabsTrigger value="roles">По ролям</TabsTrigger>
          <TabsTrigger value="employees">По сотрудникам</TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RoleConfigs />
        </TabsContent>
        <TabsContent value="employees">
          <PayrollEmployeeConfigs />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
