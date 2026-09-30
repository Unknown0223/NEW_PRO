"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/lib/api-client";
import { payrollApi, payrollErrorText, type Ym } from "@/lib/payroll/payroll-api";
import { Field, NATIVE_SELECT } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

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
    <Dialog open={t != null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="payroll-template sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Установка формулы</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Сотрудников: {t?.userIds.length ?? 0}</p>
          <Field label="Группа KPI">
            <select className={NATIVE_SELECT} value={gid} onChange={(e) => setGroupId(Number(e.target.value))}>
              <option value={0}>Весь объём</option>
              {props.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Формула">
            <select className={NATIVE_SELECT} value={formulaId} onChange={(e) => setFormulaId(e.target.value)}>
              <option value="">— выберите —</option>
              {props.formulas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          {formula ? <code className="block rounded bg-muted px-2 py-1 text-xs">{formula.text}</code> : null}
          <Field label="Статья начисления">
            <select className={NATIVE_SELECT} value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Из формулы</option>
              {props.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close}>Отмена</Button>
            <Button size="sm" disabled={!formulaId || save.isPending || (!itemId && !formula?.target_item_id)} onClick={() => save.mutate()}>
              Назначить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
