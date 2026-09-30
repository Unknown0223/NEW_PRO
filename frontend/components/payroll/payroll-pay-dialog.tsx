"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/lib/api-client";
import { money, payrollApi, payrollErrorText, roleLabel, ymLabel } from "@/lib/payroll/payroll-api";
import { Field, NATIVE_SELECT, parseAmount } from "@/components/payroll/payroll-ui";

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
    <Dialog open={row != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="payroll-template sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row?.kind === "salary" ? "Выдача зарплаты" : "Выдача аванса"}</DialogTitle>
        </DialogHeader>
        {row ? (
          <div className="grid gap-3">
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <div className="font-medium">{row.fio}</div>
              <div className="text-xs text-muted-foreground">
                {roleLabel(row.role)}{row.code ? ` · ${row.code}` : ""} · {row.branch ?? "—"} · {ymLabel(row)}
              </div>
              <div className="mt-1">{row.kind === "salary" ? "Остаток к выплате" : "Сумма аванса"}: <b>{money(row.amount)} {row.currency}</b></div>
            </div>
            <Field label="Касса">
              <select className={NATIVE_SELECT} value={deskId} onChange={(e) => setDeskId(e.target.value)}>
                <option value="">— выберите —</option>
                {allowed.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Способ оплаты">
              <select className={NATIVE_SELECT} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">Наличные ({defaultCurrency})</option>
                {methods.map((x) => <option key={String(x.id)} value={x.ref}>{x.name}{x.currency ? ` (${x.currency})` : ""}</option>)}
              </select>
            </Field>
            {row.kind === "salary" ? (
              <Field label={`Сумма (${row.currency})`}>
                <GroupedNumberInput value={amount} maxFractionDigits={2} onValueChange={setAmount} />
              </Field>
            ) : null}
            {tooMuch ? <p className="text-xs text-red-700">Больше остатка к выплате</p> : null}
            {currency !== row.currency ? <p className="text-xs text-amber-700">Выдача в {currency}: сумма будет пересчитана по курсу на сегодня.</p> : null}
            <Field label="Комментарий">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} className="h-9" />
            </Field>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
              <Button size="sm" disabled={busy || !deskId || !(value > 0) || tooMuch} onClick={() => void pay()}>Выдать</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
