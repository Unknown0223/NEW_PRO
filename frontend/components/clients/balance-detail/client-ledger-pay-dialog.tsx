"use client";

import { Button } from "@/components/ui/button";
import { DateTimePickerField, localValueToDatetimeInput } from "@/components/ui/datetime-popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import {
  defaultPaymentTypeValue,
  paymentMethodSelectOptions,
  type ProfilePaymentMethodEntry
} from "@/lib/payment-method-options";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type Assignment = {
  agent_id: number | null;
  agent_name: string | null;
  expeditor_user_id: number | null;
  expeditor_name: string | null;
};

type ClientCard = {
  agent_id: number | null;
  agent_name: string | null;
  agent_assignments: Assignment[];
};

type OrderRow = { id: number; number: string | null; total_sum: string; created_at: string };
type Desk = { id: number; name: string; is_active?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  clientId: number;
  clientLabel: string;
  onCreated?: () => void;
  initialPaymentType?: string;
};

const field =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1aa096]/40";

export function ClientLedgerPayDialog({
  open,
  onOpenChange,
  tenantSlug,
  clientId,
  clientLabel,
  onCreated,
  initialPaymentType
}: Props) {
  const [orderId, setOrderId] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [agentId, setAgentId] = useState("");
  const [expeditorId, setExpeditorId] = useState("");
  const [amount, setAmount] = useState("");
  const [payType, setPayType] = useState("");
  const [deskId, setDeskId] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [err, setErr] = useState("");

  const clientQ = useQuery({
    queryKey: ["client-card-pay", tenantSlug, clientId],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<ClientCard>(`/api/${tenantSlug}/clients/${clientId}`);
      return data;
    }
  });

  const ordersQ = useQuery({
    queryKey: ["client-orders-pay", tenantSlug, clientId, orderSearch],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const q = orderSearch.trim() ? `&search=${encodeURIComponent(orderSearch.trim())}` : "";
      const { data } = await api.get<{ data: OrderRow[] }>(
        `/api/${tenantSlug}/orders?client_id=${clientId}&limit=80&page=1${q}`
      );
      return data.data ?? [];
    }
  });

  const desksQ = useQuery({
    queryKey: ["cash-desks-pay", tenantSlug],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ data: Desk[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=100&page=1`
      );
      return (data.data ?? []).filter((d) => d.is_active !== false);
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "ledger-pay"],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { payment_types?: string[]; payment_method_entries?: ProfilePaymentMethodEntry[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const agents = useMemo(() => {
    const map = new Map<number, string>();
    const card = clientQ.data;
    if (card?.agent_id && card.agent_name) map.set(card.agent_id, card.agent_name);
    for (const a of card?.agent_assignments ?? []) {
      if (a.agent_id && a.agent_name) map.set(a.agent_id, a.agent_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [clientQ.data]);

  const expeditors = useMemo(() => {
    const aid = Number.parseInt(agentId, 10);
    const rows = clientQ.data?.agent_assignments ?? [];
    const scoped = Number.isFinite(aid)
      ? rows.filter((a) => a.agent_id === aid && a.expeditor_user_id)
      : rows.filter((a) => a.expeditor_user_id);
    const map = new Map<number, string>();
    for (const a of scoped) {
      if (a.expeditor_user_id) map.set(a.expeditor_user_id, a.expeditor_name || `№${a.expeditor_user_id}`);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [clientQ.data, agentId]);

  const payOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );

  useEffect(() => {
    if (!open) return;
    setErr("");
    setOrderId("");
    setAmount("");
    setNote("");
    setPaidAt(localValueToDatetimeInput(new Date()));
    setPayType(initialPaymentType?.trim() || defaultPaymentTypeValue(payOpts));
  }, [open, clientId, payOpts, initialPaymentType]);

  useEffect(() => {
    if (agents.length === 1) setAgentId(String(agents[0].id));
    else if (agentId && !agents.some((a) => String(a.id) === agentId)) setAgentId("");
  }, [agents, agentId]);

  useEffect(() => {
    if (expeditors.length === 1) setExpeditorId(String(expeditors[0].id));
    else if (expeditorId && !expeditors.some((e) => String(e.id) === expeditorId)) setExpeditorId("");
  }, [expeditors, expeditorId]);

  useEffect(() => {
    const desks = desksQ.data ?? [];
    if (desks.length === 1) setDeskId(String(desks[0].id));
  }, [desksQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const oid = Number.parseInt(orderId, 10);
      const amt = Number.parseFloat(amount.replace(/\s/g, "").replace(",", "."));
      const aid = Number.parseInt(agentId, 10);
      const eid = Number.parseInt(expeditorId, 10);
      const desk = Number.parseInt(deskId, 10);
      if (!Number.isFinite(oid) || oid < 1) throw new Error("Выберите заказ.");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Введите сумму.");
      if (agents.length > 0 && (!Number.isFinite(aid) || aid < 1)) throw new Error("Выберите агента этого клиента.");
      if (expeditors.length > 0 && (!Number.isFinite(eid) || eid < 1)) {
        throw new Error("Выберите доставщика этого клиента.");
      }
      if (!Number.isFinite(desk) || desk < 1) throw new Error("Выберите кассу.");
      if (!note.trim()) throw new Error("Комментарий обязателен.");
      const paid = paidAt.trim() ? new Date(paidAt) : null;
      const pt = (payType || defaultPaymentTypeValue(payOpts)).trim();
      if (!pt) throw new Error("Выберите способ оплаты.");
      await api.post(`/api/${tenantSlug}/payments`, {
        client_id: clientId,
        order_id: oid,
        amount: amt,
        payment_type: pt,
        note: note.trim(),
        cash_desk_id: desk,
        ...(paid && !Number.isNaN(paid.getTime()) ? { paid_at: paid.toISOString() } : {}),
        allocation_mode: "none",
        allocation_order_ids: [oid],
        ...(Number.isFinite(aid) && aid > 0 ? { ledger_agent_id: aid, allocation_agent_id: aid } : {}),
        ...(Number.isFinite(eid) && eid > 0 ? { expeditor_user_id: eid } : {})
      });
    },
    onSuccess: () => {
      onCreated?.();
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      setErr(getUserFacingError(e, "Сохранить не удалось."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[#d7ebe9] bg-[#f3fbfa] px-5 py-4">
          <DialogTitle className="text-[#0f6e68]">Оплата по заказу</DialogTitle>
          <DialogDescription>
            {clientLabel}. Сумма сразу принимается в кассу. Комментарий обязателен.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-[#334155]">Заказ</span>
            <input
              className={field}
              placeholder="Поиск по номеру"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
            <select className={field} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Выберите заказ</option>
              {(ordersQ.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number || o.id} · {o.total_sum}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#334155]">Агент</span>
            <select className={field} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">{agents.length ? "Выберите агента" : "Нет агента"}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#334155]">Доставщик</span>
            <select className={field} value={expeditorId} onChange={(e) => setExpeditorId(e.target.value)}>
              <option value="">{expeditors.length ? "Выберите доставщика" : "Нет доставщика"}</option>
              {expeditors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#334155]">Сумма</span>
            <input className={field} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#334155]">Способ</span>
            <select className={field} value={payType} onChange={(e) => setPayType(e.target.value)}>
              {payOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#334155]">Касса</span>
            <select className={field} value={deskId} onChange={(e) => setDeskId(e.target.value)}>
              <option value="">Выберите кассу</option>
              {(desksQ.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-sm">
            <span className="font-medium text-[#334155]">Дата и время</span>
            <DateTimePickerField value={paidAt} onChange={setPaidAt} timePlacement="side" />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label className="font-medium text-[#334155]">Комментарий *</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1aa096]/40"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Обязательный комментарий"
            />
          </div>
          {err ? <p className="text-sm text-destructive sm:col-span-2">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t bg-[#fafbfc] px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" className="bg-[#1aa096] hover:bg-[#158a81]" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Сохранение…" : "Принять в кассу"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
