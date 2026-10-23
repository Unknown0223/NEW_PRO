"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/api-client";
import { inputToYm, payrollApi, payrollErrorText, ymToInput, type Ym } from "@/lib/payroll/payroll-api";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import {
  PAYROLL_MODAL_INPUT,
  PayrollModal,
  PayrollModalActions,
  PayrollModalCheck,
  PayrollModalField,
  PayrollModalNote,
  PayrollModalSection
} from "@/components/payroll/kit/payroll-kit-modal";

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
    <PayrollModal open={open} onClose={() => onOpenChange(false)} title="Перенос данных" width="sm:max-w-[440px]">
      <div className="space-y-3.5">
        <PayrollModalField label="Месяц источник">
          <input type="month" className={PAYROLL_MODAL_INPUT} value={ymToInput(from)} onChange={(e) => { const v = inputToYm(e.target.value); if (v) setFrom(v); }} />
        </PayrollModalField>
        <PayrollModalSection title="Ручные статьи">
          {manual.length === 0 ? <p className="text-[12.5px] text-muted-foreground">Нет ручных статей</p> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {manual.map((i) => (
              <PayrollModalCheck key={i.id} label={i.name} checked={picked.includes(i.id)} onChange={(on) => setPicked(on ? [...picked, i.id] : picked.filter((x) => x !== i.id))} />
            ))}
          </div>
        </PayrollModalSection>
        <PayrollModalSection title="Параметры для изменения">
          <PayrollModalCheck label="Назначения бонусных формул" checked={bonus} onChange={setBonus} />
        </PayrollModalSection>
        <PayrollModalNote>
          {userIds.length ? `Только выбранные сотрудники: ${userIds.length}` : "Все сотрудники месяца"}. Подтверждённые записи не меняются.
        </PayrollModalNote>
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        <PayrollModalActions onCancel={() => onOpenChange(false)} onSubmit={() => void run()} submitLabel="Перенести" busy={busy} disabled={!picked.length && !bonus} />
      </div>
    </PayrollModal>
  );
}
