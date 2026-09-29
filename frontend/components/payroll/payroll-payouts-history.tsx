"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { currentYm, fmtDateTime, money, payrollApi, ymLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { EmptyRow, MonthField, selectCls, Toolbar, useNotice } from "@/components/payroll/payroll-ui";

type Payout = {
  id: number;
  kind: string;
  fio: string;
  year: number;
  month: number;
  amount: number;
  currency: string;
  amount_uzs: number;
  rate: number;
  cash_desk_name: string | null;
  payment_method_ref: string | null;
  paid_at: string;
  paid_by: string | null;
  status: string;
  reverse_reason: string | null;
  expense_id: number | null;
};

export function PayrollPayoutsHistory() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canReverse = perms.isAdmin;
  const notice = useNotice();
  const [ym, setYm] = useState<Ym>(currentYm());
  const [kind, setKind] = useState("");

  const q = useQuery({
    queryKey: ["payroll-payouts", tenant, ym.year, ym.month, kind],
    enabled: Boolean(tenant),
    queryFn: () => api.get<Payout[]>(`/payouts?${ymQuery(ym)}${kind ? `&kind=${kind}` : ""}&limit=1000`)
  });
  const rows = q.data ?? [];
  const total = rows.filter((r) => r.status !== "reversed").reduce((s, r) => s + r.amount_uzs, 0);

  const reverse = useMutation({
    mutationFn: (p: { id: number; reason: string }) => api.send("POST", `/payouts/${p.id}/reverse`, { reason: p.reason }),
    onSuccess: () => {
      notice.ok("Выплата сторнирована: касса восстановлена, расход аннулирован, аванс вернулся в очередь");
      void qc.invalidateQueries({ queryKey: ["payroll-payouts", tenant] });
      void qc.invalidateQueries({ queryKey: ["payroll-cashier-queue", tenant] });
    },
    onError: notice.fail
  });

  return (
    <div className="grid gap-3">
      {notice.element}
      <Toolbar>
        <MonthField value={ym} onChange={setYm} />
        <select className={selectCls("w-40")} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Все выплаты</option>
          <option value="advance">Авансы</option>
          <option value="salary">Зарплата</option>
        </select>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">{ymLabel(ym)}: <b className="text-foreground">{money(total)}</b></span>
      </Toolbar>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-xs">
            <tr>
              <th className="px-2 py-2">Дата</th>
              <th className="px-2">Сотрудник</th>
              <th className="px-2">Тип</th>
              <th className="px-2 text-right">Сумма</th>
              <th className="px-2">Касса / способ</th>
              <th className="px-2">Кассир</th>
              <th className="px-2">Расход</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? <EmptyRow colSpan={8} text="Загрузка…" /> : null}
            {!q.isLoading && rows.length === 0 ? <EmptyRow colSpan={8} /> : null}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${r.status === "reversed" ? "opacity-60" : ""}`}>
                <td className="px-2 py-2 text-xs">{fmtDateTime(r.paid_at)}</td>
                <td className="px-2">{r.fio}<div className="text-[11px] text-muted-foreground">{ymLabel(r)}</div></td>
                <td className="px-2">{r.kind === "advance" ? "Аванс" : "Зарплата"}</td>
                <td className={`px-2 text-right tabular-nums ${r.status === "reversed" ? "line-through" : ""}`}>
                  {money(r.amount, 2)} {r.currency}
                  {r.rate !== 1 ? <div className="text-[11px] text-muted-foreground">= {money(r.amount_uzs)} · курс {r.rate}</div> : null}
                </td>
                <td className="px-2 text-xs">{r.cash_desk_name ?? "—"}<div className="text-muted-foreground">{r.payment_method_ref ?? "наличные"}</div></td>
                <td className="px-2 text-xs">{r.paid_by ?? "—"}</td>
                <td className="px-2 text-xs">
                  {r.expense_id ? `#${r.expense_id}` : "—"}
                  {r.status === "reversed" ? <div className="text-red-700">Сторно: {r.reverse_reason}</div> : null}
                </td>
                <td className="px-2 text-right">
                  {canReverse && r.status !== "reversed" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Сторно"
                      title="Сторно выплаты"
                      onClick={() => {
                        const reason = window.prompt(`Сторно выплаты ${r.fio} на ${money(r.amount)}. Причина:`);
                        if (reason?.trim()) reverse.mutate({ id: r.id, reason: reason.trim() });
                      }}
                    >
                      <Undo2 className="size-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
