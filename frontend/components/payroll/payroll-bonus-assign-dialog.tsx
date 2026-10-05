"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTenant } from "@/lib/api-client";
import { payrollApi, payrollErrorText, type Ym } from "@/lib/payroll/payroll-api";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PAYROLL_MODAL_SELECT, PayrollModal, PayrollModalActions, PayrollModalField, PayrollModalNote } from "@/components/payroll/kit/payroll-kit-modal";

export type BonusFormula = { id: number; name: string; scope: string; is_active: boolean; target_item_id: number | null; text: string; assignments?: number };
export type AssignTarget = { userIds: number[]; groupId: number };

export function PayrollBonusAssignDialog(props: {
  target: AssignTarget | null;
  ym: Ym;
  groups: Array<{ id: number; name: string }>;
  formulas: BonusFormula[];
  items: PayrollItem[];
  onClose: () => void;
  onDone: (text: string) => void;
  onCreateFormula?: () => void;
}) {
  const tenant = useTenant();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [formulaId, setFormulaId] = useState("");
  const [itemId, setItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = props.target;
  const gid = groupId ?? t?.groupId ?? 0;
  const formula = props.formulas.find((f) => String(f.id) === formulaId);

  const save = useMutation({
    mutationFn: () =>
      payrollApi(tenant).send<{ saved: number; skipped_confirmed: number[] }>("POST", "/bonus-assignments", {
        ...props.ym,
        user_ids: t?.userIds ?? [],
        kpi_group_id: gid,
        formula_id: Number(formulaId),
        target_item_id: itemId ? Number(itemId) : null
      }),
    onSuccess: (r) => {
      props.onDone(`Назначено: ${r.saved}${r.skipped_confirmed.length ? `, пропущено подтверждённых ${r.skipped_confirmed.length}` : ""}`);
      close();
    },
    onError: (e) => setError(payrollErrorText(e))
  });

  function close() {
    setGroupId(null);
    setFormulaId("");
    setItemId("");
    setError(null);
    props.onClose();
  }

  return (
    <PayrollModal open={t != null} onClose={close} title="Установка формулы">
      <div className="space-y-3.5">
        <PayrollModalNote>Сотрудников: <b className="text-foreground">{t?.userIds.length ?? 0}</b></PayrollModalNote>
        <PayrollModalField label="Группа KPI" select>
          <select className={PAYROLL_MODAL_SELECT} value={gid} onChange={(e) => setGroupId(Number(e.target.value))}>
            <option value={0}>Весь объём</option>
            {props.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </PayrollModalField>
        <PayrollModalField
          label="Формула"
          select
          hint={
            props.onCreateFormula ? (
              <button type="button" className="font-medium text-[var(--pr-brand-600)] hover:underline" onClick={props.onCreateFormula}>
                + Новая формула
              </button>
            ) : null
          }
        >
          <select className={PAYROLL_MODAL_SELECT} value={formulaId} onChange={(e) => setFormulaId(e.target.value)}>
            <option value="">— выберите —</option>
            {props.formulas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </PayrollModalField>
        {formula ? <code className="block rounded-lg border border-[var(--pr-border)] bg-[var(--pr-head)] px-3 py-2 font-mono text-[12px] text-foreground/80">= {formula.text}</code> : null}
        <PayrollModalField label="Статья начисления" select>
          <select className={PAYROLL_MODAL_SELECT} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Из формулы</option>
            {props.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </PayrollModalField>
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        <PayrollModalActions
          onCancel={close}
          onSubmit={() => save.mutate()}
          submitLabel="Назначить"
          busy={save.isPending}
          disabled={!formulaId || (!itemId && !formula?.target_item_id)}
        />
      </div>
    </PayrollModal>
  );
}
