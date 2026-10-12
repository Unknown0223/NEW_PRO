"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/lib/api-client";
import { payrollApi, payrollErrorText, type Ym } from "@/lib/payroll/payroll-api";
import { usePermissions } from "@/lib/use-permissions";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { type FormulaDraft } from "@/components/payroll/payroll-formula-editor";
import { PayrollFormulaBuilder } from "@/components/payroll/payroll-formula-builder";
import { PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import { PAYROLL_MODAL_SELECT, PayrollModal, PayrollModalActions, PayrollModalField, PayrollModalNote } from "@/components/payroll/kit/payroll-kit-modal";

export type BonusFormula = { id: number; name: string; scope: string; is_active: boolean; target_item_id: number | null; text: string; assignments?: number };
export type AssignTarget = { userIds: number[]; groupId: number };
export type GroupWithFormula = { id: number; name: string; bonus_formula: string | null };

type Mode = "ready" | "new";

const emptyDraft = (ym: Ym, kpi: number | null): FormulaDraft => ({
  name: "",
  scope: "bonus",
  text: "",
  role: null,
  kpi_group_id: kpi,
  year: ym.year,
  month: ym.month,
  target_item_id: null,
  priority: 100,
  is_active: true
});

export function PayrollBonusAssignDialog(props: {
  target: AssignTarget | null;
  ym: Ym;
  groups: GroupWithFormula[];
  formulas: BonusFormula[];
  items: PayrollItem[];
  roles: string[];
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const tenant = useTenant();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canWrite = perms.isAdmin || perms.hasAny("staff.zarplaty.create", "staff.zarplaty.update");
  const [mode, setMode] = useState<Mode>("ready");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [formulaId, setFormulaId] = useState("");
  const [itemId, setItemId] = useState("");
  const [groupFormula, setGroupFormula] = useState("");
  const [draft, setDraft] = useState<FormulaDraft>(() => emptyDraft(props.ym, null));
  const [error, setError] = useState<string | null>(null);
  const t = props.target;
  const gid = groupId ?? t?.groupId ?? 0;
  const formula = props.formulas.find((f) => String(f.id) === formulaId);
  const selectedGroup = props.groups.find((g) => g.id === gid);
  const writing = mode === "new";
  const newReady = canWrite && Boolean(draft.name.trim() && draft.text.trim() && draft.target_item_id);

  const save = useMutation({
    mutationFn: async () => {
      const api = payrollApi(tenant);
      let id = Number(formulaId);
      let item: number | null = itemId ? Number(itemId) : null;
      if (writing) {
        const created = await api.send<{ id: number }>("POST", "/formulas", {
          name: draft.name.trim(),
          scope: draft.scope,
          text: draft.text,
          role: draft.role,
          kpi_group_id: draft.kpi_group_id,
          year: draft.year,
          month: draft.month,
          target_item_id: draft.scope === "salary" ? null : draft.target_item_id,
          priority: draft.priority,
          is_active: true
        });
        id = created.id;
        item = draft.target_item_id;
      }
      return api.send<{ saved: number; skipped_confirmed: number[] }>("POST", "/bonus-assignments", {
        ...props.ym,
        user_ids: t?.userIds ?? [],
        kpi_group_id: gid,
        formula_id: id,
        target_item_id: item,
        group_formula: writing ? undefined : groupFormula || selectedGroup?.bonus_formula || undefined
      });
    },
    onSuccess: (r) => {
      if (writing) void qc.invalidateQueries({ queryKey: ["payroll-formulas", tenant] });
      props.onDone(`Назначено: ${r.saved}${r.skipped_confirmed.length ? `, пропущено подтверждённых ${r.skipped_confirmed.length}` : ""}`);
      close();
    },
    onError: (e) => setError(payrollErrorText(e))
  });

  function close() {
    setMode("ready");
    setGroupId(null);
    setFormulaId("");
    setItemId("");
    setGroupFormula("");
    setDraft(emptyDraft(props.ym, null));
    setError(null);
    props.onClose();
  }

  function pickMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === "new" && !draft.name && !draft.text) setDraft(emptyDraft(props.ym, gid > 0 ? gid : null));
  }

  return (
    <PayrollModal
      open={t != null}
      onClose={close}
      title="Установка формулы"
      width={writing ? "sm:max-w-[1100px]" : "sm:max-w-[520px]"}
      className={writing ? "top-[3vh] max-h-[94vh]" : undefined}
      headerExtra={
        <PayrollSegmentedTabs<Mode>
          variant="status"
          tabs={[
            { id: "ready", label: "Готовая" },
            { id: "new", label: "Новая формула" }
          ]}
          value={mode}
          onChange={pickMode}
        />
      }
    >
      <div className="space-y-3.5">
        <PayrollModalNote>Сотрудников: <b className="text-foreground">{t?.userIds.length ?? 0}</b></PayrollModalNote>
        <PayrollModalField label="Группа KPI" select>
          <select
            className={PAYROLL_MODAL_SELECT}
            value={gid}
            onChange={(e) => {
              const id = Number(e.target.value);
              setGroupId(id);
              setGroupFormula(props.groups.find((g) => g.id === id)?.bonus_formula ?? "");
              if (writing) setDraft((d) => ({ ...d, kpi_group_id: id > 0 ? id : null }));
            }}
          >
            <option value={0}>Весь объём</option>
            {props.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </PayrollModalField>
        {writing ? (
          canWrite ? (
            <PayrollFormulaBuilder
              draft={draft}
              onChange={setDraft}
              onSave={() => undefined}
              onClear={() => setDraft(emptyDraft(props.ym, gid > 0 ? gid : null))}
              saving={save.isPending}
              canEdit
              items={props.items}
              roles={props.roles}
              employees={[]}
              hideActions
              bodyHeight="lg:h-[clamp(320px,calc(94vh-340px),520px)]"
            />
          ) : (
            <PayrollModalNote tone="warn">Нет права создавать формулы. Выберите готовую.</PayrollModalNote>
          )
        ) : (
          <>
            {gid > 0 && selectedGroup ? (
              <PayrollModalField label="Формула группы" hint={<span className="text-[11px] text-muted-foreground">{selectedGroup.bonus_formula ? "Переопределит формулу назначения" : "Используется формула назначения"}</span>}>
                <textarea
                  className="w-full rounded-lg border border-[var(--pr-border)] bg-[var(--pr-head)] px-2 py-1.5 font-mono text-[12px] outline-none ring-primary/30 focus-within:ring-1"
                  rows={3}
                  value={groupFormula}
                  onChange={(e) => setGroupFormula(e.target.value)}
                  placeholder="Введите формулу KPI для этой группы..."
                />
              </PayrollModalField>
            ) : null}
            <PayrollModalField label="Формула" select>
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
          </>
        )}
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        <PayrollModalActions
          onCancel={close}
          onSubmit={() => save.mutate()}
          submitLabel={writing ? "Сохранить и назначить" : "Назначить"}
          busy={save.isPending}
          disabled={writing ? !newReady : !formulaId || (!itemId && !formula?.target_item_id)}
        />
      </div>
    </PayrollModal>
  );
}
