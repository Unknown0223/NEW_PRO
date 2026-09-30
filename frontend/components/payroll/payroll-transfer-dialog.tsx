"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/lib/api-client";
import { payrollApi, payrollErrorText, type Ym } from "@/lib/payroll/payroll-api";
import { Field, MonthField } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; to: Ym; items: PayrollItem[]; userIds: number[]; onDone: (text: string) => void };

/** Oldingi oydan qo'lda kiritilgan summalar va bonus biriktirmalarini ko'chirish. */
export function PayrollTransferDialog({ open, onOpenChange, to, items, userIds, onDone }: Props) {
  const tenant = useTenant();
  const [from, setFrom] = useState<Ym>(to.month === 1 ? { year: to.year - 1, month: 12 } : { year: to.year, month: to.month - 1 });
  const [picked, setPicked] = useState<number[]>([]);
  const [bonus, setBonus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manual = items.filter((i) => !i.system_key && i.is_active);

  useEffect(() => {
    if (open) {
      setFrom(to.month === 1 ? { year: to.year - 1, month: 12 } : { year: to.year, month: to.month - 1 });
      setError(null);
    }
  }, [open, to]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await payrollApi(tenant).send<{ users: number; lines: number; bonuses: number; skipped_frozen: number }>("POST", "/records/transfer", {
        from,
        to,
        item_ids: picked,
        bonus,
        user_ids: userIds.length ? userIds : undefined
      });
      onDone(`Перенесено: сотрудников ${r.users}, строк ${r.lines}, бонусов ${r.bonuses}${r.skipped_frozen ? `, пропущено подтверждённых ${r.skipped_frozen}` : ""}`);
      onOpenChange(false);
    } catch (e) {
      setError(payrollErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="payroll-template sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Перенос данных из прошлого месяца</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Из месяца">
            <MonthField value={from} onChange={setFrom} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {userIds.length ? `Только выбранные сотрудники: ${userIds.length}` : "Все сотрудники месяца"}. Подтверждённые записи не меняются.
          </p>
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Ручные статьи</span>
            {manual.length === 0 ? <span className="text-sm text-muted-foreground">Нет ручных статей</span> : null}
            {manual.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={picked.includes(i.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))} />
                {i.name}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} /> Назначения бонусных формул
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button size="sm" disabled={busy || (!picked.length && !bonus)} onClick={() => void run()}>Перенести</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
