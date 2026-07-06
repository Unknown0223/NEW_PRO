"use client";

import { AddClientExpenseDialog } from "@/components/client-expenses/add-client-expense-dialog";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { EditPaymentDialog } from "@/components/payments/edit-payment-dialog";
import { PageShell } from "@/components/dashboard/page-shell";
import { ClientBalanceDetailWorkspace } from "@/components/clients/balance-detail/client-balance-detail-workspace";
import { api } from "@/lib/api";
import type {
  ClientBalanceLedgerResponse,
  ClientDebtorCreditorMonthlyResponse,
  DebtorCreditorMonthRow
} from "@/lib/client-balance-ledger-types";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  clientId: number;
  embedded?: boolean;
  pageShellClassName?: string;
};

const LEDGER_AMOUNT_FMT = { minFractionDigits: 0, maxFractionDigits: 0 } as const;

function parseAmount(s: string): number {
  const t = String(s)
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/\u2212/g, "-")
    .replace(/−/g, "-")
    .replace(/,/g, ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function ReportDcCell({ value, variant }: { value: string; variant: "plain" | "saldo" }) {
  const n = parseAmount(value);
  const formatted = formatNumberGrouped(n, LEDGER_AMOUNT_FMT);
  if (variant === "plain") {
    return <span className="tabular-nums">{formatted}</span>;
  }
  const cls =
    n < 0
      ? "text-red-600 dark:text-red-400"
      : n > 0
        ? "text-teal-600 dark:text-teal-400"
        : "text-muted-foreground";
  return <span className={cn("tabular-nums font-medium", cls)}>{formatted}</span>;
}

function DebtorCreditorMonthlySection({
  tenantSlug,
  clientId,
  open,
  onOpenChange
}: {
  tenantSlug: string;
  clientId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const hydrated = useAuthStoreHydrated();
  const q = useQuery({
    queryKey: ["client-debtor-creditor-monthly", tenantSlug, clientId],
    staleTime: STALE.list,
    enabled: Boolean(hydrated && tenantSlug && open),
    queryFn: async () => {
      const { data } = await api.get<ClientDebtorCreditorMonthlyResponse>(
        `/api/${tenantSlug}/clients/${clientId}/debtor-creditor-monthly`
      );
      return data;
    }
  });

  return (
    <div className="mt-4 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-semibold text-foreground hover:bg-gray-50"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[#1aa096] transition-transform", open && "rotate-180")}
        />
        Отчёт по дебиторской и кредиторской задолженности
      </button>
      {open ? (
        <div className="border-t border-gray-200 bg-gray-50/50 p-3 sm:p-5">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">Не удалось загрузить отчёт.</p>
          ) : (q.data?.rows.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных за период.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100 text-left text-xs font-medium text-gray-600">
                    <th rowSpan={2} className="align-bottom px-3 py-2">
                      Месяц
                    </th>
                    <th colSpan={3} className="border-l border-gray-200 px-3 py-2 text-center">
                      За этот месяц
                    </th>
                    <th colSpan={3} className="border-l border-gray-200 px-3 py-2 text-center">
                      За весь период
                    </th>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
                    <th className="border-l border-gray-200 px-3 py-2 text-right">Дебет</th>
                    <th className="px-3 py-2 text-right">Кредит</th>
                    <th className="px-3 py-2 text-right">Сальдо</th>
                    <th className="border-l border-gray-200 px-3 py-2 text-right">Дебет</th>
                    <th className="px-3 py-2 text-right">Кредит</th>
                    <th className="px-3 py-2 text-right">Сальдо</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data!.rows.map((row: DebtorCreditorMonthRow, i: number) => (
                    <tr key={row.month_key} className={cn("border-b border-gray-100", i % 2 === 1 && "bg-sky-50/45")}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-[#1aa096]">{row.month_label}</td>
                      <td className="border-l border-gray-100 px-3 py-2 text-right">
                        <ReportDcCell value={row.this_month.debit} variant="plain" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ReportDcCell value={row.this_month.credit} variant="plain" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ReportDcCell value={row.this_month.saldo} variant="saldo" />
                      </td>
                      <td className="border-l border-gray-100 px-3 py-2 text-right">
                        <ReportDcCell value={row.cumulative.debit} variant="plain" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ReportDcCell value={row.cumulative.credit} variant="plain" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ReportDcCell value={row.cumulative.saldo} variant="saldo" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ClientBalanceLedgerView({ clientId, embedded = false, pageShellClassName }: Props) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const queryClient = useQueryClient();
  const role = useEffectiveRole();
  const canEditPayments = isAdminOrOperatorLikeRole(role);

  const [debtorReportOpen, setDebtorReportOpen] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);

  const ledgerMetaQ = useQuery({
    queryKey: ["client-balance-ledger-meta", tenantSlug, clientId],
    staleTime: STALE.list,
    enabled: Boolean(hydrated && tenantSlug && !embedded),
    queryFn: async () => {
      const { data } = await api.get<ClientBalanceLedgerResponse>(
        `/api/${tenantSlug}/clients/${clientId}/balance-ledger?page=1&limit=1`
      );
      return data;
    }
  });

  const ledgerClientLabel = useMemo(() => {
    const c = ledgerMetaQ.data?.client;
    if (!c) return "";
    const code = c.client_code?.trim();
    return code ? `${code} ${c.name}` : c.name;
  }, [ledgerMetaQ.data?.client]);

  if (!hydrated || !tenantSlug) {
    if (embedded) {
      return <p className="py-4 text-sm text-muted-foreground">Загрузка…</p>;
    }
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </PageShell>
    );
  }

  const clientTitle = (ledgerMetaQ.data?.client.name ?? "").trim() || `Клиент #${clientId}`;

  const inner = (
    <>
      {!embedded ? (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Навигация">
          <Link href="/client-balances" className="rounded-md hover:text-primary hover:underline underline-offset-4">
            Балансы клиентов
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden />
          <Link
            href={`/clients/${clientId}`}
            className="font-medium text-foreground hover:text-primary hover:underline underline-offset-4"
          >
            {clientTitle}
          </Link>
        </nav>
      ) : null}

      <ClientBalanceDetailWorkspace
        tenantSlug={tenantSlug}
        clientId={clientId}
        embedded={embedded}
        canEditPayments={canEditPayments}
        onEditPayment={setEditPaymentId}
        onAddDebt={() => setAddDebtOpen(true)}
        onAddPayment={() => setAddPaymentOpen(true)}
      />

      <AddClientExpenseDialog
        key={`debt-${clientId}`}
        open={addDebtOpen}
        onOpenChange={setAddDebtOpen}
        tenantSlug={tenantSlug}
        fixedClientId={clientId}
        fixedClientLabel={ledgerClientLabel || `Клиент #${clientId}`}
        defaultLedgerAgentId={ledgerMetaQ.data?.client.agent_id ?? null}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug, clientId] });
        }}
      />
      <AddPaymentDialog
        key={`pay-${clientId}`}
        open={addPaymentOpen}
        onOpenChange={setAddPaymentOpen}
        tenantSlug={tenantSlug}
        lockedClientId={String(clientId)}
        lockedClientLabel={ledgerClientLabel || `Клиент #${clientId}`}
        initialLedgerAgentId={ledgerMetaQ.data?.client.agent_id ?? null}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug, clientId] });
        }}
      />
      <EditPaymentDialog
        open={editPaymentId != null}
        onOpenChange={(o) => {
          if (!o) setEditPaymentId(null);
        }}
        tenantSlug={tenantSlug}
        paymentId={editPaymentId}
        clientId={clientId}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug, clientId] });
        }}
      />

      <DebtorCreditorMonthlySection
        tenantSlug={tenantSlug}
        clientId={clientId}
        open={debtorReportOpen}
        onOpenChange={setDebtorReportOpen}
      />
    </>
  );

  if (embedded) {
    return <div className="min-w-0">{inner}</div>;
  }
  return <PageShell className={pageShellClassName}>{inner}</PageShell>;
}
