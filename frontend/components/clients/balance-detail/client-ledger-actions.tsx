"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { fmtDateTime, fmtMoney } from "@/lib/client-balance-detail/format";
import {
  paymentMethodSelectOptions,
  type ProfilePaymentMethodEntry
} from "@/lib/payment-method-options";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type DeletedRow = {
  id: number;
  number?: string | null;
  amount: string;
  paid_at?: string | null;
  deleted_at?: string | null;
  note?: string | null;
  delete_reason_ref?: string | null;
  deleted_by_name?: string | null;
  payment_type?: string | null;
};

function ActButton({
  id,
  open,
  label,
  className,
  methods,
  onPick,
  onToggle
}: {
  id: string;
  open: boolean;
  label: string;
  className: string;
  methods: { value: string; label: string }[];
  onPick: (paymentType: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-white shadow-sm",
          className
        )}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-30 min-w-[11rem] overflow-hidden rounded-lg border border-[#e6eeec] bg-white py-1 shadow-lg">
          {methods.map((m) => (
            <button
              key={`${id}-${m.value}`}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[13px] text-[#334155] hover:bg-[#e7f6f5] hover:text-[#0f6e68]"
              onClick={() => onPick(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ClientLedgerActions({
  tenantSlug,
  clientId,
  canDebt,
  canPay,
  canHistory,
  onAddDebt,
  onAddPayment
}: {
  tenantSlug: string;
  clientId: number;
  canDebt?: boolean;
  canPay?: boolean;
  canHistory?: boolean;
  onAddDebt?: (paymentType: string) => void;
  onAddPayment?: (paymentType: string) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const methodsQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "ledger-actions"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { payment_types?: string[]; payment_method_entries?: ProfilePaymentMethodEntry[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return paymentMethodSelectOptions(data.references, data.references?.payment_types);
    }
  });
  const methods = methodsQ.data ?? [];
  const deletedQ = useQuery({
    queryKey: ["client-deleted-payments", tenantSlug, clientId],
    enabled: historyOpen && Boolean(tenantSlug),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await api.get<{ data: DeletedRow[] }>(
        `/api/${tenantSlug}/payments?client_id=${clientId}&payment_status=deleted&limit=50&page=1`
      );
      return data.data ?? [];
    }
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {canDebt ? (
          <ActButton
            id="debt"
            open={menu === "debt"}
            label="Добавить долг"
            className="bg-[#e53935] hover:bg-[#c62828]"
            methods={methods}
            onToggle={() => setMenu((m) => (m === "debt" ? null : "debt"))}
            onPick={(t) => {
              setMenu(null);
              onAddDebt?.(t);
            }}
          />
        ) : null}
        {canPay ? (
          <ActButton
            id="pay"
            open={menu === "pay"}
            label="Оплата"
            className="bg-[#43a047] hover:bg-[#2e7d32]"
            methods={methods}
            onToggle={() => setMenu((m) => (m === "pay" ? null : "pay"))}
            onPick={(t) => {
              setMenu(null);
              onAddPayment?.(t);
            }}
          />
        ) : null}
        {canHistory ? (
          <button
            type="button"
            onClick={() => {
              setMenu(null);
              setHistoryOpen(true);
            }}
            className="inline-flex h-7 items-center rounded-md bg-[#00897b] px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#00695c]"
          >
            История удалений
          </button>
        ) : null}
      </div>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#0f6e68]">История удалений</DialogTitle>
          </DialogHeader>
          {deletedQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : deletedQ.isError ? (
            <p className="text-sm text-red-600">Не удалось загрузить историю удалений.</p>
          ) : (deletedQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Удалённых оплат нет.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">Удалена</th>
                  <th className="pr-2">Номер</th>
                  <th className="pr-2 text-right">Сумма</th>
                  <th className="pr-2">Кто</th>
                  <th>Причина</th>
                </tr>
              </thead>
              <tbody>
                {deletedQ.data!.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {r.deleted_at ? fmtDateTime(r.deleted_at) : r.paid_at ? fmtDateTime(r.paid_at) : "—"}
                    </td>
                    <td className="pr-2">{r.number || r.id}</td>
                    <td className="pr-2 text-right tabular-nums">{fmtMoney(Number(r.amount))}</td>
                    <td className="pr-2">{r.deleted_by_name || "—"}</td>
                    <td className="max-w-[14rem] truncate">{r.delete_reason_ref || r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
