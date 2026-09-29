"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, Banknote } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { fmtDateTime, money, payrollApi, roleLabel, ymLabel } from "@/lib/payroll/payroll-api";
import { EmptyRow, selectCls, Toolbar, useNotice } from "@/components/payroll/payroll-ui";
import { PayrollPayDialog, type PayMethod, type QueueRow } from "@/components/payroll/payroll-pay-dialog";
import { PayrollPayoutsHistory } from "@/components/payroll/payroll-payouts-history";

type Queue = { rows: QueueRow[]; desks: Array<{ id: number; name: string }>; payment_methods: PayMethod[]; default_currency: string; totals: { count: number; amount: number } };

export function PayrollCashierQueueWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canPay = perms.isAdmin || perms.has("cash.vydacha_zarplaty.create");
  const canHistory = perms.isAdmin || perms.hasAny("cash.vydacha_zarplaty.history", "cash.vydacha_zarplaty.view");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [tab, setTab] = useState("queue");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [payRow, setPayRow] = useState<QueueRow | null>(null);

  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (q.trim()) params.set("q", q.trim());
  const queueQ = useQuery({
    queryKey: ["payroll-cashier-queue", tenant, params.toString()],
    enabled: Boolean(tenant),
    refetchInterval: 15_000,
    queryFn: () => api.get<Queue>(`/cashier-queue?${params.toString()}`)
  });
  const data = queueQ.data;
  const rows = data?.rows ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-cashier-queue", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-payouts", tenant] });
  };
  const skip = useMutation({
    mutationFn: (id: number) => api.send("POST", `/cashier-queue/${id}/skip`, {}),
    onSuccess: () => { notice.ok("Сотрудник перемещён в конец очереди"); refresh(); },
    onError: notice.fail
  });

  return (
    <PageShell>
      <PageHeader
        title="Выдача зарплаты и авансов"
        description="Очередь по времени утверждения. Выдача уменьшает остаток кассы и автоматически создаёт утверждённый расход."
      />
      {notice.element}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="queue">Очередь ({data?.totals.count ?? 0})</TabsTrigger>
          {canHistory ? <TabsTrigger value="history">История выплат</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="queue" className="mt-3 grid gap-3">
          <Toolbar>
            <select className={selectCls("w-44")} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Авансы и зарплата</option>
              <option value="advance">Только авансы</option>
              <option value="salary">Только зарплата</option>
            </select>
            <Input placeholder="Поиск по ФИО или коду" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-60" />
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">К выдаче: <b className="text-foreground">{money(data?.totals.amount ?? 0)}</b></span>
          </Toolbar>
          <div className="overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-left text-xs">
                <tr>
                  <th className="w-12 px-2 py-2">№</th>
                  <th className="px-2">Сотрудник</th>
                  <th className="px-2">Филиал</th>
                  <th className="px-2">Тип / месяц</th>
                  <th className="px-2 text-right">Сумма</th>
                  <th className="px-2">Утверждён</th>
                  <th className="w-56" />
                </tr>
              </thead>
              <tbody>
                {queueQ.isLoading ? <EmptyRow colSpan={7} text="Загрузка…" /> : null}
                {!queueQ.isLoading && rows.length === 0 ? <EmptyRow colSpan={7} text="Очередь пуста" /> : null}
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-t">
                    <td className="px-2 py-2 text-center font-semibold tabular-nums">{r.position}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.fio}</div>
                      <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}</div>
                    </td>
                    <td className="px-2 py-2">
                      {r.branch ?? "—"}
                      {r.no_cashier ? <div className="flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="size-3" /> У филиала нет кассы/кассира</div> : null}
                    </td>
                    <td className="px-2 py-2">{r.kind === "advance" ? "Аванс" : "Зарплата"}<div className="text-[11px] text-muted-foreground">{ymLabel(r)}</div></td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{money(r.amount)} {r.currency}</td>
                    <td className="px-2 py-2 text-xs">
                      {fmtDateTime(r.approved_at)}
                      {r.skip_count ? <div className="text-muted-foreground">сдвигов: {r.skip_count}</div> : null}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {canPay ? (
                        <div className="flex justify-end gap-1">
                          {r.kind === "advance" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={skip.isPending}
                              onClick={async () => {
                                if (await confirm({ title: "Сдвинуть в конец очереди", message: `${r.fio} не пришёл? Он будет перемещён в конец очереди.`, confirmLabel: "Сдвинуть", cancelLabel: "Отмена", destructive: false }))
                                  skip.mutate(r.id);
                              }}
                            >
                              <ArrowDownToLine className="mr-1 size-4" /> Сдвинуть
                            </Button>
                          ) : null}
                          <Button size="sm" onClick={() => setPayRow(r)}><Banknote className="mr-1 size-4" /> Выдать</Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        {canHistory ? (
          <TabsContent value="history" className="mt-3">
            <PayrollPayoutsHistory />
          </TabsContent>
        ) : null}
      </Tabs>
      <PayrollPayDialog
        row={payRow}
        desks={data?.desks ?? []}
        methods={data?.payment_methods ?? []}
        defaultCurrency={data?.default_currency ?? "UZS"}
        onClose={() => setPayRow(null)}
        onPaid={(t) => { notice.ok(t); refresh(); }}
      />
      {dialog}
    </PageShell>
  );
}
