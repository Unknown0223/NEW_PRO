"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useTenant } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { ADVANCE_STATUS, fmtDateTime, money, payrollApi, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { StatusBadge, parseAmount, useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollModal, PayrollModalNote, PayrollModalSection } from "@/components/payroll/kit/payroll-kit-modal";
import {
  PAYROLL_INPUT,
  PAYROLL_TABLE,
  PAYROLL_TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollIconAction
} from "@/components/payroll/kit/payroll-kit-table";

const CELL = "px-4 py-2.5 align-top";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-xl border border-[var(--pr-field)] bg-card px-4 py-3 shadow-sm">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[14px] font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

type Line = { item_id: number; item_name: string; item_type: string; amount: number; source: string; corr_key: string; formula_snapshot: string | null; is_manual_override: boolean; note: string | null };
type Detail = {
  id: number;
  user: { id: number; fio: string; code: string | null; role: string };
  year: number;
  month: number;
  status: string;
  base_salary: number;
  gross: number;
  balance: number;
  paid_total: number;
  advances_total: number;
  lines: Line[];
  calc_snapshot: {
    base?: { base_full?: number };
    attendance?: { plan_days?: number; worked?: number; vacation?: number; sick?: number; trip?: number; absent?: number; half?: number };
    kpi?: { fact_total?: { cost?: number }; plan_total?: { cost?: number }; returned_sum?: number };
    warnings?: string[];
  };
  calc_error: string | null;
  calculated_at: string | null;
  payouts: Array<{ id: number; kind: string; amount: number; currency: string; amount_uzs: number; paid_at: string; status: string }>;
  advances: Array<{ id: number; amount: number; status: string; created_at: string }>;
};

const SOURCE: Record<string, string> = { formula: "Формула", kpi: "KPI", manual: "Вручную", config: "Базовый оклад", advance: "Аванс", correction: "Корректировка", carry: "Долг прошлого месяца" };

export function PayrollRecordDialog({ recordId, items, onClose }: { recordId: number | null; items: PayrollItem[]; onClose: () => void }) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const notice = useNotice();
  const [edit, setEdit] = useState<Record<number, string>>({});

  const q = useQuery({
    queryKey: ["payroll-record", tenant, recordId],
    enabled: Boolean(tenant && recordId),
    queryFn: () => api.get<Detail>(`/records/${recordId}`)
  });
  const d = q.data;
  const editable = canEdit && d != null && (d.status === "draft" || d.status === "rejected");

  const setLine = useMutation({
    mutationFn: (p: { item_id: number; amount: number | null }) => api.send<Detail>("PUT", `/records/${recordId}/lines`, p),
    onSuccess: (data) => {
      qc.setQueryData(["payroll-record", tenant, recordId], data);
      void qc.invalidateQueries({ queryKey: ["payroll-records", tenant] });
      setEdit({});
      notice.ok("Сохранено, итог пересчитан");
    },
    onError: notice.fail
  });

  const manualItems = items.filter((i) => !i.system_key && i.is_active);
  const lineOf = (id: number) => d?.lines.find((l) => l.item_id === id && !l.corr_key);
  const a = d?.calc_snapshot.attendance ?? {};
  const k = d?.calc_snapshot.kpi ?? {};

  return (
    <PayrollModal
      open={recordId != null}
      onClose={onClose}
      title={d ? `${d.user.fio} — ${String(d.month).padStart(2, "0")}.${d.year}` : "Загрузка…"}
      width="sm:max-w-[920px]"
    >
      {notice.element}
      {d ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <StatusBadge map={RECORD_STATUS} status={d.status} />
            <span className="text-foreground/80">{roleLabel(d.user.role)}{d.user.code ? ` · ${d.user.code}` : ""}</span>
            <span className="text-[12px] text-muted-foreground">Расчёт: {fmtDateTime(d.calculated_at)}</span>
            {d.calc_error ? <span className="text-rose-700">{d.calc_error}</span> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Stat label="Полный оклад" value={money(d.calc_snapshot.base?.base_full ?? 0)} />
            <Stat label="Отработано" value={`${a.worked ?? 0} из ${a.plan_days ?? 0} дн.`} />
            <Stat label="Отпуск / больничный / прогул" value={`${a.vacation ?? 0} / ${a.sick ?? 0} / ${a.absent ?? 0}`} />
            <Stat label="KPI факт / план" value={`${money(k.fact_total?.cost ?? 0)} / ${money(k.plan_total?.cost ?? 0)}`} />
            <Stat label="Возвраты" value={money(k.returned_sum ?? 0)} />
          </div>
          {(d.calc_snapshot.warnings ?? []).map((w) => <PayrollModalNote key={w} tone="warn">{w}</PayrollModalNote>)}

          <div className="overflow-hidden rounded-xl border border-[var(--pr-border)]">
            <table className={PAYROLL_TABLE}>
              <thead className={PAYROLL_THEAD}>
                <tr><th className={PAYROLL_TH}>Статья</th><th className={PAYROLL_TH}>Источник</th><th className={cn(PAYROLL_TH, "text-right")}>Сумма</th><th className={cn(PAYROLL_TH, "w-14")} /></tr>
              </thead>
              <tbody>
                <tr className={PAYROLL_TR}><td className={cn(CELL, "font-medium")}>Оклад за отработанное время</td><td className={CELL}>Табель</td><td className={cn(CELL, "text-right tabular-nums")}>{money(d.base_salary)}</td><td /></tr>
                {d.lines.map((l) => (
                  <tr key={`${l.item_id}-${l.corr_key}`} className={PAYROLL_TR}>
                    <td className={CELL}>
                      <span className={l.item_type === "allowance" ? "text-emerald-700" : "text-rose-700"}>{l.item_name}</span>
                      {l.corr_key ? <span className="ml-1 text-[12px] text-muted-foreground">за {l.corr_key}</span> : null}
                      {l.formula_snapshot ? <div className="max-w-md truncate font-mono text-[11px] text-muted-foreground" title={l.formula_snapshot}>{l.formula_snapshot}</div> : null}
                    </td>
                    <td className={cn(CELL, "text-[12px] text-muted-foreground")}>{l.is_manual_override ? "Вручную (вместо формулы)" : SOURCE[l.source] ?? l.source}</td>
                    <td className={cn(CELL, "text-right tabular-nums")}>{money(l.amount, 2)}</td>
                    <td className={cn(CELL, "text-right")}>
                      {editable && (l.is_manual_override || l.source === "manual") ? (
                        <PayrollIconAction tone="neutral" label="Вернуть расчёт" onClick={() => setLine.mutate({ item_id: l.item_id, amount: null })}>
                          <RotateCcw />
                        </PayrollIconAction>
                      ) : null}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--pr-line)] bg-[var(--pr-head)] font-semibold"><td className={CELL}>Начислено</td><td /><td className={cn(CELL, "text-right tabular-nums")}>{money(d.gross)}</td><td /></tr>
                <tr className="border-t border-[var(--pr-line)]"><td className={CELL}>Итого выдано (аванс + выплаты)</td><td /><td className={cn(CELL, "text-right tabular-nums")}>{money(d.paid_total)}</td><td /></tr>
                <tr className="border-t border-[var(--pr-line)] font-semibold"><td className={CELL}>Остаток к выплате</td><td /><td className={cn(CELL, "text-right tabular-nums", d.balance < 0 ? "text-rose-700" : "text-[var(--pr-brand-600)]")}>{money(d.balance)}</td><td /></tr>
              </tbody>
            </table>
          </div>

          {editable && manualItems.length ? (
            <PayrollModalSection title="Ручные суммы">
              <div className="grid gap-2 sm:grid-cols-2">
                {manualItems.map((it) => {
                  const cur = lineOf(it.id);
                  const val = edit[it.id] ?? (cur ? String(cur.amount) : "");
                  return (
                    <div key={it.id} className="flex items-center gap-2">
                      <span className="w-40 truncate text-[13px]" title={it.name}>{it.name}</span>
                      <GroupedNumberInput value={val} maxFractionDigits={2} placeholder="0" onValueChange={(v) => setEdit((s) => ({ ...s, [it.id]: v }))} className={PAYROLL_INPUT} />
                      <PayrollIconAction
                        tone="success"
                        label="Сохранить"
                        disabled={edit[it.id] == null || setLine.isPending}
                        onClick={() => setLine.mutate({ item_id: it.id, amount: val.trim() === "" ? null : parseAmount(val) })}
                      >
                        <Save />
                      </PayrollIconAction>
                    </div>
                  );
                })}
              </div>
            </PayrollModalSection>
          ) : null}

          {d.advances.length || d.payouts.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PayrollModalSection title="Авансы">
                {d.advances.map((x) => (
                  <div key={x.id} className="flex items-center justify-between border-t border-[var(--pr-line)] py-1.5 text-[13px] first:border-t-0">
                    <span className="text-muted-foreground">#{x.id} · {fmtDateTime(x.created_at)}</span>
                    <span className="flex items-center gap-2 tabular-nums">{money(x.amount)} <StatusBadge map={ADVANCE_STATUS} status={x.status} /></span>
                  </div>
                ))}
              </PayrollModalSection>
              <PayrollModalSection title="Выплаты кассы">
                {d.payouts.map((x) => (
                  <div key={x.id} className={cn("flex justify-between border-t border-[var(--pr-line)] py-1.5 text-[13px] first:border-t-0", x.status === "reversed" && "line-through opacity-60")}>
                    <span className="text-muted-foreground">{x.kind === "advance" ? "Аванс" : "Зарплата"} · {fmtDateTime(x.paid_at)}</span>
                    <span className="tabular-nums">{money(x.amount)} {x.currency}</span>
                  </div>
                ))}
              </PayrollModalSection>
            </div>
          ) : null}
        </div>
      ) : null}
    </PayrollModal>
  );
}
