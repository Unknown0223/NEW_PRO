"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { PayrollPickSelect } from "@/components/payroll/kit/payroll-kit-picker";
import { PAYROLL_MODAL_INPUT, PayrollModal, PayrollModalActions, PayrollModalField, PayrollModalNote } from "@/components/payroll/kit/payroll-kit-modal";
import {
  agentLabel,
  NO_SUPERVISOR,
  sum,
  supervisorQuery,
  toNum,
  type ConsignmentLimitAgent,
  type ConsignmentSupervisor
} from "@/components/staff/consignment-limits/consignment-limit-shared";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  tradeDirectionId: string;
  supervisors: ConsignmentSupervisor[];
  initialSupervisor: string;
  onDone: (message: string) => void;
};

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--pr-border)] bg-card p-3">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">{n}</span>
        {title}
      </p>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "brand" | "warn" }) {
  return (
    <div className="rounded-lg bg-[var(--pr-head)] px-2.5 py-2">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-[13px] font-bold tabular-nums", tone === "brand" && "text-[var(--pr-brand-700)]", tone === "warn" && "text-amber-700")}>{value}</p>
    </div>
  );
}

/** Supervayzer ichida konsignatsiya limitini bir agentdan boshqasiga o‘tkazish (umumiy limit o‘zgarmaydi). */
export function ConsignmentLimitTransferDialog({ open, onClose, tenantSlug, tradeDirectionId, supervisors, initialSupervisor, onDone }: Props) {
  const [supervisor, setSupervisor] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [clamped, setClamped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupervisor(initialSupervisor);
    setFromId("");
    setToId("");
    setAmount("");
    setClamped(false);
    setError(null);
  }, [open, initialSupervisor]);

  const agentsQ = useQuery({
    queryKey: ["consignment", "limit-transfer", tenantSlug, tradeDirectionId, supervisor],
    enabled: open && Boolean(supervisor) && Boolean(tradeDirectionId),
    queryFn: async () => {
      const qs = [`trade_direction_id=${encodeURIComponent(tradeDirectionId)}`, supervisorQuery(supervisor)].filter(Boolean).join("&");
      const { data } = await api.get<{ data: ConsignmentLimitAgent[] }>(`/api/${tenantSlug}/consignment/agents?${qs}`);
      return data.data;
    }
  });
  const agents = useMemo(() => agentsQ.data ?? [], [agentsQ.data]);
  const from = agents.find((a) => String(a.id) === fromId);
  const to = agents.find((a) => String(a.id) === toId);
  const fromLimit = toNum(from?.consignment_limit_amount);
  const maxAmount = from ? toNum(from.remaining_limit) : 0;
  const value = toNum(amount);
  const groupTotal = agents.reduce((s, a) => s + toNum(a.consignment_limit_amount), 0);

  const setAmountClamped = (raw: string) => {
    setError(null);
    if (from && toNum(raw) > maxAmount) {
      setAmount(String(maxAmount));
      setClamped(true);
      return;
    }
    setAmount(raw);
    setClamped(false);
  };

  const submit = async () => {
    if (!from || !to || value <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/${tenantSlug}/consignment/limits/transfer`, { from_user_id: from.id, to_user_id: to.id, amount: String(value) });
      onDone(`Лимит ${sum(value)} передан: ${from.name} → ${to.name}`);
      onClose();
    } catch (e) {
      const body = isAxiosError(e) ? (e.response?.data as { error?: string; max?: string } | undefined) : undefined;
      if (body?.error === "AMOUNT_EXCEEDS_AVAILABLE" && body.max != null) {
        setAmount(body.max);
        setClamped(true);
        void agentsQ.refetch();
      }
      setError(getUserFacingError(e, "Не удалось перераспределить лимит"));
    } finally {
      setBusy(false);
    }
  };

  const supervisorOptions = [
    ...supervisors.map((s) => ({ value: String(s.id), label: s.fio })),
    { value: NO_SUPERVISOR, label: "Агенты без супервайзера" }
  ];
  const fromOptions = agents
    .filter((a) => a.consignment_limit_amount != null)
    .map((a) => ({ value: String(a.id), label: agentLabel(a), hint: `Лимит ${sum(a.consignment_limit_amount)} · свободно ${sum(a.remaining_limit)}` }));
  const toOptions = agents
    .filter((a) => String(a.id) !== fromId)
    .map((a) => ({
      value: String(a.id),
      label: agentLabel(a),
      hint: a.consignment_limit_amount != null ? `Лимит ${sum(a.consignment_limit_amount)}` : "Лимит не задан"
    }));

  return (
    <PayrollModal open={open} onClose={onClose} title="Перераспределение лимита консигнации" width="sm:max-w-[600px]" className="top-[3vh] max-h-[94vh]">
      <div className="space-y-3">
        <PayrollModalNote>
          Лимит уменьшается у одного агента и на ту же сумму увеличивается у другого агента этого же супервайзера — общий лимит группы не меняется.
        </PayrollModalNote>
        <PayrollPickSelect
          size="field"
          label="Супервайзер"
          placeholder="Выберите супервайзера"
          allowEmpty={false}
          searchable={supervisorOptions.length > 8}
          value={supervisor}
          options={supervisorOptions}
          onChange={(v) => {
            setSupervisor(v);
            setFromId("");
            setToId("");
            setAmount("");
            setClamped(false);
          }}
        />

        <Step n={1} title="У кого уменьшить">
          <PayrollPickSelect
            size="field"
            label="Агент"
            placeholder={!supervisor ? "Сначала выберите супервайзера" : agentsQ.isLoading ? "Загрузка…" : "Выберите агента"}
            allowEmpty={false}
            disabled={!supervisor || agentsQ.isLoading}
            searchable={fromOptions.length > 8}
            emptyText="У агентов этого супервайзера лимит не задан"
            value={fromId}
            options={fromOptions}
            onChange={(v) => {
              setFromId(v);
              if (v === toId) setToId("");
              setAmount("");
              setClamped(false);
            }}
          />
          {from ? (
            <>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <Stat label="Лимит" value={sum(fromLimit)} />
                <Stat label="Использовано" value={sum(from.outstanding_debt)} tone="warn" />
                <Stat label="Можно уменьшить" value={sum(maxAmount)} tone="brand" />
              </div>
              <PayrollModalField
                className="mt-2.5"
                label="Сумма уменьшения"
                error={clamped ? `Больше нельзя: максимум ${sum(maxAmount)} — остальная часть лимита уже использована` : null}
                hint={
                  <button type="button" className="font-medium text-[var(--pr-brand-600)] hover:underline" onClick={() => setAmountClamped(String(maxAmount))}>
                    Весь свободный остаток — {sum(maxAmount)}
                  </button>
                }
              >
                <GroupedNumberInput
                  value={amount}
                  onValueChange={setAmountClamped}
                  maxFractionDigits={2}
                  placeholder="0"
                  disabled={maxAmount <= 0}
                  className={cn(PAYROLL_MODAL_INPUT, "text-[15px] font-bold tabular-nums")}
                />
              </PayrollModalField>
              {maxAmount <= 0 ? <PayrollModalNote tone="warn">Весь лимит агента уже использован — уменьшать нечего.</PayrollModalNote> : null}
            </>
          ) : null}
        </Step>

        <Step n={2} title="Кому передать">
          <PayrollPickSelect
            size="field"
            label="Агент"
            placeholder={from ? "Выберите агента" : "Сначала выберите, у кого уменьшить"}
            allowEmpty={false}
            disabled={!from}
            searchable={toOptions.length > 8}
            emptyText="Других агентов у этого супервайзера нет"
            value={toId}
            options={toOptions}
            onChange={setToId}
          />
        </Step>

        {from && to && value > 0 ? (
          <div className="space-y-1.5 rounded-xl border border-[var(--pr-brand-200)] bg-[var(--pr-brand-50)] p-3.5 text-[12.5px]">
            {[
              { a: from, before: fromLimit, after: fromLimit - value },
              { a: to, before: toNum(to.consignment_limit_amount), after: toNum(to.consignment_limit_amount) + value }
            ].map(({ a, before, after }) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="truncate font-medium text-foreground">{a.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                  <span className="text-muted-foreground">{sum(before)}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className={cn("font-bold", after < before ? "text-rose-600" : "text-[var(--pr-brand-700)]")}>{sum(after)}</span>
                </span>
              </div>
            ))}
            <p className="border-t border-[var(--pr-brand-200)] pt-1.5 text-muted-foreground">
              Общий лимит группы не меняется: <span className="font-semibold text-foreground">{sum(groupTotal)}</span>
            </p>
          </div>
        ) : null}

        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        <PayrollModalActions
          onCancel={onClose}
          onSubmit={() => void submit()}
          submitLabel="Перераспределить"
          busy={busy}
          disabled={!from || !to || value <= 0 || value > maxAmount}
        />
      </div>
    </PayrollModal>
  );
}
