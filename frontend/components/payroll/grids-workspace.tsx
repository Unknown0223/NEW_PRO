"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { PAYROLL_QUERY_KEYS, payrollApi } from "./payroll-api";
import type { PayrollGridRow, PayrollGridStep } from "./payroll-api";
import { metricLabel } from "./formula-parts-editor";
import { formatMoney, gridStepSummary, sortGridSteps } from "./payroll-utils";

type Props = { tenantSlug: string };

const GRID_MODES: Array<{ value: string; label: string }> = [
  { value: "coefficient", label: "Коэффициент × база" },
  { value: "amount", label: "Фикс. сумма" },
  { value: "percent", label: "% от базы" }
];

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function GridsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<PayrollGridRow | null>(null);

  const optionsQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => (await payrollApi.options(tenantSlug)).data.data
  });

  const listQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.grids(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => (await payrollApi.grids(tenantSlug)).data.data
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.grids(tenantSlug) });
    void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.formulas(tenantSlug) });
    void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug) });
  };

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => payrollApi.createGrid(tenantSlug, body),
    onSuccess: invalidate
  });
  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      payrollApi.patchGrid(tenantSlug, id, body),
    onSuccess: invalidate
  });

  const rows = listQ.data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Сетки (тарифные сетки)"
        description="Bosqichli jadval: ko‘rsatkich qiymatiga qarab koeffitsiyent, summa yoki foiz. KPI guruhiga va oyga bog‘lanadi."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Сетка
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3">
          {rows.map((g) => (
            <div key={g.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {metricLabel(g.metric)} · {GRID_MODES.find((m) => m.value === g.mode)?.label ?? g.mode} ·{" "}
                    {g.kpi_group_name ?? "guruhga bog‘lanmagan"}
                    {!g.is_active ? " · не активна" : ""}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-7"
                  onClick={() => setEditRow(g)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                {sortGridSteps(g.steps).map((s, i) => (
                  <div key={`${s.month ?? "base"}-${i}`} className="rounded bg-muted/50 px-2 py-1">
                    <span className="mr-1 text-muted-foreground">{s.month ?? "база"}</span>
                    <span className="tabular-nums">{gridStepSummary(g.mode, s)}</span>
                  </div>
                ))}
                {g.steps.length === 0 ? (
                  <span className="text-muted-foreground">Qatorlar yo‘q</span>
                ) : null}
              </div>
            </div>
          ))}

          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {listQ.isLoading ? "Yuklanmoqda…" : "Сеткаlar yo‘q."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <GridFormDialog
        open={addOpen}
        kpiGroups={optionsQ.data?.kpi_groups ?? []}
        onOpenChange={setAddOpen}
        saving={createMut.isPending}
        onSaveRequest={(body) => createMut.mutateAsync(body)}
      />
      <GridFormDialog
        open={Boolean(editRow)}
        row={editRow}
        kpiGroups={optionsQ.data?.kpi_groups ?? []}
        onOpenChange={(o) => !o && setEditRow(null)}
        saving={patchMut.isPending}
        onSaveRequest={(body) => (editRow ? patchMut.mutateAsync({ id: editRow.id, body }) : Promise.resolve())}
      />
    </PageShell>
  );
}

type StepDraft = { month: string; from_value: string; to_value: string; coefficient: string; amount: string };

function toStepDraft(s: PayrollGridStep): StepDraft {
  return {
    month: s.month ?? "",
    from_value: s.from_value == null ? "" : String(s.from_value),
    to_value: s.to_value == null ? "" : String(s.to_value),
    coefficient: String(s.coefficient),
    amount: String(s.amount)
  };
}

function GridFormDialog({
  open,
  row,
  kpiGroups,
  onOpenChange,
  saving,
  onSaveRequest
}: {
  open: boolean;
  row?: PayrollGridRow | null;
  kpiGroups: Array<{ id: number; name: string }>;
  onOpenChange: (o: boolean) => void;
  saving: boolean;
  onSaveRequest: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [kpiGroupId, setKpiGroupId] = useState("");
  const [metric, setMetric] = useState("kpi_percent");
  const [mode, setMode] = useState("coefficient");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(row?.name ?? "");
    setCode(row?.code ?? "");
    setKpiGroupId(row?.kpi_group_id ? String(row.kpi_group_id) : "");
    setMetric(row?.metric ?? "kpi_percent");
    setMode(row?.mode ?? "coefficient");
    setIsActive(row?.is_active ?? true);
    setSteps(sortGridSteps(row?.steps ?? []).map(toStepDraft));
  }, [open, row]);

  const update = (i: number, patch: Partial<StepDraft>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Nom majburiy.");
      return;
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || null,
      kpi_group_id: kpiGroupId ? Number(kpiGroupId) : null,
      metric,
      mode,
      is_active: isActive,
      steps: steps.map((s, i) => ({
        month: s.month.trim() || null,
        from_value: num(s.from_value),
        to_value: num(s.to_value),
        coefficient: num(s.coefficient) ?? 1,
        amount: num(s.amount) ?? 0,
        sort_order: i
      }))
    };
    try {
      await onSaveRequest(body);
      onOpenChange(false);
    } catch (e) {
      setError(getUserFacingError(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row ? "Сеткani таҳрирлаш" : "Янги сетка"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Название *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent KPI сетка" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Код</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AGENT_GRID" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Группа KPI</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={kpiGroupId}
              onChange={(e) => setKpiGroupId(e.target.value)}
            >
              <option value="">Guruhga bog‘lamaslik</option>
              {kpiGroups.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Показатель</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              <option value="kpi_percent">Выполнение KPI (%)</option>
              <option value="sales_sum">Продажи (сумма)</option>
              <option value="team_sales_sum">Продажи команды</option>
              <option value="collection_sum">Инкассация (сумма)</option>
              <option value="deliveries">Доставки</option>
              <option value="order_count">Заказы (кол-во)</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Натижа turi</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {GRID_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 self-end pb-2 text-xs">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Faol
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Bosqichlar</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setSteps((prev) => [
                  ...prev,
                  { month: "", from_value: "", to_value: "", coefficient: "1", amount: "0" }
                ])
              }
            >
              + Qator
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Oy bo‘sh qoldirilsa — doimiy (baza) qator. Oy kiritilsa («2026-10») — o‘sha oy uchun alohida сетка.
          </p>

          {steps.map((s, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-1">
              <Input
                className="col-span-2 h-8 text-xs"
                placeholder="oy (2026-10)"
                value={s.month}
                onChange={(e) => update(i, { month: e.target.value })}
              />
              <Input
                className="col-span-2 h-8 text-right text-xs"
                placeholder="от"
                inputMode="decimal"
                value={s.from_value}
                onChange={(e) => update(i, { from_value: e.target.value })}
              />
              <Input
                className="col-span-2 h-8 text-right text-xs"
                placeholder="до"
                inputMode="decimal"
                value={s.to_value}
                onChange={(e) => update(i, { to_value: e.target.value })}
              />
              <Input
                className="col-span-2 h-8 text-right text-xs"
                placeholder="коэф."
                inputMode="decimal"
                value={s.coefficient}
                onChange={(e) => update(i, { coefficient: e.target.value })}
              />
              <Input
                className="col-span-3 h-8 text-right text-xs"
                placeholder={mode === "percent" ? "%" : "сумма"}
                inputMode="decimal"
                value={s.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="col-span-1 h-8 text-xs text-destructive"
                onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ✕
              </Button>
            </div>
          ))}

          {steps.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Namuna: {gridStepSummary(mode, {
                month: steps[0].month || null,
                from_value: num(steps[0].from_value),
                to_value: num(steps[0].to_value),
                coefficient: num(steps[0].coefficient) ?? 1,
                amount: num(steps[0].amount) ?? 0
              })}{" "}
              · {formatMoney(0)}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Сақланмоқда…" : "Сақлаш"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
