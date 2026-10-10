"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { PAYROLL_QUERY_KEYS, payrollApi } from "./payroll-api";
import type { PayrollFormulaRow } from "./payroll-api";
import { formulaSummary, formatMoney, kindLabel, roleLabel } from "./payroll-utils";
import { FormulaFormDialog } from "./formula-form-dialog";

type Props = { tenantSlug: string };

export function FormulasWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<PayrollFormulaRow | null>(null);

  const optionsQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => (await payrollApi.options(tenantSlug)).data.data
  });

  const listQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.formulas(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => (await payrollApi.formulas(tenantSlug)).data.data
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.formulas(tenantSlug) });
    void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug) });
  };

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => payrollApi.createFormula(tenantSlug, body),
    onSuccess: invalidate
  });
  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      payrollApi.patchFormula(tenantSlug, id, body),
    onSuccess: invalidate
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => {
      if (onlyActive && !r.is_active) return false;
      if (!q) return true;
      return [r.name, r.code ?? "", r.kpi_group_name ?? "", r.grid_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [listQ.data, onlyActive, search]);

  const roles = optionsQ.data?.roles ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Формулы зарплаты"
        description="Har bir formula rol va KPI guruhiga bog‘lanadi. KPI guruhiga bog‘langan formula faqat shu guruh xodimlariga qo‘llanadi."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadXlsxSheet(
                  `payroll_formulas_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  "Формулы",
                  ["Название", "Вид", "Роли", "Группа KPI", "Сетка", "Оклад", "Активна"],
                  rows.map((r) => [
                    r.name,
                    kindLabel(r.kind),
                    r.roles.map((x) => roleLabel(x, roles)).join(", ") || "все",
                    r.kpi_group_name ?? "—",
                    r.grid_name ?? "—",
                    r.base_amount,
                    r.is_active ? "да" : "нет"
                  ])
                )
              }
            >
              Excel
            </Button>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Формула
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-xs text-xs"
              placeholder="Qidiruv: nom, kod, guruh"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
              Faqat faol
            </label>
            <span className="ml-auto text-xs text-muted-foreground">{rows.length} ta formula</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">Название</th>
                  <th className="p-2 font-medium">Вид расчёта</th>
                  <th className="p-2 font-medium">Роли</th>
                  <th className="p-2 font-medium">Группа KPI</th>
                  <th className="p-2 font-medium">Сетка</th>
                  <th className="p-2 text-right font-medium">Оклад</th>
                  <th className="p-2 text-right font-medium">Приор.</th>
                  <th className="p-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="p-2">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">{formulaSummary(r)}</div>
                      {!r.is_active ? (
                        <span className="text-[11px] text-amber-600">не активна</span>
                      ) : null}
                      {r.is_default ? (
                        <span className="ml-1 text-[11px] text-primary">стандарт</span>
                      ) : null}
                    </td>
                    <td className="p-2">{kindLabel(r.kind)}</td>
                    <td className="p-2">
                      {r.roles.length === 0
                        ? "все роли"
                        : r.roles.map((x) => roleLabel(x, roles)).join(", ")}
                    </td>
                    <td className="p-2">
                      {r.kpi_group_name ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                          {r.kpi_group_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">по роли</span>
                      )}
                    </td>
                    <td className="p-2">{r.grid_name ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(r.base_amount)}</td>
                    <td className="p-2 text-right tabular-nums">{r.priority}</td>
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditRow(r)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      {listQ.isLoading
                        ? "Yuklanmoqda…"
                        : "Formulalar yo‘q. «Формула» tugmasi orqali qo‘shing."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <FormulaFormDialog
        open={addOpen}
        roles={roles}
        kpiGroups={optionsQ.data?.kpi_groups ?? []}
        grids={optionsQ.data?.grids ?? []}
        onOpenChange={setAddOpen}
        saving={createMut.isPending}
        onSaveRequest={(body) => createMut.mutateAsync(body)}
      />
      <FormulaFormDialog
        open={Boolean(editRow)}
        row={editRow}
        roles={roles}
        kpiGroups={optionsQ.data?.kpi_groups ?? []}
        grids={optionsQ.data?.grids ?? []}
        onOpenChange={(o) => !o && setEditRow(null)}
        saving={patchMut.isPending}
        onSaveRequest={(body) => (editRow ? patchMut.mutateAsync({ id: editRow.id, body }) : Promise.resolve())}
      />
    </PageShell>
  );
}
