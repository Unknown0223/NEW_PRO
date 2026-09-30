"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { ADVANCE_STATUS, fmtDateTime, money, payrollApi, RECORD_STATUS, roleLabel } from "@/lib/payroll/payroll-api";
import { StatusBadge, parseAmount, useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

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
    <Dialog open={recordId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="payroll-template sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{d ? `${d.user.fio} — ${String(d.month).padStart(2, "0")}.${d.year}` : "Загрузка…"}</DialogTitle>
        </DialogHeader>
        {notice.element}
        {d ? (
          <div className="grid max-h-[75vh] gap-4 overflow-auto">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge map={RECORD_STATUS} status={d.status} />
              <span>{roleLabel(d.user.role)}{d.user.code ? ` · ${d.user.code}` : ""}</span>
              <span className="text-muted-foreground">Расчёт: {fmtDateTime(d.calculated_at)}</span>
              {d.calc_error ? <span className="text-red-700">{d.calc_error}</span> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Полный оклад</div>{money(d.calc_snapshot.base?.base_full ?? 0)}</div>
              <div><div className="text-xs text-muted-foreground">Отработано</div>{a.worked ?? 0} из {a.plan_days ?? 0} дн.</div>
              <div><div className="text-xs text-muted-foreground">Отпуск / больничный / прогул</div>{a.vacation ?? 0} / {a.sick ?? 0} / {a.absent ?? 0}</div>
              <div><div className="text-xs text-muted-foreground">KPI сумма факт / план</div>{money(k.fact_total?.cost ?? 0)} / {money(k.plan_total?.cost ?? 0)}</div>
              <div><div className="text-xs text-muted-foreground">Возвраты</div>{money(k.returned_sum ?? 0)}</div>
            </div>
            {(d.calc_snapshot.warnings ?? []).map((w) => <p key={w} className="text-xs text-amber-700">⚠ {w}</p>)}

            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">Статья</th><th>Источник</th><th className="text-right">Сумма</th><th className="w-52" /></tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="py-1.5 font-medium">Оклад за отработанное время</td><td>Табель</td><td className="text-right tabular-nums">{money(d.base_salary)}</td><td /></tr>
                {d.lines.map((l) => (
                  <tr key={`${l.item_id}-${l.corr_key}`} className="border-t">
                    <td className="py-1.5">
                      <span className={l.item_type === "allowance" ? "text-emerald-800" : "text-red-800"}>{l.item_name}</span>
                      {l.corr_key ? <span className="ml-1 text-xs text-muted-foreground">за {l.corr_key}</span> : null}
                      {l.formula_snapshot ? <div className="max-w-md truncate font-mono text-[11px] text-muted-foreground" title={l.formula_snapshot}>{l.formula_snapshot}</div> : null}
                    </td>
                    <td className="text-xs">{l.is_manual_override ? "Вручную (вместо формулы)" : SOURCE[l.source] ?? l.source}</td>
                    <td className="text-right tabular-nums">{money(l.amount, 2)}</td>
                    <td className="text-right">
                      {editable && (l.is_manual_override || l.source === "manual") ? (
                        <Button size="sm" variant="ghost" onClick={() => setLine.mutate({ item_id: l.item_id, amount: null })} title="Вернуть расчёт">
                          <RotateCcw className="size-3.5" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-semibold"><td className="py-1.5">Начислено</td><td /><td className="text-right tabular-nums">{money(d.gross)}</td><td /></tr>
                <tr><td className="py-0.5">Итого выдано (аванс + выплаты)</td><td /><td className="text-right tabular-nums">{money(d.paid_total)}</td><td /></tr>
                <tr className="font-semibold"><td className="py-0.5">Остаток к выплате</td><td /><td className={`text-right tabular-nums ${d.balance < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(d.balance)}</td><td /></tr>
              </tbody>
            </table>

            {editable && manualItems.length ? (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ручные суммы</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {manualItems.map((it) => {
                    const cur = lineOf(it.id);
                    const val = edit[it.id] ?? (cur ? String(cur.amount) : "");
                    return (
                      <div key={it.id} className="flex items-center gap-2">
                        <span className="w-40 truncate text-sm" title={it.name}>{it.name}</span>
                        <GroupedNumberInput value={val} maxFractionDigits={2} placeholder="0" onValueChange={(v) => setEdit((s) => ({ ...s, [it.id]: v }))} />
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={edit[it.id] == null || setLine.isPending}
                          onClick={() => setLine.mutate({ item_id: it.id, amount: val.trim() === "" ? null : parseAmount(val) })}
                          aria-label="Сохранить"
                        >
                          <Save className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {d.advances.length || d.payouts.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Авансы</p>
                  {d.advances.map((x) => (
                    <div key={x.id} className="flex items-center justify-between border-b py-1 text-sm">
                      <span>#{x.id} · {fmtDateTime(x.created_at)}</span>
                      <span className="flex items-center gap-2">{money(x.amount)} <StatusBadge map={ADVANCE_STATUS} status={x.status} /></span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Выплаты кассы</p>
                  {d.payouts.map((x) => (
                    <div key={x.id} className={`flex justify-between border-b py-1 text-sm ${x.status === "reversed" ? "line-through opacity-60" : ""}`}>
                      <span>{x.kind === "advance" ? "Аванс" : "Зарплата"} · {fmtDateTime(x.paid_at)}</span>
                      <span>{money(x.amount)} {x.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
