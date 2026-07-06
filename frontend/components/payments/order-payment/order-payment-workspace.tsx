"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { api } from "@/lib/api";
import { useAuthStoreHydrated } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OrderPaymentFilterBar } from "./order-payment-filter-bar";
import { OrderPaymentStatistics } from "./order-payment-statistics";
import { OrderPaymentTable } from "./order-payment-table";
import {
  buildContextQuery,
  contextOrderToRow,
  defaultPaidAtLocal,
  fillCellDraftFromOrderAmount,
  prefillDraftFromTotalAmount,
  recomputeRowTotals,
  sumDraft,
  sumTotalPaid,
  toIsoFromLocal,
  type OrderCashInContext
} from "./order-payment-utils";
import type { OrderPaymentFilters, PaymentOrderRow, PaymentStatistics } from "./types";

type CashDeskRow = { id: number; name: string; is_active: boolean };

type Props = {
  tenantSlug: string;
};

function parseOrderIdsParam(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function OrderPaymentWorkspace({ tenantSlug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const hydrated = useAuthStoreHydrated();

  const clientIdParam = searchParams.get("client_id")?.trim() ?? "";
  const orderIdsParam = parseOrderIdsParam(searchParams.get("order_ids"));
  const amountParam = searchParams.get("amount")?.trim() ?? "";

  const [rows, setRows] = useState<PaymentOrderRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<OrderCashInContext["payment_methods"]>([]);
  const [prefillDone, setPrefillDone] = useState(false);
  const [filters, setFilters] = useState<OrderPaymentFilters>(() => ({
    paidAtLocal: defaultPaidAtLocal(),
    cashDeskId: "",
    errorOnly: false
  }));
  const [formErr, setFormErr] = useState<string | null>(null);

  const contextQ = useQuery({
    queryKey: [
      "order-cash-in-context",
      tenantSlug,
      clientIdParam,
      orderIdsParam.join(",")
    ],
    enabled: Boolean(tenantSlug) && hydrated && Boolean(clientIdParam),
    staleTime: STALE.detail,
    queryFn: async () => {
      const params = buildContextQuery(clientIdParam, orderIdsParam);
      const { data } = await api.get<{ data: OrderCashInContext }>(
        `/api/${tenantSlug}/payments/order-cash-in/context?${params.toString()}`
      );
      return data.data;
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "order-payment"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return (data.data ?? []).filter((d) => d.is_active);
    }
  });

  useEffect(() => {
    if (!contextQ.data) return;
    const methods = contextQ.data.payment_methods;
    setPaymentMethods(methods);
    let next = contextQ.data.orders.map((o) => contextOrderToRow(o, methods));
    if (!prefillDone && amountParam) {
      const amt = Number.parseFloat(amountParam.replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(amt) && amt > 0) {
        next = prefillDraftFromTotalAmount(next, methods, amt);
      }
      setPrefillDone(true);
    }
    setRows(next);
  }, [contextQ.data, amountParam, prefillDone]);

  const filteredRows = useMemo(() => {
    if (!filters.errorOnly) return rows;
    return rows.filter((r) => r.hasError);
  }, [rows, filters.errorOnly]);

  const statistics: PaymentStatistics = useMemo(() => {
    const total = rows.reduce((s, o) => s + o.orderAmount, 0);
    const totalDebt = rows.reduce((s, o) => s + o.debt, 0);
    const received = rows.reduce((s, o) => s + sumTotalPaid(o), 0);
    const unpaid = rows.reduce((s, o) => s + o.unpaid, 0);
    return {
      total,
      received,
      totalDebt,
      remaining: Math.max(0, total - received),
      unpaid
    };
  }, [rows]);

  const onSuccessCount = useMemo(
    () => rows.filter((o) => o.unpaid === 0 && !o.hasError).length,
    [rows]
  );

  const onUpdateDraft = useCallback((orderId: number, methodId: string, value: number) => {
    setRows((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return recomputeRowTotals({
          ...o,
          draftByMethodId: { ...o.draftByMethodId, [methodId]: value }
        });
      })
    );
  }, []);

  const onFillCellFromOrderAmount = useCallback((orderId: number, methodId: string) => {
    setRows((prev) =>
      prev.map((o) => (o.id === orderId ? fillCellDraftFromOrderAmount(o, methodId) : o))
    );
  }, []);

  const saveMut = useMutation({
    mutationFn: async () => {
      const cid = Number.parseInt(clientIdParam, 10);
      if (!Number.isFinite(cid) || cid < 1) throw new Error("NO_CLIENT");
      const deskRaw = filters.cashDeskId.trim();
      const deskId = deskRaw ? Number.parseInt(deskRaw, 10) : null;
      const cash_desk_id =
        deskId != null && Number.isFinite(deskId) && deskId > 0 ? deskId : null;
      const paid_at = toIsoFromLocal(filters.paidAtLocal);

      const methodById = new Map(paymentMethods.map((m) => [m.id, m]));
      const lines: Array<{ order_id: number; payment_type: string; amount: number }> = [];

      for (const row of rows) {
        for (const [methodId, amount] of Object.entries(row.draftByMethodId)) {
          if (!amount || amount <= 0) continue;
          const method = methodById.get(methodId);
          if (!method) continue;
          lines.push({
            order_id: row.id,
            payment_type: method.payment_type,
            amount
          });
        }
      }

      if (lines.length === 0) throw new Error("NO_LINES");

      await api.post(`/api/${tenantSlug}/payments/order-cash-in`, {
        client_id: cid,
        cash_desk_id,
        paid_at,
        lines
      });
    },
    onSuccess: async () => {
      setFormErr(null);
      await qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["order-cash-in-context", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
      router.push("/payments");
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === "NO_CLIENT") {
        setFormErr("Укажите клиента (перейдите из списка заявок с выбранными заказами).");
        return;
      }
      if (e instanceof Error && e.message === "NO_LINES") {
        setFormErr("Введите сумму хотя бы в одной ячейке.");
        return;
      }
      if (axios.isAxiosError(e)) {
        const code = (e.response?.data as { error?: string } | undefined)?.error;
        if (code === "BadCashDesk") {
          setFormErr("Указана несуществующая или неактивная касса.");
          return;
        }
        if (code === "BadOrder") {
          setFormErr("Заказ не найден или не принадлежит клиенту.");
          return;
        }
        if (code === "BadPaymentType") {
          setFormErr("Способ оплаты не найден в справочнике. Обновите страницу.");
          return;
        }
        if (code === "NoLines") {
          setFormErr("Нет строк для сохранения.");
          return;
        }
      }
      setFormErr(getUserFacingError(e, "Не удалось сохранить платежи."));
    }
  });

  const hasDraftLines = rows.some((r) => sumDraft(r) > 0);
  const clientName = contextQ.data?.client.name;

  return (
    <PageShell>
      <PageHeader
        title="Приход в кассу"
        description={
          clientIdParam
            ? orderIdsParam.length > 0
              ? `${clientName ?? "Клиент"} · выбранные заказы (${orderIdsParam.length})`
              : `${clientName ?? "Клиент"} · доставленные заказы`
            : "Выберите заказы в разделе «Заявки» → «Касса (выбранные)»"
        }
        actions={
          <Link
            href="/payments"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            ← К списку платежей
          </Link>
        }
      />

      {!hydrated || !tenantSlug ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : !clientIdParam ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p>Клиент не указан. Откройте страницу из списка заявок с выбранными заказами одного клиента.</p>
          <Link href="/orders" className="mt-3 inline-block text-teal-700 hover:underline dark:text-teal-400">
            Перейти к заявкам
          </Link>
        </div>
      ) : contextQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : contextQ.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {getUserFacingError(contextQ.error, "Не удалось загрузить данные.")}
        </p>
      ) : paymentMethods.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p>
            Нет активных способов оплаты. Настройте их в{" "}
            <Link href="/settings" className="text-teal-700 hover:underline dark:text-teal-400">
              Настройки → Финансы
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Записей: <span className="font-medium text-foreground">{filteredRows.length}</span>
            </span>
            <span>
              Способов оплаты:{" "}
              <span className="font-medium text-foreground">{paymentMethods.length}</span>
            </span>
          </div>

          {formErr ? (
            <p className="text-sm text-destructive" role="alert">
              {formErr}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <OrderPaymentTable
              orders={filteredRows}
              paymentMethods={paymentMethods}
              onUpdateDraft={onUpdateDraft}
              onFillCellFromOrderAmount={onFillCellFromOrderAmount}
              disabled={saveMut.isPending}
            />
            <OrderPaymentStatistics statistics={statistics} />
          </div>

          <OrderPaymentFilterBar
            filters={filters}
            onChange={setFilters}
            cashDesks={cashDesksQ.data ?? []}
            onSuccessCount={onSuccessCount}
            totalCount={rows.length}
            onSave={() => {
              setFormErr(null);
              saveMut.mutate();
            }}
            saving={saveMut.isPending}
            saveDisabled={!hasDraftLines || rows.some((r) => r.hasError)}
          />
        </div>
      )}
    </PageShell>
  );
}
