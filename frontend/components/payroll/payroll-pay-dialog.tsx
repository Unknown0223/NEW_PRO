"use client";

import { useEffect, useState } from "react";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useTenant } from "@/lib/api-client";
import { money, payrollApi, payrollErrorText, roleLabel, ymLabel } from "@/lib/payroll/payroll-api";
import { parseAmount } from "@/components/payroll/payroll-ui";
import {
  PAYROLL_MODAL_INPUT,
  PAYROLL_MODAL_SELECT,
  PayrollModal,
  PayrollModalActions,
  PayrollModalField,
  PayrollModalNote
} from "@/components/payroll/kit/payroll-kit-modal";

export type QueueRow = {
  kind: "advance" | "salary";
  id: number;
  position: number;
  user_id: number;
  fio: string;
  code: string | null;
  role: string | null;
  branch: string | null;
  year: number;
  month: number;
  amount: number;
  currency: string;
  approved_at: string | null;
  queue_key: string | null;
  skip_count: number;
  desk_ids: number[];
  no_cashier: boolean;
};
export type PayMethod = { id: string | number; ref: string; name: string; currency: string | null };

type Props = {
  row: QueueRow | null;
  desks: Array<{ id: number; name: string }>;
  methods: PayMethod[];
  defaultCurrency: string;
  onClose: () => void;
  onPaid: (text: string) => void;
};

export function PayrollPayDialog({ row, desks, methods, defaultCurrency, onClose, onPaid }: Props) {
  const tenant = useTenant();
  const [deskId, setDeskId] = useState("");
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = row?.desk_ids.length ? desks.filter((d) => row.desk_ids.includes(d.id)) : desks;

  useEffect(() => {
    if (!row) return;
    setDeskId(allowed.length === 1 ? String(allowed[0]!.id) : "");
    setMethod("");
    setAmount(String(row.amount));
    setComment("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const m = methods.find((x) => x.ref === method);
  const currency = m?.currency || defaultCurrency;
  const value = row?.kind === "salary" ? parseAmount(amount) : row?.amount ?? 0;
  const tooMuch = row != null && value > row.amount + 0.001;

  const pay = async () => {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await payrollApi(tenant).send("POST", "/payouts", {
        kind: row.kind,
        advance_id: row.kind === "advance" ? row.id : undefined,
        record_id: row.kind === "salary" ? row.id : undefined,
        cash_desk_id: Number(deskId),
        payment_method_ref: method || null,
        amount: row.kind === "salary" ? value : null,
        comment: comment.trim() || null
      });
      onPaid(`Выдано: ${row.fio} — ${money(value)}. Расход создан автоматически.`);
      onClose();
    } catch (e) {
      setError(payrollErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PayrollModal open={row != null} onClose={onClose} title={row?.kind === "salary" ? "Выдача зарплаты" : "Выдача аванса"}>
      {row ? (
        <div className="space-y-3.5">
          <div className="rounded-lg border border-[var(--pr-border)] bg-[var(--pr-head)] px-3.5 py-2.5">
            <p className="text-[13.5px] font-semibold text-foreground">{row.fio}</p>
            <p className="text-[12px] text-muted-foreground">
              {roleLabel(row.role)}{row.code ? ` · ${row.code}` : ""} · {row.branch ?? "—"} · {ymLabel(row)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {row.kind === "salary" ? "Остаток к выплате" : "Сумма аванса"}:{" "}
              <b className="tabular-nums text-[var(--pr-brand-600)]">{money(row.amount)} {row.currency}</b>
            </p>
          </div>
          <PayrollModalField label="Касса" select>
            <select className={PAYROLL_MODAL_SELECT} value={deskId} onChange={(e) => setDeskId(e.target.value)}>
              <option value="">— выберите —</option>
              {allowed.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </PayrollModalField>
          <PayrollModalField label="Способ оплаты" select>
            <select className={PAYROLL_MODAL_SELECT} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Наличные ({defaultCurrency})</option>
              {methods.map((x) => <option key={String(x.id)} value={x.ref}>{x.name}{x.currency ? ` (${x.currency})` : ""}</option>)}
            </select>
          </PayrollModalField>
          {row.kind === "salary" ? (
            <PayrollModalField label={`Сумма (${row.currency})`} error={tooMuch ? "Больше остатка к выплате" : null}>
              <GroupedNumberInput value={amount} maxFractionDigits={2} onValueChange={setAmount} className={PAYROLL_MODAL_INPUT} />
            </PayrollModalField>
          ) : null}
          {currency !== row.currency ? <PayrollModalNote tone="warn">Выдача в {currency}: сумма будет пересчитана по курсу на сегодня.</PayrollModalNote> : null}
          <PayrollModalField label="Комментарий">
            <input className={PAYROLL_MODAL_INPUT} value={comment} onChange={(e) => setComment(e.target.value)} />
          </PayrollModalField>
          {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
          <PayrollModalActions onCancel={onClose} onSubmit={() => void pay()} submitLabel="Выдать" busy={busy} disabled={!deskId || !(value > 0) || tooMuch} />
        </div>
      ) : null}
    </PayrollModal>
  );
}
