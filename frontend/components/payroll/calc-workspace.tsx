"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { getUserFacingError } from "@/lib/error-utils";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import {
  PAYROLL_PERIOD_STATUS_LABEL_RU,
  PAYROLL_QUERY_KEYS,
  payrollApi
} from "./payroll-api";
import type { PayrollEntryRow } from "./payroll-api";
import {
  achievementTone,
  calcTotalsFromRows,
  currentMonth,
  formatMoney,
  formatPercent,
  kindLabel,
  monthLabel,
  recentMonths,
  remainingAmount,
  roleLabel
} from "./payroll-utils";
import { EntryDetailDialog } from "./entry-detail-dialog";

type Props = { tenantSlug: string };

const TONE_CLASS: Record<string, string> = {
  good: "bg-emerald-500/15 text-emerald-700",
  warn: "bg-amber-500/15 text-amber-700",
  bad: "bg-red-500/15 text-red-700",
  muted: "bg-muted text-muted-foreground"
};

export function CalcWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => currentMonth());
  const [role, setRole] = useState("");
  const [kpiGroupId, setKpiGroupId] = useState("");
  const [detail, setDetail] = useState<PayrollEntryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optionsQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => (await payrollApi.options(tenantSlug)).data.data
  });

  const calcQ = useQuery({
    queryKey: [...PAYROLL_QUERY_KEYS.calc(tenantSlug, month), role, kpiGroupId],
    enabled: Boolean(tenantSlug) && Boolean(month),
    staleTime: STALE.detail,
    queryFn: async () =>
      (
        await payrollApi.calc(tenantSlug, {
          month,
          role: role || undefined,
          kpi_group_id: kpiGroupId || undefined
        })
      ).data
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["payroll", "calc", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["payroll", "payments", tenantSlug] });
    void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug) });
  };

  const recalcMut = useMutation({
    mutationFn: () =>
      payrollApi.recalculate(tenantSlug, {
        month,
        role: role || undefined,
        kpi_group_id: kpiGroupId || undefined
      }),
    onSuccess: invalidate,
    onError: (e) => setError(getUserFacingError(e))
  });

  const statusMut = useMutation({
    mutationFn: (status: "approved" | "locked") => {
      const periodId = calcQ.data?.period?.id;
      if (!periodId) return Promise.reject(new Error("PERIOD_NOT_FOUND"));
      return payrollApi.setPeriodStatus(tenantSlug, periodId, status);
    },
    onSuccess: invalidate,
    onError: (e) => setError(getUserFacingError(e))
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      payrollApi.patchEntry(tenantSlug, id, body),
    onSuccess: () => {
      invalidate();
      setDetail(null);
    },
    onError: (e) => setError(getUserFacingError(e))
  });

  const rows = calcQ.data?.rows ?? [];
  const totals = useMemo(() => calcTotalsFromRows(rows), [rows]);
  const period = calcQ.data?.period;
  const readonly = period?.status === "locked" || period?.status === "paid";
  const months = useMemo(() => {
    const base = recentMonths(12);
    const extra = optionsQ.data?.months ?? [];
    return [...new Set([...base, ...extra])].sort((a, b) => b.localeCompare(a));
  }, [optionsQ.data?.months]);

  useEffect(() => setError(null), [month, role, kpiGroupId]);

  return (
    <PageShell>
      <PageHeader
        title="Расчёт зарплаты"
        description="Oy bo‘yicha hisob: formula + сетка + davomat + ustama/ushlanmalar. Faqat KPI guruhiga bog‘langan xodimlarga shu guruh formulasi qo‘llanadi."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void calcQ.refetch()}>
              <RefreshCw className={cn("size-4", calcQ.isFetching && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadXlsxSheet(
                  `payroll_${month}.xlsx`,
                  monthLabel(month),
                  ["ФИО", "Роль", "Формула", "Дней", "KPI %", "Оклад", "Переменная", "Надбавки", "Удержания", "Итого", "Выплачено"],
                  rows.map((r) => [
                    r.fio,
                    r.role,
                    r.formula_name ?? "—",
                    `${r.worked_days}/${r.planned_days}`,
                    r.achievement_percent ?? "",
                    r.base_amount,
                    r.variable_amount,
                    r.allowance_amount,
                    r.deduction_amount,
                    r.net_amount,
                    r.paid_amount
                  ])
                )
              }
            >
              Excel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={recalcMut.isPending || readonly}
              onClick={() => {
                setError(null);
                recalcMut.mutate();
              }}
            >
              {recalcMut.isPending ? "Hisoblanmoqda…" : "Qayta hisoblash"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={statusMut.isPending || readonly || period?.status === "approved"}
              onClick={() => statusMut.mutate("approved")}
            >
              <Check className="size-4" /> Утвердить
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={statusMut.isPending || period?.status === "locked"}
              onClick={() => statusMut.mutate("locked")}
            >
              <Lock className="size-4" /> Заблокировать
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Oy</span>
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Rol</span>
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Barchasi</option>
                {(optionsQ.data?.roles ?? []).map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Группа KPI</span>
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={kpiGroupId}
                onChange={(e) => setKpiGroupId(e.target.value)}
              >
                <option value="">Barchasi</option>
                {(optionsQ.data?.kpi_groups ?? []).map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="ml-auto flex flex-wrap gap-4 text-xs">
              <div>
                <div className="text-muted-foreground">Holat</div>
                <div className="font-medium">
                  {PAYROLL_PERIOD_STATUS_LABEL_RU[period?.status ?? "draft"] ?? period?.status}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Xodimlar</div>
                <div className="font-medium tabular-nums">{formatGroupedInteger(totals.employees)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Formulasiz</div>
                <div className={cn("font-medium tabular-nums", totals.without_formula > 0 && "text-amber-600")}>
                  {formatGroupedInteger(totals.without_formula)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Jami</div>
                <div className="font-medium tabular-nums">{formatMoney(totals.net_amount)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">To‘langan</div>
                <div className="font-medium tabular-nums">
                  {formatMoney(period?.paid_amount ?? 0)} / {formatMoney(remainingAmount(totals.net_amount, period?.paid_amount ?? 0))}
                </div>
              </div>
            </div>
          </div>

          {readonly ? (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Oy {period?.status === "locked" ? "bloklangan" : "to‘langan"} — tahrirlash yopiq.
            </p>
          ) : null}
          {error ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">ФИО</th>
                  <th className="p-2 font-medium">Роль</th>
                  <th className="p-2 font-medium">Формула</th>
                  <th className="p-2 text-center font-medium">Дней</th>
                  <th className="p-2 text-center font-medium">KPI</th>
                  <th className="p-2 text-right font-medium">Оклад</th>
                  <th className="p-2 text-right font-medium">Переменная</th>
                  <th className="p-2 text-right font-medium">+/−</th>
                  <th className="p-2 text-right font-medium">Итого</th>
                  <th className="p-2 text-right font-medium">Выплачено</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                    onClick={() => setDetail(r)}
                  >
                    <td className="p-2 font-medium">{r.fio}</td>
                    <td className="p-2">{roleLabel(r.role, optionsQ.data?.roles ?? [])}</td>
                    <td className="p-2">
                      {r.formula_name ? (
                        <span>
                          {r.formula_name}
                          <span className="ml-1 text-[11px] text-muted-foreground">{kindLabel(r.kind)}</span>
                        </span>
                      ) : (
                        <span className="text-amber-600">formula yo‘q</span>
                      )}
                    </td>
                    <td className="p-2 text-center tabular-nums">
                      {r.worked_days}/{r.planned_days}
                    </td>
                    <td className="p-2 text-center">
                      <span className={cn("rounded px-1.5 py-0.5 tabular-nums", TONE_CLASS[achievementTone(r.achievement_percent)])}>
                        {formatPercent(r.achievement_percent, 0)}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(r.base_amount)}</td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(r.variable_amount)}</td>
                    <td className="p-2 text-right tabular-nums">
                      <span className="text-emerald-700">{formatMoney(r.allowance_amount)}</span>
                      {" / "}
                      <span className="text-red-700">{formatMoney(r.deduction_amount)}</span>
                    </td>
                    <td className="p-2 text-right font-semibold tabular-nums">{formatMoney(r.net_amount)}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{formatMoney(r.paid_amount)}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      {calcQ.isLoading ? "Yuklanmoqda…" : "Ma’lumot yo‘q — «Qayta hisoblash» ni bosing."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {rows.length > 0 ? (
                <tfoot className="border-t border-border bg-muted/30 text-xs font-medium">
                  <tr>
                    <td className="p-2" colSpan={5}>
                      Жами ({totals.employees} xodim)
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(totals.base_amount)}</td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(totals.variable_amount)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatMoney(totals.allowance_amount)} / {formatMoney(totals.deduction_amount)}
                    </td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(totals.net_amount)}</td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(period?.paid_amount ?? 0)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </CardContent>
      </Card>

      <EntryDetailDialog
        row={detail}
        month={month}
        readonly={Boolean(readonly)}
        onClose={() => setDetail(null)}
        saving={patchMut.isPending}
        onSave={(body) => (detail ? patchMut.mutateAsync({ id: detail.id, body }) : Promise.resolve())}
      />
    </PageShell>
  );
}
