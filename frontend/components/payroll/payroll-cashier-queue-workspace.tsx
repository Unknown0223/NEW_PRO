"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, Banknote } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { FilterSelect, filterPanelSelectClassName } from "@/components/ui/filter-select";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, fmtDateTime, money, payrollApi, roleLabel, ymLabel, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { useNotice } from "@/components/payroll/payroll-ui";
import { PayrollPayDialog, type PayMethod, type QueueRow } from "@/components/payroll/payroll-pay-dialog";
import { PayrollPayoutsHistory } from "@/components/payroll/payroll-payouts-history";
import { PayrollMonthNav } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PayrollCardTab,
  PayrollEmptyRow,
  PayrollFilterField,
  PayrollFiltersSection,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Queue = { rows: QueueRow[]; desks: Array<{ id: number; name: string }>; payment_methods: PayMethod[]; default_currency: string; totals: { count: number; amount: number } };
type Tab = "queue" | "history";

const TH = "px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5 align-top";

export function PayrollCashierQueueWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canPay = perms.isAdmin || perms.has("cash.vydacha_zarplaty.create");
  const canHistory = perms.isAdmin || perms.hasAny("cash.vydacha_zarplaty.history", "cash.vydacha_zarplaty.view");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [tab, setTab] = useState<Tab>("queue");
  const [kind, setKind] = useState("");
  const [historyYm, setHistoryYm] = useState<Ym>(currentYm());
  const [q, setQ] = useState("");
  const [payRow, setPayRow] = useState<QueueRow | null>(null);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.cashier-queue", defaultColumnOrder: ["position"], defaultPageSize: 20 });

  const queueQ = useQuery({
    queryKey: ["payroll-cashier-queue", tenant, kind],
    enabled: Boolean(tenant),
    refetchInterval: 15_000,
    queryFn: () => api.get<Queue>(`/cashier-queue${kind ? `?kind=${kind}` : ""}`)
  });
  const data = queueQ.data;
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s));
  }, [data, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${kind}|${q}`);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-cashier-queue", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-payouts", tenant] });
  };
  const skip = useMutation({
    mutationFn: (id: number) => api.send("POST", `/cashier-queue/${id}/skip`, {}),
    onSuccess: () => {
      notice.ok("Сотрудник перемещён в конец очереди");
      refresh();
    },
    onError: notice.fail
  });

  return (
    <PageShell className="payroll-template">
      <PageHeader
        title="Выдача зарплаты и авансов"
        description="Очередь по времени утверждения. Выдача уменьшает остаток кассы и автоматически создаёт утверждённый расход."
      />
      <PayrollFiltersSection>
        {tab === "history" ? <PayrollMonthNav variant="filter" value={historyYm} onChange={setHistoryYm} /> : null}
        <PayrollFilterField label="Тип выплаты">
          <FilterSelect emptyLabel="Авансы и зарплата" className={filterPanelSelectClassName} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="advance">Только авансы</option>
            <option value="salary">Только зарплата</option>
          </FilterSelect>
        </PayrollFilterField>
      </PayrollFiltersSection>
      {notice.element}

      <PayrollTableCard
        tabs={
          <>
            <PayrollCardTab active={tab === "queue"} onClick={() => setTab("queue")}>
              Очередь
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums">{data?.totals.count ?? 0}</span>
            </PayrollCardTab>
            {canHistory ? (
              <PayrollCardTab active={tab === "history"} onClick={() => setTab("history")}>
                История выплат
              </PayrollCardTab>
            ) : null}
          </>
        }
      >
        {tab === "history" && canHistory ? (
          <PayrollPayoutsHistory ym={historyYm} kind={kind} onNotice={notice} />
        ) : (
          <>
            <PayrollTableToolbar
              pageSize={prefs.pageSize}
              onPageSize={prefs.setPageSize}
              search={q}
              onSearch={setQ}
              searchPlaceholder="Поиск: ФИО, код, филиал"
              onRefresh={refresh}
              refreshing={queueQ.isFetching}
            >
              <span className="text-sm text-muted-foreground">
                К выдаче: <b className="text-foreground">{money(data?.totals.amount ?? 0)}</b>
              </span>
            </PayrollTableToolbar>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="app-table-thead">
                  <tr>
                    <th className={cn(TH, "w-14 text-center")}>№</th>
                    <th className={TH}>Сотрудник</th>
                    <th className={TH}>Филиал</th>
                    <th className={TH}>Тип / месяц</th>
                    <th className={cn(TH, "text-right")}>Сумма</th>
                    <th className={TH}>Утверждён</th>
                    <th className={cn(TH, "w-56 text-right")}>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {queueQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={7} loading={queueQ.isLoading} text="Очередь пуста" /> : null}
                  {paged.pageRows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`} className="border-b border-border/60 hover:bg-muted/40">
                      <td className={cn(TD, "text-center font-semibold tabular-nums")}>{r.position}</td>
                      <td className={TD}>
                        <div className="font-medium text-foreground">{r.fio}</div>
                        <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}</div>
                      </td>
                      <td className={TD}>
                        {r.branch ?? "—"}
                        {r.no_cashier ? (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle className="size-3" /> У филиала нет кассы/кассира
                          </div>
                        ) : null}
                      </td>
                      <td className={TD}>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.kind === "advance" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800")}>
                          {r.kind === "advance" ? "Аванс" : "Зарплата"}
                        </span>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{ymLabel(r)}</div>
                      </td>
                      <td className={cn(TD, "text-right font-semibold tabular-nums")}>
                        {money(r.amount)} {r.currency}
                      </td>
                      <td className={cn(TD, "text-xs")}>
                        {fmtDateTime(r.approved_at)}
                        {r.skip_count ? <div className="text-muted-foreground">сдвигов: {r.skip_count}</div> : null}
                      </td>
                      <td className={cn(TD, "text-right")}>
                        {canPay ? (
                          <div className="inline-flex gap-1">
                            {r.kind === "advance" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={skip.isPending}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: "Сдвинуть в конец очереди",
                                    message: `${r.fio} не пришёл? Он будет перемещён в конец очереди.`,
                                    confirmLabel: "Сдвинуть",
                                    cancelLabel: "Отмена",
                                    destructive: false
                                  });
                                  if (ok) skip.mutate(r.id);
                                }}
                              >
                                <ArrowDownToLine className="mr-1 size-4" /> Сдвинуть
                              </Button>
                            ) : null}
                            <Button size="sm" onClick={() => setPayRow(r)}>
                              <Banknote className="mr-1 size-4" /> Выдать
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
          </>
        )}
      </PayrollTableCard>
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
