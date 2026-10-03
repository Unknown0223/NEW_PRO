"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, Banknote } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, fmtDateTime, money, PAYOUT_KIND, payrollApi, roleLabel, ymLabel, type Ym } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { TonePill, useNotice } from "@/components/payroll/payroll-ui";
import { PayrollPayDialog, type PayMethod, type QueueRow } from "@/components/payroll/payroll-pay-dialog";
import { PayrollPayoutsHistory } from "@/components/payroll/payroll-payouts-history";
import { PayrollFilterCard, PayrollFloatSelect, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Queue = { rows: QueueRow[]; desks: Array<{ id: number; name: string }>; payment_methods: PayMethod[]; default_currency: string; totals: { count: number; amount: number } };
type Tab = "queue" | "history";
type Filters = { kind: string; branch: string };

const KIND_OPTIONS = [
  { value: "advance", label: "Только авансы" },
  { value: "salary", label: "Только зарплата" }
];

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
  const [draft, setDraft] = useState<Filters>({ kind: "", branch: "" });
  const [filters, setFilters] = useState<Filters>({ kind: "", branch: "" });
  const [historyYm, setHistoryYm] = useState<Ym>(currentYm());
  const [q, setQ] = useState("");
  const [payRow, setPayRow] = useState<QueueRow | null>(null);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.cashier-queue", defaultColumnOrder: ["position"], defaultPageSize: 20 });

  const queueQ = useQuery({
    queryKey: ["payroll-cashier-queue", tenant, filters.kind],
    enabled: Boolean(tenant),
    refetchInterval: 15_000,
    queryFn: () => api.get<Queue>(`/cashier-queue${filters.kind ? `?kind=${filters.kind}` : ""}`)
  });
  const data = queueQ.data;
  const branches = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.branch).filter((b): b is string => Boolean(b)))].sort(), [data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) => (!filters.branch || r.branch === filters.branch) && (!s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s))
    );
  }, [data, q, filters.branch]);
  const paged = usePagedRows(rows, prefs.pageSize, `${filters.kind}|${filters.branch}|${q}`);
  const toPay = rows.reduce((s, r) => s + r.amount, 0);

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

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        "ochered-vydachi.xlsx",
        ["№", "Сотрудник", "Код", "Филиал", "Тип", "Месяц", "Сумма", "Валюта", "Утверждён"],
        rows.map((r) => [r.position, r.fio, r.code ?? "", r.branch ?? "", PAYOUT_KIND[r.kind]?.label ?? r.kind, ymLabel(r), r.amount, r.currency, fmtDateTime(r.approved_at)]),
        "Очередь"
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="cashier" />
      <PayrollFilterCard
        title="Выдача зарплаты и авансов"
        description="Очередь по времени утверждения. Выдача уменьшает остаток кассы и автоматически создаёт утверждённый расход."
        month={tab === "history" && canHistory ? { value: historyYm, onChange: setHistoryYm } : undefined}
        onApply={() => setFilters(draft)}
      >
        <PayrollFloatSelect label="Тип выплаты" value={draft.kind} onChange={(v) => setDraft((d) => ({ ...d, kind: v }))} options={KIND_OPTIONS} />
        {tab === "queue" ? (
          <PayrollFloatSelect label="Филиал" value={draft.branch} onChange={(v) => setDraft((d) => ({ ...d, branch: v }))} options={branches.map((b) => ({ value: b, label: b }))} />
        ) : null}
      </PayrollFilterCard>
      {canHistory ? (
        <PayrollSegmentedTabs<Tab>
          tabs={[
            { id: "queue", label: "Очередь", count: data?.totals.count ?? 0 },
            { id: "history", label: "История выплат" }
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      {notice.element}

      <PayrollTableCard>
        {tab === "history" && canHistory ? (
          <PayrollPayoutsHistory ym={historyYm} kind={filters.kind} onNotice={notice} />
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
              onExport={() => void exportXlsx()}
            >
              <span className="text-sm text-muted-foreground">
                К выдаче: <b className="text-foreground">{money(toPay)}</b>
              </span>
            </PayrollTableToolbar>
            <div className="overflow-x-auto">
              <table className={PAYROLL_TABLE}>
                <thead className={PAYROLL_THEAD}>
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
                  {paged.pageRows.map((r) => {
                    const kind = PAYOUT_KIND[r.kind];
                    return (
                      <tr key={`${r.kind}-${r.id}`} className={PAYROLL_TR}>
                        <td className={cn(TD, "text-center")}>
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">{r.position}</span>
                        </td>
                        <td className={TD}>
                          <div className="font-medium text-foreground">{r.fio}</div>
                          <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}</div>
                        </td>
                        <td className={cn(TD, "text-muted-foreground")}>
                          {r.branch ?? "—"}
                          {r.no_cashier ? (
                            <div className="flex items-center gap-1 text-[11px] text-amber-700">
                              <AlertTriangle className="size-3" /> У филиала нет кассы/кассира
                            </div>
                          ) : null}
                        </td>
                        <td className={TD}>
                          {kind ? <TonePill cls={kind.cls} dot={kind.dot}>{kind.label}</TonePill> : r.kind}
                          <div className="mt-1 text-[11px] text-muted-foreground">{ymLabel(r)}</div>
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
                            <div className="inline-flex gap-1.5">
                              {r.kind === "advance" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
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
                              <Button size="sm" className="h-8" onClick={() => setPayRow(r)}>
                                <Banknote className="mr-1 size-4" /> Выдать
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
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
