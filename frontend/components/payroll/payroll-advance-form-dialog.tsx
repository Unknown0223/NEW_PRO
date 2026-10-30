"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useTenant } from "@/lib/api-client";
import { money, payrollApi, payrollErrorText, roleLabel, ymLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { parseAmount } from "@/components/payroll/payroll-ui";
import {
  PAYROLL_MODAL_INPUT,
  PAYROLL_MODAL_LIST,
  PayrollModal,
  PayrollModalActions,
  PayrollModalField,
  PayrollModalNote
} from "@/components/payroll/kit/payroll-kit-modal";

type Employee = { id: number; fio: string; code: string | null; role: string; branch: string | null; is_active: boolean; used: number; limit: number | null; remaining: number | null };
export type AdvanceEditTarget = { id: number; fio: string; amount: number; comment: string | null } | "new" | null;

type Props = { target: AdvanceEditTarget; ym: Ym; onClose: () => void; onSaved: (text: string) => void };

export function PayrollAdvanceFormDialog({ target, ym, onClose, onSaved }: Props) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const isNew = target === "new";
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (target && target !== "new") {
      setAmount(String(target.amount));
      setComment(target.comment ?? "");
    } else if (target === "new") {
      setUserId("");
      setAmount("");
      setComment("");
    }
  }, [target]);

  const empQ = useQuery({
    queryKey: ["payroll-advance-employees", tenant, ym.year, ym.month],
    enabled: Boolean(tenant) && isNew,
    queryFn: () => api.get<Employee[]>(`/advances/employees?${ymQuery(ym)}`)
  });
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (empQ.data ?? []).filter((e) => e.is_active && (!s || `${e.fio} ${e.code ?? ""}`.toLowerCase().includes(s))).slice(0, 300);
  }, [empQ.data, q]);
  const emp = (empQ.data ?? []).find((e) => String(e.id) === userId);
  const value = parseAmount(amount);
  const over = emp?.remaining != null && value > emp.remaining;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await api.send("POST", "/advances", { ...ym, user_id: Number(userId), amount: value, comment: comment.trim() || null });
        onSaved("Аванс добавлен как черновик — отправьте его на утверждение");
      } else if (target) {
        await api.send("PATCH", `/advances/${target.id}`, { amount: value, comment: comment.trim() || null });
        onSaved("Аванс изменён");
      }
      onClose();
    } catch (e) {
      setError(payrollErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PayrollModal
      open={target != null}
      onClose={onClose}
      title={isNew ? `Новый аванс — ${ymLabel(ym)}` : `Аванс: ${target && typeof target === "object" ? target.fio : ""}`}
    >
      <div className="space-y-3.5">
        {isNew ? (
          <div className="space-y-1.5">
            <PayrollModalField label="Сотрудник">
              <input className={PAYROLL_MODAL_INPUT} placeholder="Поиск по ФИО или коду" value={q} onChange={(e) => setQ(e.target.value)} />
            </PayrollModalField>
            <select className={PAYROLL_MODAL_LIST} aria-label="Сотрудник" value={userId} onChange={(e) => setUserId(e.target.value)} size={6}>
              {list.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fio}{e.code ? ` (${e.code})` : ""} · {roleLabel(e.role)}{e.remaining != null ? ` · доступно ${money(e.remaining)}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {emp ? (
          <PayrollModalNote>
            Уже выдано/в работе: <b className="text-foreground">{money(emp.used)}</b> · Лимит:{" "}
            <b className="text-foreground">{emp.limit == null ? "без ограничения" : money(emp.limit)}</b>
            {emp.remaining != null ? <> · Осталось: <b className="text-[var(--pr-brand-600)]">{money(emp.remaining)}</b></> : null}
          </PayrollModalNote>
        ) : null}
        <PayrollModalField label="Сумма" error={over ? `Сумма больше доступного лимита (${money(emp?.remaining)})` : null}>
          <GroupedNumberInput value={amount} placeholder="0" onValueChange={setAmount} className={PAYROLL_MODAL_INPUT} />
        </PayrollModalField>
        <PayrollModalField label="Комментарий">
          <input className={PAYROLL_MODAL_INPUT} value={comment} onChange={(e) => setComment(e.target.value)} />
        </PayrollModalField>
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        <PayrollModalActions onCancel={onClose} onSubmit={() => void save()} busy={busy} disabled={!(value > 0) || over || (isNew && !userId)} />
      </div>
    </PayrollModal>
  );
}
