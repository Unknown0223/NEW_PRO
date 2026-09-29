"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/lib/api-client";
import { money, payrollApi, payrollErrorText, roleLabel, ymLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { Field, NATIVE_SELECT, parseAmount } from "@/components/payroll/payroll-ui";

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
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? `Новый аванс — ${ymLabel(ym)}` : `Аванс: ${target && typeof target === "object" ? target.fio : ""}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {isNew ? (
            <Field label="Сотрудник">
              <Input placeholder="Поиск по ФИО или коду" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
              <select className={NATIVE_SELECT} value={userId} onChange={(e) => setUserId(e.target.value)} size={6}>
                {list.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fio}{e.code ? ` (${e.code})` : ""} · {roleLabel(e.role)}{e.remaining != null ? ` · доступно ${money(e.remaining)}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {emp ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs">
              Уже выдано/в работе: <b>{money(emp.used)}</b> · Лимит: <b>{emp.limit == null ? "без ограничения" : money(emp.limit)}</b>
              {emp.remaining != null ? <> · Осталось: <b>{money(emp.remaining)}</b></> : null}
            </p>
          ) : null}
          <Field label="Сумма">
            <GroupedNumberInput value={amount} placeholder="0" onValueChange={setAmount} />
          </Field>
          {over ? <p className="text-xs text-red-700">Сумма больше доступного лимита ({money(emp?.remaining)})</p> : null}
          <Field label="Комментарий">
            <Input value={comment} onChange={(e) => setComment(e.target.value)} className="h-9" />
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
            <Button size="sm" disabled={busy || !(value > 0) || over || (isNew && !userId)} onClick={() => void save()}>Сохранить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
