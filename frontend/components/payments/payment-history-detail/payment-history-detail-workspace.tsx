"use client";

import { HistoryDrawer } from "@/components/history/history-drawer";
import { DeletePaymentModal } from "@/components/payments/client-payments/delete-payment-modal";
import { RestorePaymentModal } from "@/components/payments/client-payments/restore-payment-modal";
import { formatPaymentMoney } from "@/components/payments/client-payments/template-ui";
import { PageShell } from "@/components/dashboard/page-shell";
import { PaymentAllocateDialog } from "@/components/payments/payment-allocate-dialog";
import {
  PaymentHistoryApproveModal,
  PaymentHistoryPrintModal,
  PaymentHistoryRejectModal
} from "@/components/payments/payment-history-detail/payment-history-detail-modals";
import { PaymentHistoryDetailSkeleton } from "@/components/payments/payment-history-detail/payment-history-detail-skeleton";
import {
  buildPaymentHistoryRows,
  formatPaymentHistoryDateTime
} from "@/components/payments/payment-history-detail/payment-history-detail-utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PaymentDetailPayload } from "@/lib/payment-detail-types";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, History, Printer, Split, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function PaymentHistoryComparisonTable({ rows }: { rows: ReturnType<typeof buildPaymentHistoryRows> }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-[0_1px_4px_rgba(15,52,56,0.08)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={cn("border border-slate-200", r.shaded && "bg-slate-50")}>
                <td className="w-[56%] border border-slate-200 px-4 py-2 text-[14px] text-slate-400">
                  {r.label}
                </td>
                <td className="w-[22%] border border-slate-200 px-4 py-2 text-[14px] text-slate-600">
                  {r.v1 ?? ""}
                </td>
                <td className="w-[22%] border border-slate-200 px-4 py-2 text-[14px] text-slate-600">
                  {r.v2 ?? ""}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="h-4" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllocationsSection({ data }: { data: PaymentDetailPayload }) {
  if (data.allocations.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Распределение по заказам отсутствует. Используйте «Распределить по заказам» для FIFO-закрытия долгов.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Заказ</th>
            <th className="px-4 py-2.5 text-right font-semibold">Сумма</th>
            <th className="px-4 py-2.5 font-semibold">Дата</th>
          </tr>
        </thead>
        <tbody>
          {data.allocations.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="px-4 py-2">
                <Link
                  className="font-mono text-teal-700 underline-offset-2 hover:underline"
                  href={`/orders/${a.order_id}`}
                >
                  {a.order_number}
                </Link>
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {formatNumberGrouped(a.amount, { maxFractionDigits: 2 })}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                {formatPaymentHistoryDateTime(a.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentHistoryDetailWorkspace() {
  const params = useParams();
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const paymentId = Number.parseInt(idStr ?? "", 10);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const effectiveRole = useEffectiveRole();
  const qc = useQueryClient();

  const [allocateOpen, setAllocateOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const invalid = !Number.isFinite(paymentId) || paymentId < 1;
  const canDelete = effectiveRole === "admin";

  const detailQ = useQuery({
    queryKey: ["payment-detail", tenantSlug, paymentId],
    enabled: Boolean(tenantSlug) && hydrated && !invalid,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<PaymentDetailPayload>(`/api/${tenantSlug}/payments/${paymentId}`);
      return data;
    }
  });

  const invalidateDetail = () => {
    void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["payment-detail", tenantSlug, paymentId] });
    void qc.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug] });
  };

  const confirmMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/${tenantSlug}/payments/${paymentId}/confirm`);
    },
    onSuccess: () => {
      setApproveOpen(false);
      invalidateDetail();
    }
  });

  const rejectMut = useMutation({
    mutationFn: async (reason: string) => {
      await api.post(`/api/${tenantSlug}/payments/${paymentId}/reject`, { reason });
    },
    onSuccess: () => {
      setRejectOpen(false);
      invalidateDetail();
    }
  });

  const p = detailQ.data?.payment;
  const data = detailQ.data;
  const isVoided = Boolean(p?.deleted_at);
  const isPending = p?.workflow_status === "pending_confirmation" && !isVoided;
  const rows = data ? buildPaymentHistoryRows(data) : [];

  const handlePrint = () => {
    setPrintOpen(false);
    window.print();
  };

  return (
    <PageShell className="pb-24">
      <div className="bg-gradient-to-b from-slate-200/70 via-slate-100/60 to-transparent -mx-4 px-4 pt-5 pb-1 sm:-mx-6 sm:px-6">
        <h1 className="text-[24px] leading-8 font-bold tracking-tight text-slate-800">
          История оплаты клиентов
        </h1>
        {p ? (
          <p className="mt-1 text-sm text-slate-500">
            Платёж #{p.id} · {p.client_name}
            {p.client_code ? ` (${p.client_code})` : ""}
          </p>
        ) : null}
      </div>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Сессия…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти
          </Link>
        </p>
      ) : invalid ? (
        <p className="text-sm text-destructive">Неверный идентификатор.</p>
      ) : detailQ.isLoading ? (
        <PaymentHistoryDetailSkeleton />
      ) : detailQ.isError || !p || !data ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-24 text-center shadow-sm">
          <h2 className="text-[18px] font-semibold text-slate-800">Ошибка загрузки</h2>
          <p className="mt-1 max-w-sm text-[14px] text-slate-500">
            Не удалось загрузить данные платежа. Проверьте соединение.
          </p>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-5")}
            onClick={() => void detailQ.refetch()}
          >
            Повторить запрос
          </button>
        </div>
      ) : (
        <>
          {isVoided ? (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">Платёж в архиве (отменён)</p>
              <p className="mt-1 text-muted-foreground">
                Дата отмены: {p.deleted_at ? formatPaymentHistoryDateTime(p.deleted_at) : "—"}
                {p.deleted_by_name ? ` · Кто: ${p.deleted_by_name}` : ""}
                {p.delete_reason_ref ? ` · Причина: ${p.delete_reason_ref}` : ""}
              </p>
            </div>
          ) : null}

          <PaymentHistoryComparisonTable rows={rows} />

          <div className="mt-6 space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Распределение по заказам</h2>
            <AllocationsSection data={data} />
          </div>

          <PaymentAllocateDialog
            open={allocateOpen}
            onOpenChange={setAllocateOpen}
            tenantSlug={tenantSlug}
            payment={{
              id: p.id,
              client_id: p.client_id,
              client_name: p.client_name,
              amount: p.amount
            }}
            onAllocated={invalidateDetail}
          />

          <PaymentHistoryApproveModal
            open={approveOpen}
            onClose={() => setApproveOpen(false)}
            onConfirm={() => confirmMut.mutate()}
            loading={confirmMut.isPending}
            payment={p}
          />

          <PaymentHistoryRejectModal
            open={rejectOpen}
            onClose={() => setRejectOpen(false)}
            onConfirm={(reason) => rejectMut.mutate(reason)}
            loading={rejectMut.isPending}
          />

          <PaymentHistoryPrintModal
            open={printOpen}
            onClose={() => setPrintOpen(false)}
            payment={p}
            onPrint={handlePrint}
          />

          <DeletePaymentModal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            tenantSlug={tenantSlug}
            paymentId={paymentId}
            onConfirmed={() => {
              setDeleteOpen(false);
              invalidateDetail();
            }}
          />

          <RestorePaymentModal
            open={restoreOpen}
            onClose={() => setRestoreOpen(false)}
            tenantSlug={tenantSlug}
            paymentId={paymentId}
            onConfirmed={() => {
              setRestoreOpen(false);
              invalidateDetail();
            }}
          />

          <HistoryDrawer
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            entityType="payment"
            entityId={paymentId}
            title={`История · оплата #${paymentId}`}
          />
        </>
      )}

      {p && data && !detailQ.isLoading && !detailQ.isError ? (
        <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-2px_10px_rgba(15,52,56,0.07)] backdrop-blur md:left-[15.5rem]">
          <div className="mx-auto flex max-w-none flex-wrap items-center gap-2">
            <Link
              href="/payments"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex items-center gap-1.5"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Link>

            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1.5")}
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              История
            </button>

            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1.5")}
              onClick={() => setPrintOpen(true)}
            >
              <Printer className="h-4 w-4" />
              Печать
            </button>

            {!isVoided ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1.5")}
                onClick={() => setAllocateOpen(true)}
              >
                <Split className="h-4 w-4" />
                Распределить
              </button>
            ) : null}

            {isPending ? (
              <>
                <button
                  type="button"
                  className={cn(buttonVariants({ size: "sm" }), "inline-flex items-center gap-1.5")}
                  onClick={() => setApproveOpen(true)}
                  disabled={confirmMut.isPending}
                >
                  <Check className="h-4 w-4" />
                  Подтвердить
                </button>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "destructive", size: "sm" }),
                    "inline-flex items-center gap-1.5"
                  )}
                  onClick={() => setRejectOpen(true)}
                  disabled={rejectMut.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  Отклонить
                </button>
              </>
            ) : null}

            {canDelete && !isVoided ? (
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "destructive", size: "sm" }),
                  "inline-flex items-center gap-1.5"
                )}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                В архив
              </button>
            ) : null}

            {canDelete && isVoided ? (
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                )}
                onClick={() => setRestoreOpen(true)}
              >
                Восстановить
              </button>
            ) : null}

            <Link
              href={`/clients/${p.client_id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto text-teal-700")}
            >
              Клиент · {formatPaymentMoney(p.amount)}
            </Link>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
